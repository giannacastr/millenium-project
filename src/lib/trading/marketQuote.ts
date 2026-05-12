import { TICKER_META } from "@/lib/trading/exposure";

export type MarketQuoteDTO = {
  symbol: string;
  companyName: string;
  sector: string;
  last: number;
  /** Session return from regular open → last (day so far). */
  sessionChangePct: number | null;
  sessionChangeAbs: number | null;
  /** Change vs previous close (context). */
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

function getFinnhubKey(): string | null {
  const k = process.env.FINNHUB_API_KEY?.trim();
  return k ? k : null;
}

export function isAllowedQuoteSymbol(symbol: string): boolean {
  // Allow any reasonable equity symbol; UI dropdown may be narrower.
  return /^[A-Z][A-Z0-9.\-]{0,15}$/.test(symbol.toUpperCase());
}

async function finnhubGetJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    // Avoid caching on the server; the route handler sets its own cache headers.
    cache: "no-store",
    headers: { "User-Agent": "millennium-order-entry/1.0" },
  });
  if (!res.ok) {
    throw new Error(`Finnhub HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function fetchMarketQuote(
  symbol: string,
): Promise<MarketQuoteDTO | { error: string }> {
  const sym = symbol.toUpperCase();
  if (!isAllowedQuoteSymbol(sym)) {
    return { error: "Unknown symbol" };
  }

  const key = getFinnhubKey();
  if (!key) {
    return { error: "Missing FINNHUB_API_KEY" };
  }

  try {
    type FinnhubQuote = {
      c: number; // current
      h: number; // high
      l: number; // low
      o: number; // open
      pc: number; // previous close
      t: number; // timestamp (unix seconds)
      v: number; // volume
    };
    type FinnhubProfile2 = {
      name?: string;
      finnhubIndustry?: string;
    };
    type FinnhubBidAsk = {
      b?: number; // bid
      a?: number; // ask
      // other fields exist but aren't required here
    };

    const [q, profile, bidAsk] = await Promise.all([
      finnhubGetJson<FinnhubQuote>(
        `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${encodeURIComponent(key)}`,
      ),
      finnhubGetJson<FinnhubProfile2>(
        `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(sym)}&token=${encodeURIComponent(key)}`,
      ).catch(() => ({} as FinnhubProfile2)),
      finnhubGetJson<FinnhubBidAsk>(
        `https://finnhub.io/api/v1/stock/bidask?symbol=${encodeURIComponent(sym)}&token=${encodeURIComponent(key)}`,
      ).catch(() => ({} as FinnhubBidAsk)),
    ]);

    // Diagnostic: log what fields Finnhub returned
    if (typeof window === "undefined") {
      // Server-side only
      console.log(`[Finnhub ${sym}] quote fields:`, {
        c: q.c,
        h: q.h,
        l: q.l,
        o: q.o,
        pc: q.pc,
        v: q.v,
      });
      if (bidAsk.b != null || bidAsk.a != null) {
        console.log(`[Finnhub ${sym}] bidAsk fields:`, { b: bidAsk.b, a: bidAsk.a });
      } else {
        console.log(`[Finnhub ${sym}] bidAsk: not available (free tier limitation)`);
      }
    }

    const price = typeof q.c === "number" && q.c > 0 ? q.c : null;
    const open = typeof q.o === "number" && q.o > 0 ? q.o : null;
    if (price == null) {
      return { error: "No price in quote response" };
    }

    let sessionChangePct: number | null = null;
    let sessionChangeAbs: number | null = null;
    if (open != null && open > 0) {
      sessionChangeAbs = price - open;
      sessionChangePct = (sessionChangeAbs / open) * 100;
    }

    const bid =
      bidAsk.b != null && typeof bidAsk.b === "number" && bidAsk.b > 0
        ? bidAsk.b
        : null;
    const ask =
      bidAsk.a != null && typeof bidAsk.a === "number" && bidAsk.a > 0
        ? bidAsk.a
        : null;
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

    const sector =
      profile.finnhubIndustry?.trim() ||
      TICKER_META[sym]?.sector ||
      "—";
    const companyName = profile.name?.trim() || sym;

    const vol = typeof q.v === "number" && q.v >= 0 ? q.v : null;
    const asOf =
      typeof q.t === "number" && q.t > 0 ? new Date(q.t * 1000).toISOString() : null;

    return {
      symbol: sym,
      companyName,
      sector,
      last: price,
      sessionChangePct,
      sessionChangeAbs,
      changeVsPriorClosePct:
        typeof q.pc === "number" && q.pc > 0
          ? ((price - q.pc) / q.pc) * 100
          : null,
      high: typeof q.h === "number" && q.h > 0 ? q.h : null,
      low: typeof q.l === "number" && q.l > 0 ? q.l : null,
      volume: vol,
      bid,
      ask,
      bidSize: null,
      askSize: null,
      spread,
      currency: "USD",
      asOf,
    };
  } catch (e) {
    console.error("fetchMarketQuote", e);
    return { error: "Quote unavailable — try again shortly." };
  }
}
