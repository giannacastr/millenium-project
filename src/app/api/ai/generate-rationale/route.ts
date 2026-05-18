import { auth } from "@/auth";
import { fetchMarketQuote } from "@/lib/trading/marketQuote";
import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "",
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { ticker?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const ticker = (body.ticker ?? "").trim().toUpperCase();
  if (!ticker || ticker.length > 16) {
    return NextResponse.json({ error: "Invalid ticker" }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY not configured. Add it to .env to use this feature." },
      { status: 503 },
    );
  }

  let marketContext = "";
  try {
    const quote = await fetchMarketQuote(ticker);
    if (!("error" in quote)) {
      marketContext = `Current price: $${quote.last}. Day range: $${quote.low}–$${quote.high}.`;
    }
  } catch {
    // non-blocking — proceed without market data
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a fundamental equity research analyst. Write a concise short-selling rationale (2–4 sentences) for the given stock ticker. Include a clear thesis (why the stock may be overvalued or facing headwinds) and a cover-trigger condition (what would force covering). Be specific but do not fabricate numerical data. Sign off with your name as 'AI Analyst'.",
        },
        {
          role: "user",
          content: `Write a short-selling rationale for ${ticker}. ${marketContext}`,
        },
      ],
      temperature: 0.4,
      max_tokens: 300,
    });

    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) {
      return NextResponse.json({ error: "AI returned empty response" }, { status: 502 });
    }

    return NextResponse.json({ rationale: text });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[ai/generate-rationale]", message);
    return NextResponse.json(
      { error: `AI request failed: ${message}` },
      { status: 502 },
    );
  }
}
