"use client";

import { useSession, signOut } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { OrderStatus } from "@prisma/client";
import type { ExposureDTO, RiskLimitsDTO } from "@/lib/trading/portfolio";
import { STATUS_LABEL, statusPillClass } from "@/lib/trading/status-ui";

type ApiOrder = {
  id: number;
  ticketKey: string;
  title: string | null;
  direction: string;
  ticker: string;
  quantity: number;
  orderType: string;
  limitPrice: string | null;
  account: string;
  strategy: string;
  status: OrderStatus;
  createdAt: string;
  breachLogs: { checkType: string }[];
  trader: { name: string; email: string };
  activities: { message: string; createdAt: string }[];
};

type BreachRow = {
  id: number;
  checkType: string;
  breachDetail: string | null;
  resolution: string | null;
  createdAt: string;
  order: { ticketKey: string; ticker: string; status: OrderStatus };
};

export default function RiskDesk() {
  const { data: session } = useSession();
  const [tab, setTab] = useState<"queue" | "breach" | "exposure">("queue");
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [breaches, setBreaches] = useState<BreachRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [exposure, setExposure] = useState<ExposureDTO | null>(null);
  const [limits, setLimits] = useState<RiskLimitsDTO | null>(null);

  const load = useCallback(async () => {
    const [or, br] = await Promise.all([
      fetch("/api/orders").then((r) => r.json()),
      fetch("/api/risk/breach-log").then((r) => r.json()),
    ]);
    console.log("[RiskDesk] orders response:", or);
    console.log("[RiskDesk] total orders:", or.orders?.length ?? 0);
    if (or.orders?.length) {
      console.log("[RiskDesk] statuses:", or.orders.map((o: ApiOrder) => ({ id: o.id, ticket: o.ticketKey, status: o.status })));
    }
    setOrders(or.orders ?? []);
    setBreaches(br.breaches ?? []);
  }, []);

  const loadExposure = useCallback(async () => {
    const res = await fetch("/api/exposure", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setExposure(data.exposure ?? null);
    setLimits(data.limits ?? null);
  }, []);

  useEffect(() => {
    Promise.all([load(), loadExposure()]).finally(() => setLoading(false));
  }, [load, loadExposure]);

  const queue = useMemo(
    () =>
      orders.filter((o) =>
        ["SUBMITTED", "IN_REVIEW"].includes(o.status),
      ),
    [orders],
  );

  const selected = orders.find((o) => o.id === selectedId) ?? queue[0] ?? null;

  async function transition(id: number, body: Record<string, unknown>) {
    const res = await fetch(`/api/orders/${id}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) await load();
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b-[5px] border-[#1434CB] bg-white">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-xs uppercase text-slate-500">Millennium · Risk</p>
            <h1 className="text-xl font-semibold">
              Risk officer — {session?.user?.name}
            </h1>
          </div>
          <div className="flex items-center gap-2">
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
        <div className="mx-auto flex max-w-[1400px] gap-2 border-t border-slate-100 px-4 py-2">
          {(
            [
              ["queue", "Order queue"],
              ["breach", "Breach log"],
              ["exposure", "Portfolio exposure"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                tab === k
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-6">
        {tab === "queue" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold">
                Awaiting review ({queue.length})
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-2">Ticket</th>
                      <th className="px-4 py-2">Ticker</th>
                      <th className="px-4 py-2">Waiting</th>
                      <th className="px-4 py-2">Checks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center">
                          Loading…
                        </td>
                      </tr>
                    ) : (
                      queue.map((o) => (
                        <tr
                          key={o.id}
                          className={`cursor-pointer border-t border-slate-100 hover:bg-slate-50 ${
                            selected?.id === o.id ? "bg-blue-50/60" : ""
                          }`}
                          onClick={() => setSelectedId(o.id)}
                        >
                          <td className="px-4 py-3 font-mono text-xs text-blue-700">
                            {o.ticketKey}
                          </td>
                          <td className="px-4 py-3 font-medium">{o.ticker}</td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {new Date(o.createdAt).toLocaleTimeString()}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {o.breachLogs?.length ? (
                              <span className="text-amber-700">
                                ⚠ {o.breachLogs.map((b) => b.checkType).join(", ")}
                              </span>
                            ) : (
                              <span className="text-emerald-700">Pass</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {selected && (
              <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div>
                  <p className="font-mono text-sm text-blue-600">
                    {selected.ticketKey}
                  </p>
                  <h3 className="text-xl font-semibold">{selected.title}</h3>
                  <p className="text-sm text-slate-500">
                    Trader: {selected.trader.name}
                  </p>
                </div>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <dt className="text-slate-500">Direction</dt>
                  <dd>{selected.direction}</dd>
                  <dt className="text-slate-500">Qty</dt>
                  <dd>{selected.quantity.toLocaleString()}</dd>
                  <dt className="text-slate-500">Type</dt>
                  <dd>{selected.orderType}</dd>
                  <dt className="text-slate-500">Account / Strategy</dt>
                  <dd>
                    {selected.account} · {selected.strategy}
                  </dd>
                </dl>
                <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                  {selected.status === "SUBMITTED" && (
                    <button
                      type="button"
                      className="rounded-lg bg-slate-100 px-3 py-2 text-sm"
                      onClick={() =>
                        transition(selected.id, { action: "risk_start_review" })
                      }
                    >
                      Mark in review
                    </button>
                  )}
                  <button
                    type="button"
                    className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white"
                    onClick={() =>
                      transition(selected.id, { action: "risk_approve" })
                    }
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-amber-500 px-3 py-2 text-sm text-white"
                    onClick={() =>
                      transition(selected.id, {
                        action: "risk_approve",
                        withConditions: true,
                      })
                    }
                  >
                    Approve with conditions
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-red-600 px-3 py-2 text-sm text-white"
                    onClick={() =>
                      transition(selected.id, { action: "risk_reject" })
                    }
                  >
                    Reject
                  </button>
                </div>
              </section>
            )}
          </div>
        )}

        {tab === "breach" && (
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold">
              Historical breach log
            </h2>
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">Order</th>
                  <th className="px-4 py-2">Check</th>
                  <th className="px-4 py-2">Detail</th>
                  <th className="px-4 py-2">Resolution</th>
                  <th className="px-4 py-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {breaches.map((b) => (
                  <tr key={b.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-mono text-xs">
                      {b.order.ticketKey}
                    </td>
                    <td className="px-4 py-3">{b.checkType}</td>
                    <td className="max-w-xs truncate px-4 py-3 text-xs">
                      {b.breachDetail}
                    </td>
                    <td className="px-4 py-3 text-xs">{b.resolution}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(b.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {tab === "exposure" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">Sector weights vs cap</h2>
              <div className="relative mx-auto h-56 w-56 rounded-full border-[12px] border-dashed border-slate-300">
                <div className="absolute inset-4 flex flex-col justify-center rounded-full bg-slate-50 p-4 text-center text-xs">
                  <p className="font-semibold">GICS sleeve</p>
                  <p className="text-slate-500">
                    Dashed ring = {limits?.sectorCapPct ?? "—"}% cap
                  </p>
                </div>
              </div>
              <ul className="mt-4 space-y-2 text-sm">
                {Object.entries(exposure?.sectorWeights ?? {}).map(
                  ([s, w]) => (
                    <li key={s} className="flex justify-between">
                      <span>{s}</span>
                      <span>
                        {w}% / cap {limits?.sectorCapPct ?? "—"}%
                      </span>
                    </li>
                  ),
                )}
              </ul>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">
                Single-name concentration (top 20)
              </h2>
              <div className="relative mb-2 h-px bg-slate-200">
                <span
                  className="absolute -top-2 right-0 text-[10px] text-red-600"
                  style={{ left: `${(limits?.singleNameCapPct ?? 10) * 8}%` }}
                >
                  Limit {limits?.singleNameCapPct ?? "—"}%
                </span>
              </div>
              <div className="space-y-2">
                {(exposure?.topSingleNames ?? []).map((p) => (
                  <div key={p.ticker} className="flex items-center gap-2 text-sm">
                    <span className="w-16">{p.ticker}</span>
                    <div className="relative h-6 flex-1 rounded bg-slate-100">
                      <div
                        className={`absolute left-0 top-0 h-full rounded ${
                          p.weight >= (limits?.singleNameCapPct ?? 10) * 0.95
                            ? "bg-red-500"
                            : "bg-blue-500"
                        }`}
                        style={{ width: `${Math.min(100, p.weight * 8)}%` }}
                      />
                    </div>
                    <span className="w-12 text-right tabular-nums">{p.weight}%</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
              <div className="grid gap-6 md:grid-cols-3">
                <div className="text-center">
                  <p className="text-xs uppercase text-slate-500">Gross exposure</p>
                  <div className="relative mx-auto mt-2 h-32 w-48 overflow-hidden rounded-b-full bg-gradient-to-t from-slate-200 to-slate-50">
                    <div
                      className="absolute bottom-0 left-0 right-0 bg-blue-500 transition-all"
                      style={{
                        height: `${((exposure?.grossExposure ?? 0) / (limits?.grossExposureCapPct ?? 180)) * 100}%`,
                      }}
                    />
                  </div>
                  <p className="mt-2 text-2xl font-bold">
                    {exposure?.grossExposure ?? "—"}%
                  </p>
                  <p className="text-xs text-slate-500">
                    vs limit {limits?.grossExposureCapPct ?? "—"}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs uppercase text-slate-500">Net exposure</p>
                  <div className="relative mx-auto mt-2 h-32 w-48 overflow-hidden rounded-b-full bg-gradient-to-t from-slate-200 to-slate-50">
                    <div
                      className="absolute bottom-0 left-0 right-0 bg-indigo-500"
                      style={{
                        height: `${((exposure?.netExposure ?? 0) / (limits?.netExposureCapPct ?? 70)) * 100}%`,
                      }}
                    />
                  </div>
                  <p className="mt-2 text-2xl font-bold">
                    {exposure?.netExposure ?? "—"}%
                  </p>
                  <p className="text-xs text-slate-500">
                    vs limit {limits?.netExposureCapPct ?? "—"}%
                  </p>
                </div>
                <div className="flex flex-col items-center justify-center rounded-lg bg-emerald-50 p-6">
                  <p className="text-xs uppercase text-emerald-800">
                    Buying power remaining
                  </p>
                  <p className="mt-2 text-4xl font-bold tracking-tight text-emerald-900">
                    {exposure?.buyingPowerRemaining ?? "—"}
                  </p>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
