import { prisma } from "@/lib/db";
import { fetchMarketQuote } from "@/lib/trading/marketQuote";
import { OrderStatus } from "@prisma/client";

export type RiskLimitsDTO = {
  singleNameCapPct: number;
  sectorCapPct: number;
  grossExposureCapPct: number;
  netExposureCapPct: number;
  buyingPowerUsedCapPct: number;
  maxOrderNotional: number;
};

export type ExposureDTO = {
  grossExposure: number;
  netExposure: number;
  buyingPowerUsed: number;
  buyingPowerRemaining: string;
  sectorWeights: Record<string, number>;
  topSingleNames: { ticker: string; weight: number }[];
  holdings: { ticker: string; shares: number; sector: string; price: number; value: number }[];
  openOrderNotional: number;
  totalValue: number;
};

function fmtDollars(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}MM`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toFixed(0)}`;
}

function pct(n: number): number {
  return Math.round(n * 10) / 10;
}

export async function getRiskLimits(): Promise<RiskLimitsDTO> {
  const row = await prisma.riskLimit.findFirst({ orderBy: { id: "desc" } });
  return {
    singleNameCapPct: row?.singleNameCapPct ?? 10,
    sectorCapPct: row?.sectorCapPct ?? 30,
    grossExposureCapPct: row?.grossExposureCapPct ?? 180,
    netExposureCapPct: row?.netExposureCapPct ?? 70,
    buyingPowerUsedCapPct: row?.buyingPowerUsedCapPct ?? 90,
    maxOrderNotional: row?.maxOrderNotional ?? 5_000_000,
  };
}

export async function computeExposureSnapshot(opts?: {
  extraSymbols?: string[];
}): Promise<{
  exposure: ExposureDTO;
  limits: RiskLimitsDTO;
}> {
  const [holdings, limits, orders] = await Promise.all([
    prisma.holding.findMany({ orderBy: { ticker: "asc" } }),
    getRiskLimits(),
    prisma.order.findMany({
      where: {
        status: {
          in: [
            OrderStatus.SUBMITTED,
            OrderStatus.IN_REVIEW,
            OrderStatus.RISK_APPROVED,
            OrderStatus.ACKNOWLEDGED,
            OrderStatus.PARTIALLY_FILLED,
          ],
        },
      },
      select: {
        ticker: true,
        quantity: true,
        orderType: true,
        limitPrice: true,
      },
    }),
  ]);

  const symbols = new Set<string>();
  for (const h of holdings) symbols.add(h.ticker.toUpperCase());
  for (const o of orders) symbols.add(o.ticker.toUpperCase());
  for (const s of opts?.extraSymbols ?? []) {
    const u = s.trim().toUpperCase();
    if (u) symbols.add(u);
  }

  const quoteEntries = await Promise.all(
    [...symbols].map(async (sym) => {
      const q = await fetchMarketQuote(sym);
      if ("error" in q) return [sym, null] as const;
      return [sym, q] as const;
    }),
  );
  const quoteBySymbol = new Map(quoteEntries);

  const holdingsEnriched = holdings.map((h) => {
    const sym = h.ticker.toUpperCase();
    const q = quoteBySymbol.get(sym);
    const price = q && !("error" in q) ? q.last : 0;
    const sector = q && !("error" in q) ? q.sector : "—";
    const value = h.shares * price;
    return { ticker: sym, shares: h.shares, sector, price, value };
  });

  const totalValue = holdingsEnriched.reduce((sum, h) => sum + h.value, 0);

  const singleName = holdingsEnriched
    .map((h) => ({
      ticker: h.ticker,
      weight: totalValue > 0 ? pct((h.value / totalValue) * 100) : 0,
    }))
    .sort((a, b) => b.weight - a.weight);

  const sectorTotals = new Map<string, number>();
  for (const h of holdingsEnriched) {
    sectorTotals.set(h.sector, (sectorTotals.get(h.sector) ?? 0) + h.value);
  }
  const sectorWeights: Record<string, number> = {};
  for (const [sector, val] of sectorTotals.entries()) {
    sectorWeights[sector] = totalValue > 0 ? pct((val / totalValue) * 100) : 0;
  }

  // Open order notional is a rough reservation of capital; fills update holdings later.
  let openOrderNotional = 0;
  for (const o of orders) {
    const sym = o.ticker.toUpperCase();
    const q = quoteBySymbol.get(sym);
    const live = q && !("error" in q) ? q.last : 0;
    const px =
      o.orderType === "LIMIT" && o.limitPrice != null
        ? Number(o.limitPrice)
        : live;
    openOrderNotional += Math.max(0, o.quantity) * (Number.isFinite(px) ? px : 0);
  }

  // For now, assume a simple 2x leverage buying-power model: BP = 2 * equity.
  const equity = totalValue;
  const buyingPower = equity * 2;
  const buyingPowerUsed = buyingPower > 0 ? (openOrderNotional / buyingPower) * 100 : 0;
  const buyingPowerRemaining = buyingPower - openOrderNotional;

  // This system currently models long-only holdings; gross/net are both ~100% by definition.
  const grossExposure = 100;
  const netExposure = 100;

  return {
    limits,
    exposure: {
      grossExposure,
      netExposure,
      buyingPowerUsed: pct(buyingPowerUsed),
      buyingPowerRemaining: fmtDollars(buyingPowerRemaining),
      sectorWeights,
      topSingleNames: singleName.slice(0, 20),
      holdings: holdingsEnriched,
      openOrderNotional,
      totalValue,
    },
  };
}

