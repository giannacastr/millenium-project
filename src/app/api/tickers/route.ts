import { auth } from "@/auth";
import { TICKER_META } from "@/lib/trading/exposure";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    {
      headers: {
        "Cache-Control": "private, max-age=300, stale-while-revalidate=600",
      },
    },
  );
}