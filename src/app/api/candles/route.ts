import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { isAllowedQuoteSymbol } from "@/lib/trading/marketQuote";
import { TICKER_META } from "@/lib/trading/exposure";

type TimeRange = "1D" | "1W" | "1M" | "1Y" | "5Y" | "all";

interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createFallbackCandles(symbol: string, range: TimeRange): CandleData[] {
  const basePrice = TICKER_META[symbol]?.price ?? 100;
  const now = Math.floor(Date.now() / 1000);
  const seed = hashString(`${symbol}:${range}`);
  const rand = () => {
    let x = seedValue();
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) % 1000) / 1000;
  };

  let state = seed || 1;
  function seedValue() {
    state = (1664525 * state + 1013904223) >>> 0;
    return state;
  }

  const configByRange: Record<TimeRange, { points: number; stepSec: number; drift: number; vol: number }> = {
    "1D": { points: 78, stepSec: 300, drift: 0.01, vol: 0.35 },
    "1W": { points: 84, stepSec: 3600, drift: 0.02, vol: 0.8 },
    "1M": { points: 60, stepSec: 4 * 3600, drift: 0.03, vol: 1.4 },
    "1Y": { points: 252, stepSec: 24 * 3600, drift: 0.01, vol: 3.2 },
    "5Y": { points: 260, stepSec: 7 * 24 * 3600, drift: 0.015, vol: 6.5 },
    all: { points: 260, stepSec: 30 * 24 * 3600, drift: 0.02, vol: 8 },
  };

  const config = configByRange[range];
  const candles: CandleData[] = [];
  let lastClose = basePrice * (0.985 + rand() * 0.03);
  const start = now - config.points * config.stepSec;

  for (let index = 0; index < config.points; index++) {
    const time = start + index * config.stepSec;
    const seasonal = Math.sin(index / 6) * config.vol * 0.25;
    const noise = (rand() - 0.5) * config.vol;
    const trend = index * config.drift;
    const close = Math.max(1, lastClose + seasonal + noise + trend);
    const open = lastClose;
    const high = Math.max(open, close) + rand() * config.vol * 0.5;
    const low = Math.min(open, close) - rand() * config.vol * 0.5;

    candles.push({
      time,
      open,
      high,
      low: Math.max(1, low),
      close,
      volume: Math.round(500000 + rand() * 7500000),
    });

    lastClose = close;
  }

  return candles;
}

function getFinnhubKey(): string | null {
  const k = process.env.FINNHUB_API_KEY?.trim();
  return k ? k : null;
}

async function finnhubGetJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": "millennium-order-entry/1.0" },
  });
  if (!res.ok) {
    throw new Error(`Finnhub HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

function getResolutionAndDates(range: TimeRange): {
  resolution: string;
  from: number;
  to: number;
} {
  const now = Math.floor(Date.now() / 1000);
  const DAY = 86400;

  switch (range) {
    case "1D": {
      // Last 6.5 hours (intraday), 1-minute resolution
      return {
        resolution: "1",
        from: now - 6.5 * 3600,
        to: now,
      };
    }
    case "1W": {
      // Last 7 days, 5-minute resolution
      return {
        resolution: "5",
        from: now - 7 * DAY,
        to: now,
      };
    }
    case "1M": {
      // Last 30 days, 15-minute resolution
      return {
        resolution: "15",
        from: now - 30 * DAY,
        to: now,
      };
    }
    case "1Y": {
      // Last 365 days, daily resolution
      return {
        resolution: "D",
        from: now - 365 * DAY,
        to: now,
      };
    }
    case "5Y": {
      // Last 5 years, daily resolution
      return {
        resolution: "D",
        from: now - 5 * 365 * DAY,
        to: now,
      };
    }
    case "all":
    default: {
      // All available data, weekly resolution
      return {
        resolution: "W",
        from: now - 50 * 365 * DAY, // ~50 years back as max
        to: now,
      };
    }
  }
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const symbol = req.nextUrl.searchParams.get("symbol")?.trim() ?? "";
  const rangeParam = (req.nextUrl.searchParams.get("range") ?? "1D") as TimeRange;

  if (!symbol) {
    return NextResponse.json({ error: "Missing symbol" }, { status: 400 });
  }

  if (!isAllowedQuoteSymbol(symbol)) {
    return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
  }

  const key = getFinnhubKey();
  if (!key) {
    return NextResponse.json(
      {
        candles: createFallbackCandles(symbol.toUpperCase(), rangeParam),
        range: rangeParam,
        symbol: symbol.toUpperCase(),
        fallback: true,
        message: "Using local fallback candles because FINNHUB_API_KEY is missing",
      },
      {
        headers: {
          "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
        },
      },
    );
  }

  try {
    const { resolution, from, to } = getResolutionAndDates(rangeParam);

    type FinnhubCandleResponse = {
      c?: number[]; // close
      h?: number[]; // high
      l?: number[]; // low
      o?: number[]; // open
      t?: number[]; // time (unix seconds)
      v?: number[]; // volume
      s?: string; // status
    };

    const url = `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${to}&token=${key}`;
    const data = await finnhubGetJson<FinnhubCandleResponse>(url);

    if (data.s === "no_data" || !data.t || !data.c) {
      return NextResponse.json(
        {
          candles: [],
          range: rangeParam,
          symbol,
          message: "No data available for this period",
        },
        {
          headers: {
            "Cache-Control": "private, max-age=60, stale-while-revalidate=120",
          },
        },
      );
    }

    const candles: CandleData[] = [];
    for (let i = 0; i < data.t.length; i++) {
      candles.push({
        time: data.t[i],
        open: data.o?.[i] ?? 0,
        high: data.h?.[i] ?? 0,
        low: data.l?.[i] ?? 0,
        close: data.c?.[i] ?? 0,
        volume: data.v?.[i] ?? 0,
      });
    }

    return NextResponse.json(
      {
        candles,
        range: rangeParam,
        symbol,
      },
      {
        headers: {
          "Cache-Control": "private, max-age=60, stale-while-revalidate=120",
        },
      },
    );
  } catch (err) {
    return NextResponse.json(
      {
        candles: createFallbackCandles(symbol.toUpperCase(), rangeParam),
        range: rangeParam,
        symbol: symbol.toUpperCase(),
        fallback: true,
        message: "Using local fallback candles because Finnhub is unavailable",
      },
      {
        headers: {
          "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
        },
      },
    );
  }
}
