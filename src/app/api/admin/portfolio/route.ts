import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user.isSuper) return forbidden();

  const [holdings, limit, restrictedStocks] = await Promise.all([
    prisma.holding.findMany({ orderBy: { ticker: "asc" } }),
    prisma.riskLimit.findFirst({ orderBy: { id: "desc" } }),
    prisma.restrictedStock.findMany({ orderBy: { ticker: "asc" } }),
  ]);

  return NextResponse.json({
    holdings,
    limits: limit,
    restrictedStocks: restrictedStocks.map((rs) => ({ ticker: rs.ticker, reason: rs.reason })),
  });
}

const upsertSchema = z.object({
  holdings: z
    .array(
      z.object({
        ticker: z
          .string()
          .trim()
          .toUpperCase()
          .min(1)
          .max(16)
          .regex(/^[A-Z][A-Z0-9.\\-]*$/),
        shares: z.number().int().nonnegative(),
      }),
    )
    .min(1),
  limits: z.object({
    singleNameCapPct: z.number().positive(),
    sectorCapPct: z.number().positive(),
    buyingPowerUsedCapPct: z.number().positive(),
    maxOrderNotional: z.number().positive(),
  }),
  restrictedStocks: z
    .array(
      z.object({
        ticker: z
          .string()
          .trim()
          .toUpperCase()
          .min(1)
          .max(16)
          .regex(/^[A-Z][A-Z0-9.\\-]*$/),
        reason: z.string().optional(),
      }),
    )
    .optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user.isSuper) return forbidden();

  let body: z.infer<typeof upsertSchema>;
  try {
    body = upsertSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.holding.deleteMany();
    await tx.holding.createMany({ data: body.holdings });

    const existing = await tx.riskLimit.findFirst({ orderBy: { id: "desc" } });
    if (!existing) {
      await tx.riskLimit.create({
        data: {
          singleNameCapPct: body.limits.singleNameCapPct,
          sectorCapPct: body.limits.sectorCapPct,
          buyingPowerUsedCapPct: body.limits.buyingPowerUsedCapPct,
          maxOrderNotional: body.limits.maxOrderNotional,
        },
      });
    } else {
      await tx.riskLimit.update({
        where: { id: existing.id },
        data: {
          singleNameCapPct: body.limits.singleNameCapPct,
          sectorCapPct: body.limits.sectorCapPct,
          buyingPowerUsedCapPct: body.limits.buyingPowerUsedCapPct,
          maxOrderNotional: body.limits.maxOrderNotional,
        },
      });
    }

    if (body.restrictedStocks) {
      await tx.restrictedStock.deleteMany();
      await tx.restrictedStock.createMany({
        data: body.restrictedStocks.map((rs) => ({
          ticker: rs.ticker,
          reason: rs.reason ?? null,
        })),
      });
    }
  });

  return NextResponse.json({ ok: true });
}

