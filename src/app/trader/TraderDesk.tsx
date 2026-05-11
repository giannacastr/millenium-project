"use client";

import { useSession, signOut } from "next-auth/react";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import type { OrderStatus } from "@prisma/client";
import {
  ACCOUNT_OPTIONS,
  STRATEGY_OPTIONS,
  TICKER_META,
} from "@/lib/trading/exposure";
import type { ExposureDTO, RiskLimitsDTO } from "@/lib/trading/portfolio";
import { computePreTradeImpact } from "@/lib/trading/risk";
import {
  BlotterFilter,
  filterForBucket,
  STATUS_LABEL,
  statusPillClass,
} from "@/lib/trading/status-ui";
import PreTradeImpactAnalysis from "@/components/PreTradeImpactAnalysis";
import DraftTickerInsight from "./DraftTickerInsight";
import OrderExecutionExpand from "./OrderExecutionExpand";

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
  notes: string | null;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  activities: { id: number; message: string; actorName: string | null; createdAt: string }[];
  trader: { name: string };
};

export default function TraderDesk() {
  const { data: session } = useSession();
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [bucket, setBucket] = useState<BlotterFilter>("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sort, setSort] = useState<"time" | "ticker" | "status">("time");
  const [liveLastPrice, setLiveLastPrice] = useState<number | null>(null);
  const [exposureSnapshot, setExposureSnapshot] = useState<{
    exposure: ExposureDTO;
    limits: RiskLimitsDTO;
  } | null>(null);

  const [ticket, setTicket] = useState({
    direction: "BUY" as "BUY" | "SELL" | "SHORT",
    ticker: "MSFT",
    quantity: 5000,
    orderType: "MARKET" as "MARKET" | "LIMIT" | "VWAP",
    limitPrice: "" as string,
    account: ACCOUNT_OPTIONS[0],
    strategy: STRATEGY_OPTIONS[0],
    notes: "",
  });

  const load = useCallback(async () => {
    const res = await fetch("/api/orders", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setOrders(data.orders ?? []);
  }, []);

  const loadExposure = useCallback(async () => {
    const res = await fetch("/api/exposure", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    if (data.exposure && data.limits) {
      setExposureSnapshot({
        exposure: data.exposure as ExposureDTO,
        limits: data.limits as RiskLimitsDTO,
      });
    }
  }, []);

  useEffect(() => {
    Promise.all([load(), loadExposure()]).finally(() => setLoading(false));
  }, [load, loadExposure]);

  /** Refetch when other roles/tabs advance orders (risk approve, broker ack, etc.). */
  useEffect(() => {
    const poll = window.setInterval(() => {
      void load();
      void loadExposure();
    }, 8000);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void load();
        void loadExposure();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load, loadExposure]);

  const tickerMeta = TICKER_META[ticket.ticker] ?? {
    sector: "Other",
    price: 100,
  };
  const limitNum =
    ticket.orderType === "LIMIT" && ticket.limitPrice
      ? Number(ticket.limitPrice)
      : undefined;
  const impact = computePreTradeImpact({
    ticker: ticket.ticker,
    quantity: ticket.quantity,
    limitPrice: limitNum,
    livePrice: liveLastPrice,
    direction: ticket.direction,
    portfolio: exposureSnapshot ?? undefined,
  });

  const fmtNav = (n: number) => {
    if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}MM`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
    return `$${n.toFixed(0)}`;
  };

  const filtered = useMemo(() => {
    let rows = orders.filter((o) => filterForBucket(o.status, bucket));
    rows = [...rows];
    if (sort === "time") {
      rows.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    } else if (sort === "ticker") {
      rows.sort((a, b) => a.ticker.localeCompare(b.ticker));
    } else {
      rows.sort((a, b) => a.status.localeCompare(b.status));
    }
    return rows;
  }, [orders, bucket, sort]);

  const counts = useMemo(() => {
    const c = {
      draft: 0,
      submitted: 0,
      inReview: 0,
      filled: 0,
      rejected: 0,
    };
    for (const o of orders) {
      if (o.status === "DRAFT") c.draft++;
      if (o.status === "SUBMITTED") c.submitted++;
      if (o.status === "IN_REVIEW") c.inReview++;
      if (o.status === "PARTIALLY_FILLED" || o.status === "FULLY_FILLED")
        c.filled++;
      if (o.status === "REJECTED" || o.status === "CANCELLED") c.rejected++;
    }
    return c;
  }, [orders]);

  async function submitTicket(mode: "draft" | "submit") {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        direction: ticket.direction,
        ticker: ticket.ticker,
        quantity: ticket.quantity,
        orderType: ticket.orderType,
        limitPrice:
          ticket.orderType === "LIMIT" ? Number(ticket.limitPrice) || null : null,
        account: ticket.account,
        strategy: ticket.strategy,
        notes: ticket.notes,
        mode,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setDrawerOpen(false);
      await load();
      setSelectedId(data.order?.id ?? null);
    }
  }

  async function runTransition(
    orderId: number,
    body: Record<string, unknown>,
  ) {
    const res = await fetch(`/api/orders/${orderId}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      await load();
    }
  }

  const stripBtn = (b: BlotterFilter, label: string, n: number) => (
    <button
      key={b}
      type="button"
      onClick={() => setBucket(bucket === b ? "all" : b)}
      className={`rounded-full px-3 py-1 text-sm transition ${
        bucket === b
          ? "bg-slate-900 text-white"
          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
      }`}
    >
      {label}{" "}
      <span className="font-semibold">{n}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Millennium · Equity Trader
            </p>
            <h1 className="text-xl font-semibold text-slate-900">
              Order desk — {session?.user?.name}
            </h1>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              New order ticket
            </button>
            <button
              type="button"
              onClick={() => signOut({ redirectTo: "/signIn" })}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1600px] gap-4 px-4 py-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <span className="text-sm text-slate-500">
              Today&apos;s blotter — click a row for execution detail
            </span>
            <div className="flex flex-wrap gap-2">
              {stripBtn("draft", "Draft", counts.draft)}
              {stripBtn("submitted", "Submitted", counts.submitted)}
              {stripBtn("inReview", "In Review", counts.inReview)}
              {stripBtn("filled", "Filled", counts.filled)}
              {stripBtn("rejected", "Rejected", counts.rejected)}
            </div>
            <div className="ml-auto flex items-center gap-2 text-sm">
              <label className="text-slate-500">Sort</label>
              <select
                value={sort}
                onChange={(e) =>
                  setSort(e.target.value as typeof sort)
                }
                className="rounded border border-slate-300 px-2 py-1"
              >
                <option value="time">Time</option>
                <option value="ticker">Ticker</option>
                <option value="status">Status</option>
              </select>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="w-8 px-2 py-3" aria-hidden />
                  <th className="px-4 py-3">Ticket</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Ticker</th>
                  <th className="px-4 py-3">Side</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Time</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                      Loading…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                      No orders in this filter.
                    </td>
                  </tr>
                ) : (
                  filtered.map((o) => {
                    const expanded = selectedId === o.id;
                    return (
                      <Fragment key={o.id}>
                        <tr
                          onClick={() =>
                            setSelectedId(expanded ? null : o.id)
                          }
                          className={`cursor-pointer border-b border-slate-50 hover:bg-slate-50 ${
                            expanded ? "bg-blue-50/80" : ""
                          }`}
                          aria-expanded={expanded}
                        >
                          <td className="px-2 py-3 text-center text-slate-400">
                            <span
                              className={`inline-block text-xs transition-transform ${expanded ? "rotate-180" : ""}`}
                              aria-hidden
                            >
                              ▾
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs font-medium text-blue-700">
                            {o.ticketKey}
                          </td>
                          <td className="max-w-[220px] truncate px-4 py-3 text-slate-800">
                            {o.title}
                          </td>
                          <td className="px-4 py-3 font-medium">{o.ticker}</td>
                          <td className="px-4 py-3">{o.direction}</td>
                          <td className="px-4 py-3 tabular-nums">
                            {o.quantity.toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusPillClass(o.status)}`}
                            >
                              {STATUS_LABEL[o.status]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {new Date(o.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                        </tr>
                        {expanded && (
                          <tr className="border-b border-slate-200 bg-slate-50/50">
                            <td colSpan={8} className="p-0 align-top">
                              <OrderExecutionExpand
                                order={o}
                                onRunTransition={(body) =>
                                  runTransition(o.id, body)
                                }
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">
              Portfolio snapshot
            </h3>
            <p className="mb-3 text-xs text-slate-500">
              Holdings + open-order reservation from the server; prices via Finnhub.
              Refreshes with the blotter poll.
            </p>
            {exposureSnapshot ? (
              <>
                <dl className="mb-3 grid grid-cols-2 gap-2 text-xs">
                  <dt className="text-slate-500">NAV (holdings)</dt>
                  <dd className="text-right font-mono font-medium text-slate-900">
                    {fmtNav(exposureSnapshot.exposure.totalValue)}
                  </dd>
                  <dt className="text-slate-500">BP used</dt>
                  <dd className="text-right font-mono text-slate-800">
                    {exposureSnapshot.exposure.buyingPowerUsed.toFixed(1)}%
                    <span className="text-slate-400">
                      {" "}
                      / cap {exposureSnapshot.limits.buyingPowerUsedCapPct}%
                    </span>
                  </dd>
                  <dt className="text-slate-500">BP remaining</dt>
                  <dd className="text-right font-mono text-emerald-800">
                    {exposureSnapshot.exposure.buyingPowerRemaining}
                  </dd>
                  <dt className="text-slate-500">Open orders</dt>
                  <dd className="text-right font-mono text-slate-700">
                    {fmtNav(exposureSnapshot.exposure.openOrderNotional)}
                  </dd>
                </dl>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Single-name weight (cap {exposureSnapshot.limits.singleNameCapPct}%)
                </p>
                <div className="max-h-44 space-y-2 overflow-y-auto text-sm">
                  {(exposureSnapshot.exposure.topSingleNames ?? [])
                    .slice(0, 8)
                    .map((p) => (
                      <div
                        key={p.ticker}
                        className="flex justify-between border-b border-slate-100 py-1"
                      >
                        <span className="font-medium">{p.ticker}</span>
                        <span
                          className={`tabular-nums ${
                            p.weight >= exposureSnapshot.limits.singleNameCapPct * 0.95
                              ? "font-medium text-rose-700"
                              : "text-slate-600"
                          }`}
                        >
                          {p.weight}%
                        </span>
                      </div>
                    ))}
                </div>
                <p className="mb-2 mt-4 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Sector sleeves (cap {exposureSnapshot.limits.sectorCapPct}%)
                </p>
                <div className="max-h-36 space-y-1 overflow-y-auto text-xs">
                  {Object.entries(exposureSnapshot.exposure.sectorWeights)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 6)
                    .map(([sector, w]) => (
                      <div
                        key={sector}
                        className="flex justify-between border-b border-slate-50 py-0.5"
                      >
                        <span className="truncate pr-2 text-slate-700">{sector}</span>
                        <span
                          className={
                            w >= exposureSnapshot.limits.sectorCapPct * 0.95
                              ? "font-medium text-rose-700"
                              : "tabular-nums text-slate-600"
                          }
                        >
                          {w}%
                        </span>
                      </div>
                    ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">
                No exposure data yet. Seed the database or check{" "}
                <span className="font-mono text-xs">/api/exposure</span>.
              </p>
            )}
          </section>
        </aside>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/40">
          <div className="h-full w-full max-w-lg overflow-y-auto bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h2 className="text-lg font-semibold">New equity ticket</h2>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="text-slate-500 hover:text-slate-800"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4 p-4">
              <div className="flex gap-2">
                {(["BUY", "SELL", "SHORT"] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() =>
                      setTicket((t) => ({ ...t, direction: d }))
                    }
                    className={`flex-1 rounded-lg py-2 text-sm font-medium ${
                      ticket.direction === d
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <label className="block text-sm">
                <span className="text-slate-600">Ticker</span>
                <select
                  value={ticket.ticker}
                  onChange={(e) =>
                    setTicket((t) => ({ ...t, ticker: e.target.value }))
                  }
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                >
                  {Object.keys(TICKER_META).map((sym) => (
                    <option key={sym} value={sym}>
                      {sym}
                    </option>
                  ))}
                </select>
              </label>
              <DraftTickerInsight
                ticker={ticket.ticker}
                onLastPrice={setLiveLastPrice}
              />
              <label className="block text-sm">
                <span className="text-slate-600">Quantity</span>
                <input
                  type="number"
                  value={ticket.quantity}
                  onChange={(e) =>
                    setTicket((t) => ({
                      ...t,
                      quantity: Number(e.target.value),
                    }))
                  }
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-600">Order type</span>
                <select
                  value={ticket.orderType}
                  onChange={(e) =>
                    setTicket((t) => ({
                      ...t,
                      orderType: e.target.value as typeof ticket.orderType,
                    }))
                  }
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                >
                  <option value="MARKET">Market</option>
                  <option value="LIMIT">Limit</option>
                  <option value="VWAP">VWAP</option>
                </select>
              </label>
              {ticket.orderType === "LIMIT" && (
                <label className="block text-sm">
                  <span className="text-slate-600">Limit price</span>
                  <input
                    type="number"
                    value={ticket.limitPrice}
                    onChange={(e) =>
                      setTicket((t) => ({ ...t, limitPrice: e.target.value }))
                    }
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                  />
                </label>
              )}
              <label className="block text-sm">
                <span className="text-slate-600">Account</span>
                <select
                  value={ticket.account}
                  onChange={(e) =>
                    setTicket((t) => ({ ...t, account: e.target.value }))
                  }
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                >
                  {ACCOUNT_OPTIONS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-slate-600">Strategy</span>
                <select
                  value={ticket.strategy}
                  onChange={(e) =>
                    setTicket((t) => ({ ...t, strategy: e.target.value }))
                  }
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                >
                  {STRATEGY_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-slate-600">Notes</span>
                <textarea
                  value={ticket.notes}
                  onChange={(e) =>
                    setTicket((t) => ({ ...t, notes: e.target.value }))
                  }
                  rows={3}
                  className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                />
              </label>

              <div className="rounded-lg bg-slate-50 p-4 text-sm">
                <h4 className="mb-2 font-semibold text-slate-800">
                  Pre-trade impact
                  {exposureSnapshot
                    ? " (portfolio + limits)"
                    : " (legacy demo curve)"}
                </h4>
                {exposureSnapshot ? (
                  <PreTradeImpactAnalysis
                    impact={impact}
                    limits={exposureSnapshot.limits}
                  />
                ) : (
                  <ul className="space-y-1 text-slate-600">
                    <li>
                      Single-name weight (sim after):{" "}
                      <strong>{impact.singleNameAfter.toFixed(1)}%</strong>
                    </li>
                    <li>
                      Sector sleeve (sim after):{" "}
                      <strong>{impact.sectorAfter.toFixed(1)}%</strong>
                    </li>
                    <li>
                      Buying power used (sim):{" "}
                      <strong>{impact.buyingPowerAfter.toFixed(1)}%</strong>
                    </li>
                  </ul>
                )}
                {impact.triggeredChecks.length > 0 && !exposureSnapshot && (
                  <p className="mt-2 text-amber-700">
                    Flags: {impact.triggeredChecks.join(", ")}
                  </p>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => submitTicket("draft")}
                  className="flex-1 rounded-lg border border-slate-300 py-2 text-sm font-medium"
                >
                  Save draft
                </button>
                <button
                  type="button"
                  onClick={() => submitTicket("submit")}
                  className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white"
                >
                  Submit for review
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
