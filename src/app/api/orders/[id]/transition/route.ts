import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { initializeOrderFillSimulation } from "@/lib/trading/fill-engine";
import { computePreTradeImpact } from "@/lib/trading/risk";
import { computeExposureSnapshot } from "@/lib/trading/portfolio";
import {
  OrderStatus,
  UserType,
} from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("submit_draft"),
  }),
  z.object({
    action: z.literal("cancel"),
  }),
  z.object({
    action: z.literal("risk_start_review"),
  }),
  z.object({
    action: z.literal("risk_approve"),
    withConditions: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("risk_reject"),
  }),
  z.object({
    action: z.literal("broker_ack"),
  }),
  z.object({
    action: z.literal("broker_reject"),
    code: z.string().min(1),
    reason: z.string().optional(),
  }),
  z.object({
    action: z.literal("lock_allocations"),
  }),
  z.object({
    action: z.literal("simulate_partial_fill"),
    filledQty: z.number().int().positive(),
    price: z.number(),
  }),
  z.object({
    action: z.literal("simulate_full_fill"),
    price: z.number(),
  }),
]);

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const orderId = Number(id);
  if (!Number.isFinite(orderId)) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const uid = Number(session.user.id);
  const userType = session.user.type as UserType;
  const actorName = session.user.name ?? "User";

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      activities: { orderBy: { createdAt: "asc" } },
      trader: true,
      allocationInstructions: { orderBy: { sequence: "asc" } },
      fills: {
        orderBy: { sequence: "asc" },
        include: { allocations: true },
      },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    if (body.action === "submit_draft") {
      if (userType !== UserType.EQUITY_TRADER || order.traderId !== uid) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (order.status !== OrderStatus.DRAFT) {
        return NextResponse.json({ error: "Not a draft" }, { status: 400 });
      }
      const [snapshot, restrictedStocks] = await Promise.all([
        computeExposureSnapshot({
          extraSymbols: [order.ticker],
        }),
        prisma.restrictedStock.findMany({
          select: { ticker: true },
        }),
      ]);
      const impact = computePreTradeImpact({
        ticker: order.ticker,
        quantity: order.quantity,
        limitPrice: order.limitPrice ? Number(order.limitPrice) : undefined,
        direction: order.direction,
        portfolio: snapshot,
        restrictedStocks: restrictedStocks.map((rs) => rs.ticker),
      });

      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: orderId },
          data: { status: OrderStatus.SUBMITTED },
        });
        await tx.orderActivity.create({
          data: {
            orderId,
            message: `Submitted by ${actorName} · ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
            actorName,
          },
        });
        for (const check of impact.triggeredChecks) {
          await tx.orderActivity.create({
            data: {
              orderId,
              message: `Risk check flagged: ${check.toLowerCase()} · pending review`,
              actorName: "System",
            },
          });
          await tx.riskBreachLog.create({
            data: {
              orderId,
              checkType: check,
              breachDetail: "Pre-trade simulation exceeded soft limit",
              resolution: "Pending",
            },
          });
        }
      });
    } else if (body.action === "cancel") {
      if (userType !== UserType.EQUITY_TRADER || order.traderId !== uid) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (
        order.status !== OrderStatus.DRAFT &&
        order.status !== OrderStatus.SUBMITTED &&
        order.status !== OrderStatus.IN_REVIEW &&
        order.status !== OrderStatus.RISK_APPROVED &&
        order.status !== OrderStatus.ACKNOWLEDGED &&
        order.status !== OrderStatus.PARTIALLY_FILLED
      ) {
        return NextResponse.json({ error: "Cannot cancel" }, { status: 400 });
      }
      const cancelledPartial = (order.filledQuantity ?? 0) > 0 || order.fills.length > 0;
      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: orderId },
          data: {
            status: cancelledPartial
              ? OrderStatus.CANCELLED_PARTIAL
              : OrderStatus.CANCELLED,
          },
        });
        await tx.orderActivity.create({
          data: {
            orderId,
            message: cancelledPartial
              ? `Cancelled by ${actorName} after partial fills`
              : `Cancelled by ${actorName}`,
            actorName,
          },
        });
      });
    } else if (body.action === "risk_start_review") {
      if (userType !== UserType.RISK_OFFICER) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (order.status !== OrderStatus.SUBMITTED) {
        return NextResponse.json({ error: "Invalid state" }, { status: 400 });
      }
      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: orderId },
          data: { status: OrderStatus.IN_REVIEW, reviewedById: uid },
        });
        await tx.orderActivity.create({
          data: {
            orderId,
            message: `In review — opened by ${actorName}`,
            actorName,
          },
        });
      });
    } else if (body.action === "risk_approve") {
      if (userType !== UserType.RISK_OFFICER) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (
        order.status !== OrderStatus.SUBMITTED &&
        order.status !== OrderStatus.IN_REVIEW
      ) {
        return NextResponse.json({ error: "Invalid state" }, { status: 400 });
      }
      const withConditions = Boolean(body.withConditions);
      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: orderId },
          data: {
            status: OrderStatus.RISK_APPROVED,
            reviewedById: uid,
            riskApprovedWithConditions: withConditions,
          },
        });
        await tx.orderActivity.create({
          data: {
            orderId,
            message: withConditions
              ? `Approved with conditions by ${actorName}`
              : `Approved by ${actorName}`,
            actorName,
          },
        });
        await tx.riskBreachLog.updateMany({
          where: { orderId, resolution: "Pending" },
          data: {
            resolution: withConditions ? "Approved with conditions" : "Approved",
            actorUserId: uid,
          },
        });
      });
      await initializeOrderFillSimulation(orderId);
    } else if (body.action === "risk_reject") {
      if (userType !== UserType.RISK_OFFICER) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: orderId },
          data: { status: OrderStatus.REJECTED, reviewedById: uid },
        });
        await tx.orderActivity.create({
          data: {
            orderId,
            message: `Rejected by ${actorName}`,
            actorName,
          },
        });
        await tx.riskBreachLog.updateMany({
          where: { orderId, resolution: "Pending" },
          data: { resolution: "Rejected by risk", actorUserId: uid },
        });
      });
    } else if (body.action === "broker_ack") {
      if (userType !== UserType.PRIME_BROKER) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (order.status !== OrderStatus.RISK_APPROVED) {
        return NextResponse.json({ error: "Invalid state" }, { status: 400 });
      }
      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: orderId },
          data: { status: OrderStatus.ACKNOWLEDGED },
        });
        await tx.orderActivity.create({
          data: {
            orderId,
            message: `Acknowledged by Prime Broker (${actorName})`,
            actorName,
          },
        });
      });
    } else if (body.action === "broker_reject") {
      if (userType !== UserType.PRIME_BROKER) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (order.status !== OrderStatus.RISK_APPROVED) {
        return NextResponse.json({ error: "Invalid state" }, { status: 400 });
      }
      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: orderId },
          data: {
            status: OrderStatus.REJECTED,
            brokerRejectCode: body.code,
            brokerRejectReason: body.reason ?? null,
          },
        });
        await tx.orderActivity.create({
          data: {
            orderId,
            message: `Rejected by broker (${actorName}) — ${body.code}`,
            actorName,
          },
        });
      });
    } else if (body.action === "lock_allocations") {
      if (userType !== UserType.EQUITY_TRADER || order.traderId !== uid) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (order.status !== OrderStatus.FULLY_FILLED) {
        return NextResponse.json({ error: "Invalid state" }, { status: 400 });
      }
      if (order.allocationInstructions.length === 0) {
        return NextResponse.json({ error: "No allocations to lock" }, { status: 400 });
      }
      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: orderId },
          data: { allocationLockedAt: new Date() },
        });
        await tx.orderActivity.create({
          data: {
            orderId,
            message: `Allocations confirmed and locked by ${actorName}`,
            actorName,
          },
        });
      });
    } else if (body.action === "simulate_partial_fill") {
      if (userType !== UserType.EQUITY_TRADER || order.traderId !== uid) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (
        order.status !== OrderStatus.ACKNOWLEDGED &&
        order.status !== OrderStatus.PARTIALLY_FILLED
      ) {
        return NextResponse.json({ error: "Invalid state" }, { status: 400 });
      }
      await prisma.$transaction(async (tx) => {
        const fillQty = Math.min(body.filledQty, order.quantity - (order.filledQuantity ?? 0));
        if (fillQty <= 0) {
          throw new Error("No remaining quantity to fill");
        }
        const nextFilled = (order.filledQuantity ?? 0) + fillQty;
        const avg =
          order.averageFillPrice != null && order.filledQuantity > 0
            ? ((order.averageFillPrice * order.filledQuantity) + fillQty * body.price) /
              nextFilled
            : body.price;
        const createdFill = await tx.orderFill.create({
          data: {
            orderId,
            sequence: order.fills.length + 1,
            quantity: fillQty,
            price: body.price,
            executedAt: new Date(),
          },
        });
        const instructions =
          order.allocationInstructions.length > 0
            ? order.allocationInstructions
            : [{ id: 0, sequence: 1, account: order.account, weightPct: 100 }];
        const splits = instructions.map((instruction) => ({
          instructionId: instruction.id,
          shares: Math.floor((fillQty * instruction.weightPct) / 100),
        }));
        let remainingShares = fillQty - splits.reduce((sum, split) => sum + split.shares, 0);
        const ranked = [...instructions].sort((a, b) => b.weightPct - a.weightPct || a.sequence - b.sequence);
        for (const instruction of ranked) {
          if (remainingShares <= 0) break;
          const split = splits.find((candidate) => candidate.instructionId === instruction.id);
          if (!split) continue;
          split.shares += 1;
          remainingShares -= 1;
        }
        await tx.orderFillAllocation.createMany({
          data: splits
            .filter((split) => split.shares > 0)
            .map((split) => ({
              fillId: createdFill.id,
              instructionId: split.instructionId,
              shares: split.shares,
              notional: split.shares * body.price,
            })),
        });
        await tx.order.update({
          where: { id: orderId },
          data: {
            status: OrderStatus.PARTIALLY_FILLED,
            filledQuantity: nextFilled,
            remainingQuantity: Math.max(0, order.quantity - nextFilled),
            averageFillPrice: avg,
          },
        });
        await tx.orderActivity.create({
          data: {
            orderId,
            message: `Partial fill: ${fillQty.toLocaleString()} shares @ $${body.price.toFixed(2)}`,
            actorName: "EMS",
          },
        });
      });
    } else if (body.action === "simulate_full_fill") {
      if (userType !== UserType.EQUITY_TRADER || order.traderId !== uid) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      await prisma.$transaction(async (tx) => {
        const fillQty = Math.max(0, order.quantity - (order.filledQuantity ?? 0));
        const nextFilled = order.quantity;
        const avg =
          order.averageFillPrice != null && order.filledQuantity > 0
            ? ((order.averageFillPrice * order.filledQuantity) + fillQty * body.price) /
              nextFilled
            : body.price;
        const createdFill = await tx.orderFill.create({
          data: {
            orderId,
            sequence: order.fills.length + 1,
            quantity: fillQty,
            price: body.price,
            executedAt: new Date(),
          },
        });
        const instructions =
          order.allocationInstructions.length > 0
            ? order.allocationInstructions
            : [{ id: 0, sequence: 1, account: order.account, weightPct: 100 }];
        const splits = instructions.map((instruction) => ({
          instructionId: instruction.id,
          shares: Math.floor((fillQty * instruction.weightPct) / 100),
        }));
        let remainingShares = fillQty - splits.reduce((sum, split) => sum + split.shares, 0);
        const ranked = [...instructions].sort((a, b) => b.weightPct - a.weightPct || a.sequence - b.sequence);
        for (const instruction of ranked) {
          if (remainingShares <= 0) break;
          const split = splits.find((candidate) => candidate.instructionId === instruction.id);
          if (!split) continue;
          split.shares += 1;
          remainingShares -= 1;
        }
        await tx.orderFillAllocation.createMany({
          data: splits
            .filter((split) => split.shares > 0)
            .map((split) => ({
              fillId: createdFill.id,
              instructionId: split.instructionId,
              shares: split.shares,
              notional: split.shares * body.price,
            })),
        });
        await tx.order.update({
          where: { id: orderId },
          data: {
            status: OrderStatus.FULLY_FILLED,
            filledQuantity: nextFilled,
            remainingQuantity: 0,
            averageFillPrice: avg,
            fillCompletedAt: new Date(),
          },
        });
        await tx.orderActivity.create({
          data: {
            orderId,
            message: `Fully filled @ $${body.price.toFixed(2)}`,
            actorName: "EMS",
          },
        });
      });
    }

    const updated = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        activities: { orderBy: { createdAt: "asc" } },
        trader: { select: { id: true, name: true, email: true } },
        reviewer: { select: { id: true, name: true } },
        breachLogs: { orderBy: { createdAt: "desc" } },
        fills: {
          orderBy: { sequence: "asc" },
          include: { allocations: true },
        },
      },
    });

    return NextResponse.json({
      order: updated
        ? {
            ...updated,
            limitPrice:
              updated.limitPrice != null ? String(updated.limitPrice) : null,
          }
        : null,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Transition failed" }, { status: 500 });
  }
}
