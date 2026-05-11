"use client";

import { useMemo } from "react";
import type { OrderStatus } from "@prisma/client";
import {
  type OrderForExecution,
  resolveExecutionFill,
} from "@/lib/trading/executionFill";

const PENDING_STATUSES: OrderStatus[] = [
  "SUBMITTED",
  "IN_REVIEW",
  "RISK_APPROVED",
  "ACKNOWLEDGED",
];

function pendingStageLabel(status: OrderStatus): string {
  switch (status) {
    case "SUBMITTED":
      return "Awaiting risk review";
    case "IN_REVIEW":
      return "Risk reviewing";
    case "RISK_APPROVED":
      return "At prime broker";
    case "ACKNOWLEDGED":
      return "Ready to simulate fill";
    default:
      return status;
  }
}

function pendingStageStyle(status: OrderStatus): string {
  switch (status) {
    case "SUBMITTED":
      return "bg-slate-100 text-slate-800";
    case "IN_REVIEW":
      return "bg-amber-100 text-amber-900";
    case "RISK_APPROVED":
      return "bg-indigo-100 text-indigo-900";
    case "ACKNOWLEDGED":
      return "bg-cyan-100 text-cyan-900";
    default:
      return "bg-slate-100 text-slate-800";
  }
}

type OrderInput = {
  id: number;
  ticketKey: string;
  ticker: string;
  quantity: number;
  direction: string;
  strategy: string;
  limitPrice: string | null;
  orderType: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  activities: { message: string; createdAt: string }[];
};

type Props = {
  orders: OrderInput[];
  loading?: boolean;
};

export default function ExecutionHistory({ orders, loading }: Props) {
  const pendingRows = useMemo(() => {
    return orders
      .filter((o) => PENDING_STATUSES.includes(o.status))
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      )
      .map((o) => ({
        id: o.id,
        ticketKey: o.ticketKey,
        ticker: o.ticker,
        side: o.direction,
        qty: o.quantity,
        strategy: o.strategy,
        orderType: o.orderType,
        limitPrice: o.limitPrice,
        status: o.status,
        stage: pendingStageLabel(o.status),
        stageClass: pendingStageStyle(o.status),
        timeIso: o.updatedAt,
      }));
  }, [orders]);

  const fillRows = useMemo(() => {
    const filled = orders.filter(
      (o) => o.status === "PARTIALLY_FILLED" || o.status === "FULLY_FILLED",
    );
    return filled
      .map((o) => {
        const ex = resolveExecutionFill(o as OrderForExecution);
        return {
          id: o.id,
          timeIso: ex.timeIso,
          ticker: o.ticker,
          side: o.direction,
          qty: ex.qty,
          price: ex.price,
          strategy: o.strategy,
          status: ex.fillLabel,
        };
      })
      .sort(
        (a, b) =>
          new Date(b.timeIso).getTime() - new Date(a.timeIso).getTime(),
      );
  }, [orders]);

  const { filledCount, totalShares, totalNotionalM } = useMemo(() => {
    let shares = 0;
    let notional = 0;
    for (const r of fillRows) {
      shares += r.qty;
      notional += r.qty * r.price;
    }
    return {
      filledCount: fillRows.length,
      totalShares: shares,
      totalNotionalM: notional / 1_000_000,
    };
  }, [fillRows]);

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  const fmtPriceRef = (orderType: string, limitPrice: string | null) => {
    if (orderType === "LIMIT" && limitPrice)
      return `$${Number(limitPrice).toFixed(2)}`;
    if (orderType === "MARKET") return "MKT";
    if (orderType === "VWAP") return "VWAP";
    return "—";
  };

  const statCard = (label: string, value: string) => (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 font-mono text-2xl font-semibold tabular-nums tracking-tight text-slate-900">
        {value}
      </p>
    </div>
  );

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* —— Pending execution —— */}
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Pending execution
        </h2>
        <p className="mt-0.5 text-sm text-slate-600">
          Tickets in the risk → broker → fill pipeline. Rows update when other
          desks act; this page also polls every few seconds.
        </p>
      </div>

      <div className="overflow-x-auto border-b border-slate-100">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3">Ticket</th>
              <th className="px-4 py-3">Ticker</th>
              <th className="px-4 py-3">Side</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-right">Ref price</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Strategy</th>
              <th className="px-4 py-3">Stage</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-8 text-center text-slate-500"
                >
                  Loading…
                </td>
              </tr>
            ) : pendingRows.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-8 text-center text-slate-500"
                >
                  No tickets in pipeline. Submit an order for review from this
                  desk, or wait for polling to pick up changes from risk/broker.
                </td>
              </tr>
            ) : (
              pendingRows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-slate-50 hover:bg-slate-50/80"
                >
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-600">
                    {fmtTime(r.timeIso)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs font-medium text-blue-700">
                    {r.ticketKey}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    {r.ticker}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        r.side === "BUY"
                          ? "font-medium text-emerald-700"
                          : r.side === "SELL"
                            ? "font-medium text-rose-700"
                            : "font-medium text-amber-800"
                      }
                    >
                      {r.side}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-800">
                    {r.qty.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-slate-700">
                    {fmtPriceRef(r.orderType, r.limitPrice)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.orderType}</td>
                  <td className="max-w-[160px] truncate px-4 py-3 text-slate-600">
                    {r.strategy}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${r.stageClass}`}
                    >
                      {r.stage}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* —— Completed fills —— */}
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Execution history
        </h2>
        <p className="mt-0.5 text-sm text-slate-600">
          Confirmed fills (partial or full). After a ticket shows{" "}
          <span className="font-medium text-slate-800">Ready to simulate fill</span>
          above, select it in the blotter and run{" "}
          <span className="font-medium text-slate-800">Sim partial fill</span> or{" "}
          <span className="font-medium text-slate-800">Sim full fill</span>.
        </p>
      </div>

      <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-3">
        {statCard("Filled orders", String(filledCount))}
        {statCard("Total shares", totalShares.toLocaleString())}
        {statCard("Total notional", `$${totalNotionalM.toFixed(1)}M`)}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Ticker</th>
              <th className="px-4 py-3">Side</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Strategy</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-slate-500"
                >
                  Loading…
                </td>
              </tr>
            ) : fillRows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-slate-500"
                >
                  No fills yet for <span className="font-medium">your</span>{" "}
                  account. This list is scoped to the signed-in trader. Complete
                  the pipeline above, then simulate fills from the order detail
                  panel.
                </td>
              </tr>
            ) : (
              fillRows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-slate-50 hover:bg-slate-50/80"
                >
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-600">
                    {fmtTime(r.timeIso)}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    {r.ticker}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        r.side === "BUY"
                          ? "font-medium text-emerald-700"
                          : r.side === "SELL"
                            ? "font-medium text-rose-700"
                            : "font-medium text-amber-800"
                      }
                    >
                      {r.side}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-800">
                    {r.qty.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-800">
                    ${r.price.toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        r.status === "Filled"
                          ? "inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800"
                          : "inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900"
                      }
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-slate-600">
                    {r.strategy}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
