"use client";

import { useEffect, useState } from "react";
import type { MarketQuoteDTO } from "@/lib/trading/marketQuote";

type Props = {
  ticker: string;
  onLastPrice?: (last: number | null) => void;
};

function fmtVol(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return String(n);
}

function fmtPx(n: number | null, digits = 2): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export default function DraftTickerInsight({ ticker, onLastPrice }: Props) {
  const [quote, setQuote] = useState<MarketQuoteDTO | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const sym = ticker.toUpperCase();

    async function run() {
      setLoading(true);
      setErr(null);
      setQuote(null);
      onLastPrice?.(null);
      try {
        const res = await fetch(
          `/api/quotes?symbol=${encodeURIComponent(sym)}`,
          { cache: "no-store" },
        );
        const data = await res.json();
        if (!res.ok) {
          if (!cancelled) setErr(data.error ?? "Could not load quote");
          return;
        }
        if (!cancelled) {
          const q = (data.quote ?? null) as MarketQuoteDTO | null;
          setQuote(q);
          onLastPrice?.(q?.last ?? null);
        }
      } catch {
        if (!cancelled) setErr("Network error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [ticker, onLastPrice]);

  const sessionUp =
    quote?.sessionChangePct != null && quote.sessionChangePct >= 0;
  const priorUp =
    quote?.changeVsPriorClosePct != null && quote.changeVsPriorClosePct >= 0;

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Stock context
        </p>
        <p className="text-xs text-slate-500">
          Live fields from the quote API (NBBO when available).
        </p>
      </div>

      <div className="p-3">
        {loading && (
          <p className="py-6 text-center text-sm text-slate-500">Loading quote…</p>
        )}
        {!loading && err && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {err}
          </p>
        )}
        {!loading && !err && quote && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-xl font-semibold tabular-nums text-slate-900">
                {quote.symbol}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                {quote.sector}
              </span>
            </div>

            <div className="flex flex-wrap gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Last
                </p>
                <p className="font-mono text-lg font-semibold tabular-nums text-slate-900">
                  ${fmtPx(quote.last)}
                </p>
                {quote.sessionChangePct != null &&
                  quote.sessionChangeAbs != null && (
                    <p
                      className={`font-mono text-xs tabular-nums ${
                        sessionUp ? "text-emerald-700" : "text-rose-700"
                      }`}
                    >
                      {sessionUp ? "+" : ""}
                      {quote.sessionChangeAbs.toFixed(2)} (
                      {sessionUp ? "+" : ""}
                      {quote.sessionChangePct.toFixed(2)}% since open)
                    </p>
                  )}
                {quote.changeVsPriorClosePct != null && (
                  <p
                    className={`mt-0.5 font-mono text-[11px] tabular-nums ${
                      priorUp ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {priorUp ? "+" : ""}
                    {quote.changeVsPriorClosePct.toFixed(2)}% vs prior close
                  </p>
                )}
              </div>

              <div className="flex min-w-[140px] flex-1 flex-col gap-1.5">
                <div className="rounded-lg border border-slate-200 border-l-4 border-l-rose-400 bg-slate-50 px-2.5 py-1.5">
                  <p className="text-[10px] font-semibold uppercase text-rose-700">
                    Ask
                  </p>
                  <p className="font-mono text-sm font-medium tabular-nums text-slate-900">
                    ${fmtPx(quote.ask)}
                  </p>
                  {quote.askSize != null && (
                    <p className="font-mono text-[10px] tabular-nums text-slate-500">
                      Size {quote.askSize.toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="rounded-lg border border-slate-200 border-l-4 border-l-emerald-500 bg-slate-50 px-2.5 py-1.5">
                  <p className="text-[10px] font-semibold uppercase text-emerald-800">
                    Bid
                  </p>
                  <p className="font-mono text-sm font-medium tabular-nums text-slate-900">
                    ${fmtPx(quote.bid)}
                  </p>
                  {quote.bidSize != null && (
                    <p className="font-mono text-[10px] tabular-nums text-slate-500">
                      Size {quote.bidSize.toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 sm:grid-cols-4">
              {(
                [
                  ["High", quote.high != null ? `$${fmtPx(quote.high)}` : "—"],
                  ["Low", quote.low != null ? `$${fmtPx(quote.low)}` : "—"],
                  ["Vol", quote.volume != null ? fmtVol(quote.volume) : "—"],
                  [
                    "Spread",
                    quote.spread != null ? `$${fmtPx(quote.spread)}` : "—",
                  ],
                ] as const
              ).map(([label, val]) => (
                <div key={label} className="rounded-lg bg-slate-50 px-2 py-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    {label}
                  </p>
                  <p className="font-mono text-sm font-semibold tabular-nums text-slate-900">
                    {val}
                  </p>
                </div>
              ))}
            </div>

            {quote.asOf && (
              <p className="text-[10px] text-slate-400">
                As of {new Date(quote.asOf).toLocaleString()}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
