import { prisma } from "@/lib/db";
import { fetchMarketQuote } from "@/lib/trading/marketQuote";
import { splitQuantityAcrossAllocations } from "@/lib/trading/allocation";
import { detectAndLogWashSale } from "@/lib/trading/washSale";
import { OrderDirection, OrderStatus } from "@prisma/client";

const FILL_COUNT = 4;
const FILL_INTERVAL_MS = 22_500;
const MAX_FILL_WINDOW_MS = 90_000;

type ActiveFillOrder = {
  id: number;
  ticker: string;
  quantity: number;
  direction: OrderDirection;
  status: OrderStatus;
  fillStartedAt: Date | null;
  arrivalPrice: number | null;
  filledQuantity: number;
  remainingQuantity: number;
  averageFillPrice: number | null;
  allocationInstructions: { id: number; sequence: number; account: string; weightPct: number }[];
  fills: {
    id: number;
    sequence: number;
    quantity: number;
    price: number;
    executedAt: Date;
    allocations: {
      id: number;
      fillId: number;
      instructionId: number;
      shares: number;
      notional: number;
    }[];
  }[];
};

function isFillActive(status: OrderStatus): boolean {
  const activeStatuses: OrderStatus[] = [
    OrderStatus.ACKNOWLEDGED,
    OrderStatus.PARTIALLY_FILLED,
  ];
  return activeStatuses.includes(status);
}

function splitQuantityIntoChunks(totalQuantity: number): number[] {
  if (totalQuantity <= FILL_COUNT) {
    return Array.from({ length: totalQuantity }, () => 1);
  }
  const base = Math.floor(totalQuantity / FILL_COUNT);
  const chunks = [base, base, base, totalQuantity - base * 3];
  return chunks;
}

function roundToCents(value: number): number {
  return Math.round(value * 100) / 100;
}

function pickSlippage(direction: OrderDirection): number {
  const positive = Math.random() * 0.08;
  const negative = -(Math.random() * 0.05);
  const positiveBias = direction === OrderDirection.BUY ? 0.7 : 0.3;
  return Math.random() < positiveBias ? positive : negative;
}

let fillEngineRun: Promise<void> | null = null;

async function fetchArrivalPrice(ticker: string): Promise<number> {
  const quote = await fetchMarketQuote(ticker);
  if ("error" in quote) {
    throw new Error(quote.error);
  }
  return quote.last;
}

async function initializeFillPlan(order: ActiveFillOrder) {
  if (order.fillStartedAt) return order.fillStartedAt;

  const arrivalPrice = await fetchArrivalPrice(order.ticker);
  const fillStartedAt = new Date();

  await prisma.order.update({
    where: { id: order.id },
    data: {
      fillStartedAt,
      arrivalPrice,
      filledQuantity: 0,
      remainingQuantity: order.quantity,
      averageFillPrice: null,
      fillCompletedAt: null,
    },
  });

  await prisma.orderActivity.create({
    data: {
      orderId: order.id,
      message: `Fill simulation armed at arrival price $${arrivalPrice.toFixed(2)}`,
      actorName: "EMS",
    },
  });

  return fillStartedAt;
}

