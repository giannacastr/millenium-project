import { auth } from "@/auth";
import { fetchMarketQuote } from "@/lib/trading/marketQuote";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const symbol = req.nextUrl.searchParams.get("symbol")?.trim() ?? "";
  if (!symbol) {
    return NextResponse.json({ error: "Missing symbol" }, { status: 400 });
  }

  const quote = await fetchMarketQuote(symbol);
  if ("error" in quote) {
    if (quote.error === "Missing FINNHUB_API_KEY") {
      return NextResponse.json(
        { error: "Server missing FINNHUB_API_KEY" },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { error: quote.error },
      { status: quote.error === "Unknown symbol" ? 400 : 502 },
    );
  }

  return NextResponse.json(
    { quote },
    {
      headers: {
        "Cache-Control": "private, max-age=15, stale-while-revalidate=30",
      },
    },
  );
}
