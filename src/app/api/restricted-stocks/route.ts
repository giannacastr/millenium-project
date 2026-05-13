import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const restrictedStocks = await prisma.restrictedStock.findMany({
    select: { ticker: true },
    orderBy: { ticker: "asc" },
  });

  return NextResponse.json({
    tickers: restrictedStocks.map((rs) => rs.ticker),
  });
}
