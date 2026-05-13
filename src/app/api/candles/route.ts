import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { isAllowedQuoteSymbol } from "@/lib/trading/marketQuote";

type TimeRange = "1D" | "1W" | "1M" | "1Y" | "5Y" | "all";

interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
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
      { error: "Server missing FINNHUB_API_KEY" },
      { status: 500 },
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
    console.error("Error fetching candles:", err);
    return NextResponse.json(
      { error: "Failed to fetch candle data" },
      { status: 502 },
    );
  }
}
