import YahooFinance from "yahoo-finance2";
import { TICKER_META } from "@/lib/trading/exposure";

const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
});

export type MarketQuoteDTO = {
  symbol: string;
  sector: string;
  last: number;
  /** Session return from regular open → last (day so far). */
  sessionChangePct: number | null;
  sessionChangeAbs: number | null;
  /** Yahoo’s day change vs prior close (included for context). */
  changeVsPriorClosePct: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
  bid: number | null;
  ask: number | null;
  bidSize: number | null;
  askSize: number | null;
  spread: number | null;
  currency: string;
  asOf: string | null;
};

export function isAllowedQuoteSymbol(symbol: string): boolean {
  return Object.prototype.hasOwnProperty.call(TICKER_META, symbol.toUpperCase());
}

export async function fetchMarketQuote(
  symbol: string,
): Promise<MarketQuoteDTO | { error: string }> {
  const sym = symbol.toUpperCase();
  if (!isAllowedQuoteSymbol(sym)) {
    return { error: "Unknown symbol" };
  }

  try {
    const [q, summary] = await Promise.all([
      yahooFinance.quote(sym),
      yahooFinance.quoteSummary(sym, { modules: ["assetProfile"] }),
    ]);

    const price = q.regularMarketPrice;
    const open = q.regularMarketOpen;
    if (price == null || typeof price !== "number") {
      return { error: "No price in quote response" };
    }

    let sessionChangePct: number | null = null;
    let sessionChangeAbs: number | null = null;
    if (open != null && typeof open === "number" && open > 0) {
      sessionChangeAbs = price - open;
      sessionChangePct = (sessionChangeAbs / open) * 100;
    }

    const bid = q.bid != null && typeof q.bid === "number" ? q.bid : null;
    const ask = q.ask != null && typeof q.ask === "number" ? q.ask : null;
    let spread: number | null = null;
    if (
      bid != null &&
      ask != null &&
      ask > 0 &&
      bid > 0 &&
      ask >= bid
    ) {
      spread = Math.round((ask - bid) * 100) / 100;
    }

    const sectorFromApi =
      summary.assetProfile?.sectorDisp ??
      summary.assetProfile?.sector ??
      null;
    const sector = sectorFromApi ?? TICKER_META[sym]?.sector ?? "—";

    const vol =
      q.regularMarketVolume != null &&
      typeof q.regularMarketVolume === "number"
        ? q.regularMarketVolume
        : null;

    const asOf =
      q.regularMarketTime instanceof Date
        ? q.regularMarketTime.toISOString()
        : q.regularMarketTime != null
          ? new Date(q.regularMarketTime * 1000).toISOString()
          : null;

    return {
      symbol: sym,
      sector,
      last: price,
      sessionChangePct,
      sessionChangeAbs,
      changeVsPriorClosePct:
        q.regularMarketChangePercent != null &&
        typeof q.regularMarketChangePercent === "number"
          ? q.regularMarketChangePercent
          : null,
      high:
        q.regularMarketDayHigh != null &&
        typeof q.regularMarketDayHigh === "number"
          ? q.regularMarketDayHigh
          : null,
      low:
        q.regularMarketDayLow != null &&
        typeof q.regularMarketDayLow === "number"
          ? q.regularMarketDayLow
          : null,
      volume: vol,
      bid,
      ask,
      bidSize:
        q.bidSize != null && typeof q.bidSize === "number" ? q.bidSize : null,
      askSize:
        q.askSize != null && typeof q.askSize === "number" ? q.askSize : null,
      spread,
      currency: q.currency ?? "USD",
      asOf,
    };
  } catch (e) {
    console.error("fetchMarketQuote", e);
    return { error: "Quote unavailable — try again shortly." };
  }
}
