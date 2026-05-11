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

function pendingStageClass(status: OrderStatus): string {
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

function fmtPriceRef(orderType: string, limitPrice: string | null) {
  if (orderType === "LIMIT" && limitPrice)
    return `$${Number(limitPrice).toFixed(2)}`;
  if (orderType === "MARKET") return "MKT";
  if (orderType === "VWAP") return "VWAP";
  return "—";
}

export type ExpandOrder = {
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
  activities: {
    id: number;
    message: string;
    actorName: string | null;
    createdAt: string;
  }[];
};

type Props = {
  order: ExpandOrder;
  onRunTransition: (body: Record<string, unknown>) => void;
};

export default function OrderExecutionExpand({
  order: o,
  onRunTransition,
}: Props) {
  const fill = useMemo(() => {
    if (o.status !== "PARTIALLY_FILLED" && o.status !== "FULLY_FILLED")
      return null;
    return resolveExecutionFill(o as OrderForExecution);
  }, [o]);

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  const executionLead = PENDING_STATUSES.includes(o.status) ? (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${pendingStageClass(o.status)}`}
      >
        {pendingStageLabel(o.status)}
      </span>
      <span className="text-xs text-slate-500">
        Updated {fmtTime(o.updatedAt)} · ref {fmtPriceRef(o.orderType, o.limitPrice)} ·{" "}
        {o.strategy}
      </span>
    </div>
  ) : fill ? (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={
          fill.fillLabel === "Filled"
            ? "inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800"
            : "inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900"
        }
      >
        {fill.fillLabel === "Filled" ? "Fully filled" : "Partial fill"}
      </span>
      <span className="font-mono text-xs text-slate-600">
        {fill.qty.toLocaleString()} @ ${fill.price.toFixed(2)} · {fmtTime(fill.timeIso)}
      </span>
    </div>
  ) : (
    <p className="text-sm text-slate-600">
      {o.status === "DRAFT" &&
        "Draft — not in the risk → broker → execution pipeline yet."}
      {(o.status === "REJECTED" || o.status === "CANCELLED") &&
        `${o.status === "REJECTED" ? "Rejected" : "Cancelled"} — see activity below.`}
      {o.status !== "DRAFT" &&
        o.status !== "REJECTED" &&
        o.status !== "CANCELLED" &&
        "No execution detail for this state."}
    </p>
  );

  return (
    <div className="border-l-4 border-blue-500 bg-slate-50/90 px-4 py-4">
      <div className="mb-3">
        <p className="font-mono text-sm text-blue-600">{o.ticketKey}</p>
        <h2 className="text-lg font-semibold text-slate-900">{o.title}</h2>
      </div>
      <div className="mb-4 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Execution & pipeline
        </p>
        <div className="mt-2">{executionLead}</div>
        <p className="mt-2 text-xs text-slate-500">
          This desk polls every few seconds; other tabs can advance the ticket.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {o.status === "DRAFT" && (
          <button
            type="button"
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white"
            onClick={() => onRunTransition({ action: "submit_draft" })}
          >
            Submit for review
          </button>
        )}
        {o.status === "ACKNOWLEDGED" && (
          <>
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              onClick={() =>
                onRunTransition({
                  action: "simulate_partial_fill",
                  filledQty: Math.floor(o.quantity / 2),
                  price: Number(o.limitPrice ?? 180),
                })
              }
            >
              Sim partial fill
            </button>
            <button
              type="button"
              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white"
              onClick={() =>
                onRunTransition({
                  action: "simulate_full_fill",
                  price: Number(o.limitPrice ?? 180),
                })
              }
            >
              Sim full fill
            </button>
          </>
        )}
        {o.status === "PARTIALLY_FILLED" && (
          <button
            type="button"
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white"
            onClick={() =>
              onRunTransition({
                action: "simulate_full_fill",
                price: Number(o.limitPrice ?? 180),
              })
            }
          >
            Complete fill
          </button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3 text-sm">
          <h3 className="text-xs font-semibold uppercase text-slate-500">
            Order fields
          </h3>
          <dl className="grid grid-cols-2 gap-2">
            <dt className="text-slate-500">Direction</dt>
            <dd>{o.direction}</dd>
            <dt className="text-slate-500">Type</dt>
            <dd>{o.orderType}</dd>
            <dt className="text-slate-500">Limit</dt>
            <dd>{o.limitPrice != null ? `$${o.limitPrice}` : "—"}</dd>
            <dt className="text-slate-500">Account</dt>
            <dd>{o.account}</dd>
            <dt className="text-slate-500">Strategy</dt>
            <dd>{o.strategy}</dd>
          </dl>
          <p className="text-slate-600">
            <span className="font-medium text-slate-700">Notes:</span>{" "}
            {o.notes || "—"}
          </p>
        </div>
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">
            Activity
          </h3>
          <ul className="max-h-56 space-y-3 overflow-y-auto border-l-2 border-slate-200 pl-4 text-sm">
            {o.activities.map((a) => (
              <li key={a.id} className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-blue-500" />
                <p className="text-slate-800">{a.message}</p>
                <p className="text-xs text-slate-400">
                  {new Date(a.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
