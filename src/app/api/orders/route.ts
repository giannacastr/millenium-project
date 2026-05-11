import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { computePreTradeImpact } from "@/lib/trading/risk";
import { computeExposureSnapshot } from "@/lib/trading/portfolio";
import { formatOrderTitle } from "@/lib/trading/order-format";
import {
  OrderDirection,
  OrderStatus,
  OrderTypeEnum,
  UserType,
} from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const orderInclude = {
  activities: { orderBy: { createdAt: "asc" as const } },
  trader: { select: { id: true, name: true, email: true } },
  reviewer: { select: { id: true, name: true } },
  breachLogs: { orderBy: { createdAt: "desc" as const } },
};

function serializeOrder(o: Record<string, unknown> & { limitPrice?: unknown }) {
  return {
    ...o,
    limitPrice: o.limitPrice != null ? String(o.limitPrice) : null,
  };
}

/** Auto-fill any ACKNOWLEDGED orders that have been waiting >= 30 seconds. */
async function autoFillMatureAcknowledgedOrders() {
  const cutoff = new Date(Date.now() - 30_000);
  const due = await prisma.order.findMany({
    where: {
      status: OrderStatus.ACKNOWLEDGED,
      updatedAt: { lte: cutoff },
    },
    select: { id: true },
  });
  if (!due.length) return;

  await prisma.$transaction(async (tx) => {
    for (const row of due) {
      await tx.order.update({
        where: { id: row.id },
        data: { status: OrderStatus.FULLY_FILLED },
      });
      await tx.orderActivity.create({
        data: {
          orderId: row.id,
          message: `Fully filled automatically 30s after broker acknowledgement`,
          actorName: "EMS",
        },
      });
    }
  });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const type = session.user.type as UserType;
  const uid = Number(session.user.id);

  try {
    // Opportunistically run the auto-fill engine on every poll.
    await autoFillMatureAcknowledgedOrders();

    if (type === UserType.EQUITY_TRADER) {
      const rows = await prisma.order.findMany({
        where: { traderId: uid },
        include: orderInclude,
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json({ orders: rows.map(serializeOrder) });
    }

    if (type === UserType.RISK_OFFICER || type === UserType.PRIME_BROKER) {
      const rows = await prisma.order.findMany({
        include: orderInclude,
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json({ orders: rows.map(serializeOrder) });
    }

    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to list orders" }, { status: 500 });
  }
}

const createSchema = z.object({
  direction: z.enum(["BUY", "SELL", "SHORT"]),
  ticker: z.string().min(1).max(16),
  quantity: z.number().int().positive(),
  orderType: z.enum(["MARKET", "LIMIT", "VWAP"]),
  limitPrice: z.number().nullable().optional(),
  account: z.string().min(1),
  strategy: z.string().min(1),
  notes: z.string().optional(),
  mode: z.enum(["draft", "submit"]),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.type !== UserType.EQUITY_TRADER) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: z.infer<typeof createSchema>;
  try {
    body = createSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const traderId = Number(session.user.id);
  const traderName = session.user.name ?? "Trader";

  const direction = body.direction as OrderDirection;
  const orderType = body.orderType as OrderTypeEnum;
  const status =
    body.mode === "draft" ? OrderStatus.DRAFT : OrderStatus.SUBMITTED;

  const snapshot = await computeExposureSnapshot({
    extraSymbols: [body.ticker.toUpperCase()],
  });
  const impact = computePreTradeImpact({
    ticker: body.ticker.toUpperCase(),
    quantity: body.quantity,
    limitPrice: body.limitPrice ?? undefined,
    direction,
    portfolio: snapshot,
  });

  try {
    const maxRow = await prisma.order.findFirst({
      orderBy: { id: "desc" },
      select: { id: true },
    });
    const nextNum = (maxRow?.id ?? 0) + 1;
    const ticketKey = `EQ-${String(nextNum).padStart(3, "0")}`;
    const title = formatOrderTitle(
      direction,
      body.ticker.toUpperCase(),
      body.quantity,
    );

    const order = await prisma.$transaction(async (tx) => {
      const o = await tx.order.create({
        data: {
          ticketKey,
          title,
          direction,
          ticker: body.ticker.toUpperCase(),
          quantity: body.quantity,
          orderType,
          limitPrice:
            body.orderType === "LIMIT" && body.limitPrice != null
              ? String(body.limitPrice)
              : null,
          account: body.account,
          strategy: body.strategy,
          notes: body.notes ?? "",
          status,
          traderId,
        },
      });

      await tx.orderActivity.create({
        data: {
          orderId: o.id,
          message:
            status === OrderStatus.DRAFT
              ? `Draft saved by ${traderName}`
              : `Submitted by ${traderName} · ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
          actorName: traderName,
        },
      });

      if (status === OrderStatus.SUBMITTED && impact.triggeredChecks.length) {
        for (const check of impact.triggeredChecks) {
          await tx.orderActivity.create({
            data: {
              orderId: o.id,
              message: `Risk check flagged: ${check.toLowerCase()} · pending review`,
              actorName: "System",
            },
          });
          await tx.riskBreachLog.create({
            data: {
              orderId: o.id,
              checkType: check,
              breachDetail: "Pre-trade simulation exceeded soft limit",
              resolution: "Pending",
            },
          });
        }
      }

      return tx.order.findUniqueOrThrow({
        where: { id: o.id },
        include: orderInclude,
      });
    });

    return NextResponse.json({ order: serializeOrder(order) });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}
