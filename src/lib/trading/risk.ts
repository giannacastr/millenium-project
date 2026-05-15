import type { OrderDirection } from "@prisma/client";
import { INITIAL_EXPOSURE, LIMITS, TICKER_META } from "./exposure";
import type { ExposureDTO, RiskLimitsDTO } from "./portfolio";

export interface PreTradeImpact {
  singleNameAfter: number;
  sectorAfter: number;
  buyingPowerAfter: number;
  triggeredChecks: string[];
  isRestricted?: boolean;
}

export type PortfolioImpactInput = {
  exposure: ExposureDTO;
  limits: RiskLimitsDTO;
};

function legacyImpact(input: {
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

function portfolioImpact(
  input: {
    ticker: string;
    quantity: number;
    limitPrice?: number | null;
    livePrice?: number | null;
    direction: OrderDirection | "BUY" | "SELL" | "SHORT";
  },
  ctx: PortfolioImpactInput,
): PreTradeImpact {
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
  const sym = input.ticker.toUpperCase();
  const dir = input.direction;

  const { exposure, limits } = ctx;
  const totalValue = Math.max(exposure.totalValue, 0.01);

  const hold = exposure.holdings.find((h) => h.ticker === sym);
  const tickerValue = hold?.value ?? 0;
  const orderSector = hold?.sector ?? meta.sector;

  let sectorValue = 0;
  for (const h of exposure.holdings) {
    if (h.sector === orderSector) sectorValue += h.value;
  }

  let newTickerValue: number;
  let newTotalValue: number;
  let sectorDelta: number;

  if (dir === "BUY") {
    newTickerValue = tickerValue + notional;
    newTotalValue = totalValue + notional;
    sectorDelta = notional;
  } else if (dir === "SELL") {
    const trimmed = Math.min(notional, tickerValue);
    newTickerValue = Math.max(0, tickerValue - notional);
    newTotalValue = Math.max(0.01, totalValue - trimmed);
    sectorDelta = -trimmed;
  } else {
    // SHORT — approximate as additional gross notional in this name.
    newTickerValue = tickerValue + notional;
    newTotalValue = totalValue + notional;
    sectorDelta = notional;
  }

  const singleNameAfter = (newTickerValue / newTotalValue) * 100;
  const newSectorValue = Math.max(0, sectorValue + sectorDelta);
  const sectorAfter = (newSectorValue / newTotalValue) * 100;

  const buyingPower = totalValue * 2;
  const buyingPowerAfter =
    buyingPower > 0
      ? ((exposure.openOrderNotional + notional) / buyingPower) * 100
      : 0;

  const triggeredChecks: string[] = [];
  if (singleNameAfter > limits.singleNameCapPct) {
    triggeredChecks.push("Single-name concentration");
  }
  if (sectorAfter > limits.sectorCapPct) {
    triggeredChecks.push("Sector cap");
  }
  if (buyingPowerAfter > limits.buyingPowerUsedCapPct) {
    triggeredChecks.push("Buying power");
  }
  if (notional > limits.maxOrderNotional) {
    triggeredChecks.push("Max order size");
  }

  return {
    singleNameAfter: Math.round(singleNameAfter * 10) / 10,
    sectorAfter: Math.round(sectorAfter * 10) / 10,
    buyingPowerAfter: Math.round(buyingPowerAfter * 10) / 10,
    triggeredChecks,
  };
}

export function computePreTradeImpact(input: {
  ticker: string;
  quantity: number;
  limitPrice?: number | null;
  livePrice?: number | null;
  direction?: OrderDirection | "BUY" | "SELL" | "SHORT";
  portfolio?: PortfolioImpactInput;
  restrictedStocks?: string[];
}): PreTradeImpact {
  const dir = input.direction ?? "BUY";
  const sym = input.ticker.toUpperCase();
  const isRestricted = input.restrictedStocks?.includes(sym) ?? false;

  let impact: PreTradeImpact;
  if (
    input.portfolio &&
    input.portfolio.exposure.totalValue > 0
  ) {
    impact = portfolioImpact(
      {
        ticker: input.ticker,
        quantity: input.quantity,
        limitPrice: input.limitPrice,
        livePrice: input.livePrice,
        direction: dir,
      },
      input.portfolio,
    );
  } else {
    impact = legacyImpact(input);
  }

  if (isRestricted) {
    impact.triggeredChecks.push("Restricted security");
    impact.isRestricted = true;
  }

  return impact;
}
