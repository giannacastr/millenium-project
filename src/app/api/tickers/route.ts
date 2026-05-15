import { auth } from "@/auth";
import { TICKER_META } from "@/lib/trading/exposure";
import { NextResponse } from "next/server";

function getFinnhubKey(): string | null {
  const k = process.env.FINNHUB_API_KEY?.trim();
  return k ? k : null;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = getFinnhubKey();
  if (!key) {
    const symbols = Object.entries(TICKER_META)
      .map(([symbol, meta]) => ({
        symbol,
        companyName: meta.companyName,
        sector: meta.sector,
        price: meta.price,
      }))
      .sort((a, b) => a.symbol.localeCompare(b.symbol));

    return NextResponse.json(
      { symbols },
      { headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=600" } },
    );
  }

  try {
    const res = await fetch(`https://finnhub.io/api/v1/stock/symbol?exchange=US&token=${encodeURIComponent(key)}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`Finnhub HTTP ${res.status}`);
    const data: Array<{ symbol: string; description?: string; type?: string }> = await res.json();

    const symbols = data
      .filter((row) => row.symbol)
      .map((row) => ({
        symbol: row.symbol,
        companyName: row.description ?? row.symbol,
        sector: TICKER_META[row.symbol]?.sector ?? "Other",
        price: TICKER_META[row.symbol]?.price ?? 0,
      }))
      .sort((a, b) => a.symbol.localeCompare(b.symbol));

    return NextResponse.json({ symbols }, { headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=600" } });
  } catch (e) {
    console.error("/api/tickers failed to fetch Finnhub list", e);
    const symbols = Object.entries(TICKER_META)
      .map(([symbol, meta]) => ({
        symbol,
        companyName: meta.companyName,
        sector: meta.sector,
        price: meta.price,
      }))
      .sort((a, b) => a.symbol.localeCompare(b.symbol));

    return NextResponse.json({ symbols }, { headers: { "Cache-Control": "private, max-age=60" } });
  }
}