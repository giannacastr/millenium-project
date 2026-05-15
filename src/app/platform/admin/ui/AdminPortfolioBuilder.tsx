"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { signOut } from "next-auth/react";
import { TICKER_META } from "@/lib/trading/exposure";
import AdminOrdersView from "./AdminOrdersView";

type HoldingRow = { ticker: string; shares: number };
type RestrictedStockRow = { ticker: string; reason?: string };
type LimitsRow = {
  singleNameCapPct: number;
  sectorCapPct: number;
  buyingPowerUsedCapPct: number;
  maxOrderNotional: number;
};

const DEFAULT_LIMITS: LimitsRow = {
  singleNameCapPct: 10,
  sectorCapPct: 30,
  buyingPowerUsedCapPct: 90,
  maxOrderNotional: 5_000_000,
};

export default function AdminPortfolioBuilder() {
  const [holdings, setHoldings] = useState<HoldingRow[]>([]);
  const [limits, setLimits] = useState<LimitsRow>(DEFAULT_LIMITS);
  const [restrictedStocks, setRestrictedStocks] = useState<RestrictedStockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [tab, setTab] = useState<"portfolio" | "orders">("portfolio");
  const [restrictedTickerQuery, setRestrictedTickerQuery] = useState("");
  const [restrictedTickerDropdownOpen, setRestrictedTickerDropdownOpen] = useState(false);
  const [activeRestrictedIdx, setActiveRestrictedIdx] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/admin/portfolio", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to load admin data");
      return;
    }
    setHoldings((data.holdings ?? []).map((h: any) => ({ ticker: h.ticker, shares: h.shares })));
    if (data.limits) {
      setLimits({
        singleNameCapPct: data.limits.singleNameCapPct ?? 10,
        sectorCapPct: data.limits.sectorCapPct ?? 30,
        buyingPowerUsedCapPct: data.limits.buyingPowerUsedCapPct ?? 90,
        maxOrderNotional: data.limits.maxOrderNotional ?? 5_000_000,
      });
    }
    setRestrictedStocks((data.restrictedStocks ?? []).map((rs: any) => ({ ticker: rs.ticker, reason: rs.reason })));
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const canSave = useMemo(() => holdings.length > 0 && !saving, [holdings.length, saving]);

  const tickerOptions = useMemo(
    () => Object.keys(TICKER_META).sort(),
    []
  );

  const filteredRestrictedTickers = useMemo(() => {
    const query = restrictedTickerQuery.trim().toUpperCase();
    if (!query) return tickerOptions;
    return tickerOptions.filter((t) => t.includes(query));
  }, [restrictedTickerQuery, tickerOptions]);

  async function save() {
    setSaving(true);
    setError(null);
    setSavedAt(null);
    try {
      const res = await fetch("/api/admin/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          holdings: holdings
            .map((h) => ({ ticker: h.ticker.trim().toUpperCase(), shares: Number(h.shares) }))
            .filter((h) => h.ticker && Number.isFinite(h.shares)),
          limits,
          restrictedStocks: restrictedStocks
            .map((rs) => ({ ticker: rs.ticker.trim().toUpperCase(), reason: rs.reason ?? undefined }))
            .filter((rs) => rs.ticker),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Save failed");
        return;
      }
      setSavedAt(new Date().toLocaleTimeString());
      await load();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b-[4.5px] border-[#1434CB] bg-white">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-xs uppercase text-slate-500">Millennium · Admin</p>
            <h1 className="text-xl font-semibold text-slate-900">
              Portfolio builder
            </h1>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => signOut({ redirectTo: "/signIn" })}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              Sign out
            </button>
            <img src="/images/logo-mlp.png" alt="Millennium" className="ml-3 h-5 w-auto mt-2" />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6">
        {error && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
            {error}
          </div>
        )}
        {savedAt && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900">
            Saved at {savedAt}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => setTab("portfolio")}
            className={`rounded-md px-3 py-2 text-sm ${tab === "portfolio" ? "bg-white/90 text-slate-900" : "bg-white/10 text-slate-600"}`}
          >
            Portfolio
          </button>
          <button
            onClick={() => setTab("orders")}
            className={`rounded-md px-3 py-2 text-sm ${tab === "orders" ? "bg-white/90 text-slate-900" : "bg-white/10 text-slate-600"}`}
          >
            Orders
          </button>
        </div>

        {tab === "portfolio" ? (
          <>
            <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-900">Initial portfolio</h2>
                <p className="mt-0.5 text-sm text-slate-600">
                  Add tickers and share counts. This becomes the starting state for
                  all exposure and risk calculations.
                </p>
              </div>
              <div className="overflow-x-auto p-4">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Ticker</th>
                      <th className="px-3 py-2 text-right">Shares</th>
                      <th className="px-3 py-2 text-right">Value ($)</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                          Loading…
                        </td>
                      </tr>
                    ) : holdings.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                          No holdings yet.
                        </td>
                      </tr>
                    ) : (
                      holdings.map((h, idx) => {
                        const price = TICKER_META[h.ticker]?.price ?? 0;
                        const value = h.shares * price;
                        return (
                        <tr key={`${h.ticker}-${idx}`} className="border-t border-slate-100">
                          <td className="px-3 py-2">
                            <input
                              value={h.ticker}
                              onChange={(e) =>
                                setHoldings((prev) =>
                                  prev.map((r, i) => (i === idx ? { ...r, ticker: e.target.value } : r)),
                                )
                              }
                              className="w-28 rounded border border-slate-300 px-2 py-1 font-mono text-xs"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              value={h.shares}
                              onChange={(e) =>
                                setHoldings((prev) =>
                                  prev.map((r, i) => (i === idx ? { ...r, shares: Number(e.target.value) } : r)),
                                )
                              }
                              className="w-40 rounded border border-slate-300 px-2 py-1 text-right font-mono text-xs"
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs text-slate-700">
                            {price > 0 ? `$${value.toLocaleString()}` : "—"}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              className="rounded-lg bg-slate-100 px-3 py-1 text-xs text-slate-700 hover:bg-slate-200"
                              onClick={() => setHoldings((prev) => prev.filter((_, i) => i !== idx))}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
                <div className="mt-3 flex justify-between">
                  <button
                    type="button"
                    className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white"
                    onClick={() => setHoldings((prev) => [...prev, { ticker: "MSFT", shares: 1000 }])}
                  >
                    Add row
                  </button>
                  {holdings.length > 0 && (
                    <span className="self-center text-right text-sm text-slate-700">
                      Total:{" "}
                      <strong className="font-mono">
                        ${holdings.reduce((sum, h) => sum + h.shares * (TICKER_META[h.ticker]?.price ?? 0), 0).toLocaleString()}
                      </strong>
                    </span>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-900">Risk limits</h2>
                <p className="mt-0.5 text-sm text-slate-600">
                  Limits are applied to pre-trade checks and exposure dashboards.
                </p>
              </div>
              <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Single-name cap (%)", "singleNameCapPct"],
                  ["Sector cap (%)", "sectorCapPct"],
                  ["Buying power used cap (%)", "buyingPowerUsedCapPct"],
                  ["Max order notional ($)", "maxOrderNotional"],
                ].map(([label, key]) => (
                  <label key={key} className="block text-sm">
                    <span className="text-slate-600">{label}</span>
                    <input
                      type="number"
                      value={(limits as any)[key]}
                      onChange={(e) =>
                        setLimits((prev) => ({
                          ...prev,
                          [key]: Number(e.target.value),
                        }))
                      }
                      className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-mono text-sm"
                    />
                  </label>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-900">Restricted list</h2>
                <p className="mt-0.5 text-sm text-slate-600">
                  Securities the fund is legally prohibited from trading. Orders for these stocks will be flagged in pre-trade checks.
                </p>
              </div>
              <div className="overflow-x-auto p-4">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Ticker</th>
                      <th className="px-3 py-2">Reason</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {restrictedStocks.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-6 text-center text-slate-500">
                          No restricted stocks yet.
                        </td>
                      </tr>
                    ) : (
                      restrictedStocks.map((rs, idx) => (
                        <tr key={`${rs.ticker}-${idx}`} className="border-t border-slate-100">
                          <td className="px-3 py-2">
                            <div className="relative">
                              <input
                                value={rs.ticker}
                                onChange={(e) => {
                                  setRestrictedStocks((prev) =>
                                    prev.map((r, i) => (i === idx ? { ...r, ticker: e.target.value.toUpperCase() } : r)),
                                  );
                                  setRestrictedTickerQuery(e.target.value);
                                  setActiveRestrictedIdx(idx);
                                  setRestrictedTickerDropdownOpen(true);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && rs.ticker) {
                                    setRestrictedTickerDropdownOpen(false);
                                    setRestrictedTickerQuery("");
                                  } else if (e.key === "Escape") {
                                    setRestrictedTickerDropdownOpen(false);
                                    setRestrictedTickerQuery("");
                                  }
                                }}
                                onFocus={() => {
                                  setActiveRestrictedIdx(idx);
                                  if (rs.ticker) setRestrictedTickerDropdownOpen(true);
                                }}
                                onBlur={() => {
                                  setRestrictedTickerDropdownOpen(false);
                                  setRestrictedTickerQuery("");
                                  setActiveRestrictedIdx(null);
                                }}
                                placeholder="e.g., MSFT"
                                className="w-32 rounded border border-slate-300 px-2 py-1 font-mono text-xs"
                              />
                              {restrictedTickerDropdownOpen && activeRestrictedIdx === idx && restrictedTickerQuery && (
                                <div 
                                  className="absolute top-full left-0 z-10 mt-1 max-h-40 w-48 overflow-y-auto rounded border border-slate-200 bg-white shadow-lg"
                                  onMouseDown={(e) => e.preventDefault()}
                                >
                                  {filteredRestrictedTickers.length > 0 ? (
                                    filteredRestrictedTickers.map((ticker) => {
                                      const meta = TICKER_META[ticker];
                                      return (
                                        <div
                                          key={ticker}
                                          className="cursor-pointer border-b border-slate-100 px-3 py-2 hover:bg-blue-50"
                                          onClick={() => {
                                            setRestrictedStocks((prev) =>
                                              prev.map((r, i) => (i === idx ? { ...r, ticker } : r)),
                                            );
                                            setRestrictedTickerDropdownOpen(false);
                                            setRestrictedTickerQuery("");
                                            setActiveRestrictedIdx(null);
                                          }}
                                        >
                                          <div className="font-mono text-xs font-semibold">{ticker}</div>
                                          {meta && (
                                            <div className="text-xs text-slate-600">{meta.companyName}</div>
                                          )}
                                        </div>
                                      );
                                    })
                                  ) : (
                                    <div className="px-3 py-2 text-xs text-slate-500">No matches</div>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={rs.reason ?? ""}
                              onChange={(e) =>
                                setRestrictedStocks((prev) =>
                                  prev.map((r, i) => (i === idx ? { ...r, reason: e.target.value } : r)),
                                )
                              }
                              placeholder="e.g., MNPI"
                              className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              className="rounded-lg bg-slate-100 px-3 py-1 text-xs text-slate-700 hover:bg-slate-200"
                              onClick={() => setRestrictedStocks((prev) => prev.filter((_, i) => i !== idx))}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                <div className="mt-3 flex justify-between">
                  <button
                    type="button"
                    className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white"
                    onClick={() => setRestrictedStocks((prev) => [...prev, { ticker: "", reason: "" }])}
                  >
                    Add row
                  </button>
                </div>
              </div>
            </section>

            <div className="flex justify-end">
              <button
                type="button"
                disabled={!canSave}
                onClick={save}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${
                  canSave
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-slate-200 text-slate-500"
                }`}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </>
        ) : (
          <div className="p-4">
            <AdminOrdersView />
          </div>
        )}
      </div>
    </main>
  );
}

