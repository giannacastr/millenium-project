import { auth } from "@/auth";
import { TICKER_META } from "@/lib/trading/exposure";
import { prisma } from "@/lib/db";
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

  // Get restricted tickers to exclude
  const restricted = await prisma.restrictedStock.findMany({ select: { ticker: true } });
  const restrictedSet = new Set(restricted.map((r) => r.ticker.toUpperCase()));

  const key = getFinnhubKey();
  if (!key) {
    // Fallback to embedded meta list when API key missing
    const symbols = Object.entries(TICKER_META)
      .filter(([sym]) => !restrictedSet.has(sym.toUpperCase()))
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
    // Finnhub US exchange list (may be large). Use server-side fetch and filter restricted.
    const res = await fetch(`https://finnhub.io/api/v1/stock/symbol?exchange=US&token=${encodeURIComponent(key)}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`Finnhub HTTP ${res.status}`);
    const data: Array<{ symbol: string; description?: string; type?: string }> = await res.json();

    const symbols = data
      .filter((row) => row.symbol && !restrictedSet.has(row.symbol.toUpperCase()))
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
    // Best-effort fallback to TICKER_META minus restricted
    const symbols = Object.entries(TICKER_META)
      .filter(([sym]) => !restrictedSet.has(sym.toUpperCase()))
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