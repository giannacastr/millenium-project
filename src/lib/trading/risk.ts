import { INITIAL_EXPOSURE, LIMITS, TICKER_META } from "./exposure";

export interface PreTradeImpact {
  singleNameAfter: number;
  sectorAfter: number;
  buyingPowerAfter: number;
  triggeredChecks: string[];
}

export function computePreTradeImpact(input: {
  ticker: string;
  quantity: number;
  limitPrice?: number | null;
  livePrice?: number | null;
}): PreTradeImpact {
  const meta = TICKER_META[input.ticker] ?? {
    sector: "Other",
    price: 100,
  };
  const live =
    input.livePrice != null && input.livePrice > 0 ? input.livePrice : null;
  const price =
    input.limitPrice && input.limitPrice > 0
      ? input.limitPrice
      : live ?? meta.price;
  const notional = Math.max(0, Number(input.quantity)) * price;
  const singleNameAfter =
    (INITIAL_EXPOSURE.topSingleNames.find((p) => p.ticker === input.ticker)
      ?.weight ?? 5) +
    notional / 20_000_000;
  const sectorAfter =
    (INITIAL_EXPOSURE.sectorWeights[
      meta.sector as keyof typeof INITIAL_EXPOSURE.sectorWeights
    ] ?? 12) +
    notional / 35_000_000;
  const buyingPowerAfter =
    INITIAL_EXPOSURE.buyingPowerUsed + notional / 25_000_000;

  const triggeredChecks: string[] = [];
  if (singleNameAfter > LIMITS.singleName) {
    triggeredChecks.push("Single-name concentration");
  }
  if (sectorAfter > LIMITS.sector) {
    triggeredChecks.push("Sector cap");
  }
  if (buyingPowerAfter > LIMITS.buyingPowerUsedPct) {
    triggeredChecks.push("Buying power");
  }

  return {
    singleNameAfter,
    sectorAfter,
    buyingPowerAfter,
    triggeredChecks,
  };
}
