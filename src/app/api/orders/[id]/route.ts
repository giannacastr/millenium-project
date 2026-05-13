import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { formatOrderTitle } from "@/lib/trading/order-format";
import {
  allocationWeightTotal,
  formatAllocationSummary,
  normalizeAllocationDrafts,
} from "@/lib/trading/allocation";
import {
  OrderDirection,
  OrderStatus,
  OrderTypeEnum,
  UserType,
} from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const allocationDraftSchema = z.object({
  account: z.string().min(1),
  weightPct: z.number().positive(),
});

const patchDraftSchema = z.object({
  direction: z.enum(["BUY", "SELL", "SHORT"]).optional(),
  ticker: z.string().min(1).max(16).optional(),
  quantity: z.number().int().positive().optional(),
  orderType: z.enum(["MARKET", "LIMIT", "VWAP"]).optional(),
  limitPrice: z.number().nullable().optional(),
  account: z.string().min(1).optional(),
  allocations: z.array(allocationDraftSchema).optional(),
  strategy: z.string().min(1).optional(),
  notes: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || session.user.type !== UserType.EQUITY_TRADER) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const orderId = Number(id);
  const uid = Number(session.user.id);

  let body: z.infer<typeof patchDraftSchema>;
  try {
    body = patchDraftSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const existing = await prisma.order.findUnique({ where: { id: orderId } });
  if (!existing || existing.traderId !== uid) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.status !== OrderStatus.DRAFT) {
    return NextResponse.json({ error: "Only drafts editable" }, { status: 400 });
  }

  const direction = (body.direction ?? existing.direction) as OrderDirection;
  const ticker = (body.ticker ?? existing.ticker).toUpperCase();
  const quantity = body.quantity ?? existing.quantity;
  const orderType = (body.orderType ?? existing.orderType) as OrderTypeEnum;
  const limitPrice =
    body.limitPrice !== undefined
      ? body.limitPrice != null
        ? String(body.limitPrice)
        : null
      : existing.limitPrice != null
        ? String(existing.limitPrice)
        : null;

  const title = formatOrderTitle(direction, ticker, quantity);
  const allocations =
    body.allocations && body.allocations.length > 0
      ? normalizeAllocationDrafts(
          body.allocations.map((allocation) => ({
            id: `alloc-${Math.random().toString(36).slice(2, 10)}`,
            account: allocation.account,
            weightPct: String(allocation.weightPct),
          })),
        )
      : normalizeAllocationDrafts(
          [{ id: "legacy", account: body.account ?? existing.account, weightPct: "100" }],
        );
  if (Math.abs(allocationWeightTotal(allocations) - 100) > 0.01) {
    return NextResponse.json({ error: "Allocation splits must total 100%" }, { status: 400 });
  }
  const accountSummary = formatAllocationSummary(allocations);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.orderAllocationInstruction.deleteMany({ where: { orderId } });
    await tx.orderAllocationInstruction.createMany({
      data: allocations.map((allocation, index) => ({
        orderId,
        sequence: index + 1,
        account: allocation.account,
        weightPct: allocation.weightPct,
      })),
    });

    return tx.order.update({
      where: { id: orderId },
      data: {
        direction,
        ticker,
        quantity,
        orderType,
        limitPrice:
          orderType === "LIMIT" && limitPrice != null ? limitPrice : null,
        account: accountSummary,
        strategy: body.strategy ?? existing.strategy,
        notes: body.notes ?? existing.notes,
        title,
        filledQuantity: 0,
        remainingQuantity: quantity,
        averageFillPrice: null,
        fillStartedAt: null,
        fillCompletedAt: null,
        allocationLockedAt: null,
      },
      include: {
        activities: { orderBy: { createdAt: "asc" } },
        trader: { select: { id: true, name: true, email: true } },
        breachLogs: true,
        allocationInstructions: { orderBy: { sequence: "asc" } },
        fills: { orderBy: { sequence: "asc" } },
      },
    });
  });

  return NextResponse.json({
    order: {
      ...updated,
      limitPrice:
        updated.limitPrice != null ? String(updated.limitPrice) : null,
    },
  });
}
