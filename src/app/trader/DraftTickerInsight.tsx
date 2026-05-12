"use client";

import { useEffect, useMemo, useState } from "react";
import type { MarketQuoteDTO } from "@/lib/trading/marketQuote";

type Props = {
  ticker: string;
  onLastPrice?: (last: number | null) => void;
};

type HeaderPreference = "name-first" | "ticker-first";

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
  const [headerPreference, setHeaderPreference] = useState<HeaderPreference>(() => {
    if (typeof window === "undefined") return "name-first";
    const saved = window.localStorage.getItem("draftTickerInsight.headerPreference");
    return saved === "ticker-first" || saved === "name-first" ? saved : "name-first";
  });
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(
      "draftTickerInsight.headerPreference",
      headerPreference,
    );
  }, [headerPreference]);

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

  const titleText =
    headerPreference === "name-first" ? quote?.companyName ?? quote?.symbol : quote?.symbol;
  const badgeText =
    headerPreference === "name-first" ? quote?.symbol : quote?.companyName ?? quote?.symbol;
  const badgeLabel = headerPreference === "name-first" ? "Ticker" : "Company";

  const headerBadges = useMemo(
    () => [
      { label: badgeLabel, value: badgeText },
      { label: "Sector", value: quote?.sector ?? "—" },
    ],
    [badgeLabel, badgeText, quote?.sector],
  );

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-3 py-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Stock context
            </p>
            <p className="text-xs text-slate-500">
              Live fields from Finnhub. Bid/Ask require paid tier (showing when available).
            </p>
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setSettingsOpen((v) => !v)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Stock context settings"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M10 6a4 4 0 100 8 4 4 0 000-8zm8 4a8 8 0 01-.12 1.38l1.53 1.19-1.9 3.29-1.83-.73a8.2 8.2 0 01-2.39 1.38l-.28 1.95H6.99l-.28-1.95a8.2 8.2 0 01-2.39-1.38l-1.83.73-1.9-3.29 1.53-1.19A8 8 0 012 10c0-.47.04-.93.12-1.38L.59 7.43l1.9-3.29 1.83.73a8.2 8.2 0 012.39-1.38l.28-1.95h6.02l.28 1.95a8.2 8.2 0 012.39 1.38l1.83-.73 1.9 3.29-1.53 1.19c.08.45.12.91.12 1.38z" />
              </svg>
            </button>
            {settingsOpen && (
              <div className="absolute right-0 z-20 mt-2 w-56 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
                <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Header preference
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setHeaderPreference("name-first");
                    setSettingsOpen(false);
                  }}
                  className={`mt-1 flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm hover:bg-slate-50 ${
                    headerPreference === "name-first" ? "bg-slate-50 text-slate-900" : "text-slate-700"
                  }`}
                >
                  <span>Name first</span>
                  <span className="text-xs text-slate-500">Ticker in pill</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHeaderPreference("ticker-first");
                    setSettingsOpen(false);
                  }}
                  className={`mt-1 flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm hover:bg-slate-50 ${
                    headerPreference === "ticker-first" ? "bg-slate-50 text-slate-900" : "text-slate-700"
                  }`}
                >
                  <span>Ticker first</span>
                  <span className="text-xs text-slate-500">Name in pill</span>
                </button>
              </div>
            )}
          </div>
        </div>
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
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xl font-semibold text-slate-900">
                {titleText}
              </span>
              {headerBadges.map((badge) => (
                <span
                  key={badge.label}
                  className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700"
                >
                  {badge.value}
                </span>
              ))}
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
                  [
                    "Vol",
                    quote.volume != null && quote.volume > 0
                      ? fmtVol(quote.volume)
                      : quote.volume === 0
                        ? "0"
                        : "—",
                  ],
                  [
                    "Spread",
                    quote.spread != null
                      ? `$${fmtPx(quote.spread)}`
                      : quote.bid != null && quote.ask != null
                        ? `$${fmtPx(quote.ask - quote.bid)}`
                        : "—",
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

            {(!quote.bid || !quote.ask) && (
              <p className="mt-2 text-[10px] italic text-slate-500">
                Note: Bid/Ask require a paid Finnhub subscription. Last, high, low, and volume are available on the free tier.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