async function advanceOrderFills(order: ActiveFillOrder) {
  if (!isFillActive(order.status)) return;

  let fillStartedAt = order.fillStartedAt;
  if (!fillStartedAt) {
    try {
      fillStartedAt = await initializeFillPlan(order);
    } catch (e) {
      console.error(`[fill-engine] failed to initialize ${order.id}`, e);
      return;
    }
  }
  const elapsed = Date.now() - fillStartedAt.getTime();
  const dueFillCount = Math.min(FILL_COUNT, Math.floor(elapsed / FILL_INTERVAL_MS));
  const completedFillCount = order.fills.length;

  if (dueFillCount <= completedFillCount) return;

  const chunks = splitQuantityIntoChunks(order.quantity);
  let currentFilled = order.filledQuantity;
  let currentAvg = order.averageFillPrice ?? 0;
  let weightedNotional = currentAvg * currentFilled;

  for (let sequence = completedFillCount + 1; sequence <= dueFillCount; sequence += 1) {
    const fillQty = chunks[sequence - 1];
    if (fillQty == null) break;

    const quote = await fetchMarketQuote(order.ticker);
    if ("error" in quote) {
      console.error(`[fill-engine] ${order.ticker} quote failed`, quote.error);
      break;
    }

    const livePrice = quote.last;
    const slip = pickSlippage(order.direction);
    const fillPrice = roundToCents(Math.max(0.01, livePrice + slip));
    const executedAt = new Date();

    currentFilled += fillQty;
    weightedNotional += fillQty * fillPrice;
    currentAvg = roundToCents(weightedNotional / currentFilled);

    const nextStatus =
      currentFilled >= order.quantity
        ? OrderStatus.FULLY_FILLED
        : OrderStatus.PARTIALLY_FILLED;

    const fillAllocations =
      order.allocationInstructions.length > 0
        ? splitQuantityAcrossAllocations(fillQty, order.allocationInstructions).map((split) => ({
            fillId: -sequence,
            instructionId: split.id,
            shares: split.shares,
            notional: roundToCents(split.shares * fillPrice),
          }))
        : [];

    await prisma.$transaction(async (tx) => {
      const createdFill = await tx.orderFill.create({
        data: {
          orderId: order.id,
          sequence,
          quantity: fillQty,
          price: fillPrice,
          executedAt,
        },
      });

      if (fillAllocations.length > 0) {
        await tx.orderFillAllocation.createMany({
          data: fillAllocations.map((allocation) => ({
            fillId: createdFill.id,
            instructionId: allocation.instructionId,
            shares: allocation.shares,
            notional: allocation.notional,
          })),
        });
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: nextStatus,
          filledQuantity: currentFilled,
          remainingQuantity: Math.max(0, order.quantity - currentFilled),
          averageFillPrice: currentAvg,
          fillCompletedAt:
            nextStatus === OrderStatus.FULLY_FILLED ? executedAt : null,
        },
      });
      // after committing the fill and order updates, run wash-sale detection
      // (run outside the transaction to keep DB locks minimal)
      (async () => {
        try {
          await detectAndLogWashSale(createdFill.id);
        } catch (e) {
          console.error("[wash-sale] detection failed", e);
        }
      })();

      await tx.orderActivity.create({
        data: {
          orderId: order.id,
          message: `Fill ${sequence}/4: ${fillQty.toLocaleString()} shares @ $${fillPrice.toFixed(2)}`,
          actorName: "EMS",
        },
      });
    });

    order.status = nextStatus;
    order.filledQuantity = currentFilled;
    order.remainingQuantity = Math.max(0, order.quantity - currentFilled);
    order.averageFillPrice = currentAvg;
    order.fills.push({
      id: -sequence,
      sequence,
      quantity: fillQty,
      price: fillPrice,
      executedAt,
      allocations: fillAllocations.map((split, index) => ({
        id: index + 1,
        fillId: -sequence,
        instructionId: split.instructionId,
        shares: split.shares,
        notional: split.notional,
      })),
    });

    if (nextStatus === OrderStatus.FULLY_FILLED) break;
    if (Date.now() - fillStartedAt.getTime() >= MAX_FILL_WINDOW_MS) break;
  }
}

export async function processSimulatedFillEngine() {
  if (fillEngineRun) return fillEngineRun;

  fillEngineRun = (async () => {
    const activeOrders = (await prisma.order.findMany({
      where: {
        status: {
          in: [
            OrderStatus.RISK_APPROVED,
            OrderStatus.ACKNOWLEDGED,
            OrderStatus.PARTIALLY_FILLED,
          ],
        },
      },
      select: {
        id: true,
        ticker: true,
        quantity: true,
        direction: true,
        status: true,
        fillStartedAt: true,
        arrivalPrice: true,
        filledQuantity: true,
        remainingQuantity: true,
        averageFillPrice: true,
        allocationInstructions: {
          orderBy: { sequence: "asc" },
          select: {
            id: true,
            sequence: true,
            account: true,
            weightPct: true,
          },
        },
        fills: {
          orderBy: { sequence: "asc" },
          select: {
            id: true,
            sequence: true,
            quantity: true,
            price: true,
            executedAt: true,
            allocations: {
              select: {
                id: true,
                fillId: true,
                instructionId: true,
                shares: true,
                notional: true,
              },
            },
          },
        },
      },
    })) as ActiveFillOrder[];

    await Promise.all(activeOrders.map((order) => advanceOrderFills(order)));
  })().finally(() => {
    fillEngineRun = null;
  });

  return fillEngineRun;
}

export async function initializeOrderFillSimulation(orderId: number) {
  const order = (await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      ticker: true,
      quantity: true,
      direction: true,
      status: true,
      fillStartedAt: true,
      arrivalPrice: true,
      filledQuantity: true,
      remainingQuantity: true,
      averageFillPrice: true,
      fills: {
        orderBy: { sequence: "asc" },
        select: {
          id: true,
          sequence: true,
          quantity: true,
          price: true,
          executedAt: true,
        },
      },
    },
  })) as ActiveFillOrder | null;

  if (!order) return;
  if (!isFillActive(order.status)) return;
  try {
    await initializeFillPlan(order);
  } catch (e) {
    console.error(`[fill-engine] failed to arm ${orderId}`, e);
  }
}
