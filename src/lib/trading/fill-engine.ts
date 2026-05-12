import { prisma } from "@/lib/db";
import { fetchMarketQuote } from "@/lib/trading/marketQuote";
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
  fills: { id: number; sequence: number; quantity: number; price: number; executedAt: Date }[];
};

function isFillActive(status: OrderStatus): boolean {
  return [
    OrderStatus.RISK_APPROVED,
    OrderStatus.ACKNOWLEDGED,
    OrderStatus.PARTIALLY_FILLED,
  ].includes(status);
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

    await prisma.$transaction(async (tx) => {
      await tx.orderFill.create({
        data: {
          orderId: order.id,
          sequence,
          quantity: fillQty,
          price: fillPrice,
          executedAt,
        },
      });

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
    });

    if (nextStatus === OrderStatus.FULLY_FILLED) break;
    if (Date.now() - fillStartedAt.getTime() >= MAX_FILL_WINDOW_MS) break;
  }
}

export async function processSimulatedFillEngine() {
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
  })) as ActiveFillOrder[];

  for (const order of activeOrders) {
    await advanceOrderFills(order);
  }
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
