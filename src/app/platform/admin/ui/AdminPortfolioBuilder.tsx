"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { signOut } from "next-auth/react";

type HoldingRow = { ticker: string; shares: number };
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

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
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const canSave = useMemo(() => holdings.length > 0 && !saving, [holdings.length, saving]);

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
      <header className="border-b border-slate-200 bg-white">
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

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Initial portfolio</h2>
            <p className="mt-0.5 text-sm text-slate-600">
              Add tickers and share counts. This becomes the starting state for
              all exposure and risk calculations.
            </p>
          </div>
          <div className="overflow-x-auto p-4">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Ticker</th>
                  <th className="px-3 py-2 text-right">Shares</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-slate-500">
                      Loading…
                    </td>
                  </tr>
                ) : holdings.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-slate-500">
                      No holdings yet.
                    </td>
                  </tr>
                ) : (
                  holdings.map((h, idx) => (
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
                  ))
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
      </div>
    </main>
  );
}

