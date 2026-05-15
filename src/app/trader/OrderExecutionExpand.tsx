"use client";

import { useMemo } from "react";
import type { OrderStatus } from "@prisma/client";
import { type OrderForExecution, resolveExecutionFill } from "@/lib/trading/executionFill";

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
      return "Awaiting fill";
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
  if (orderType === "LIMIT" && limitPrice) return `$${Number(limitPrice).toFixed(2)}`;
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
  shortLocateStatus?: string | null;
  shortLocateId?: string | null;
  shortLocateQuantity?: number | null;
  shortBorrowRateCapPct?: number | null;
  shortBorrowRatePct?: number | null;
  shortLocateProvider?: string | null;
  shortLocateRequestedAt?: string | null;
  shortLocateRespondedAt?: string | null;
  shortLocateExpiresAt?: string | null;
  filledQuantity: number;
  remainingQuantity: number;
  averageFillPrice: number | null;
  arrivalPrice: number | null;
  fillStartedAt: string | null;
  fillCompletedAt: string | null;
  allocationLockedAt: string | null;
  allocationInstructions: { id: number; sequence: number; account: string; weightPct: number }[];
  fills: {
    id: number;
    sequence: number;
    quantity: number;
    price: number;
    executedAt: string;
    allocations: { id: number; fillId: number; instructionId: number; shares: number; notional: number }[];
  }[];
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
  currentPrice?: number;
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getExecutionSummary(o: ExpandOrder) {
  const hasEngineFills = o.fills.length > 0 || o.filledQuantity > 0;
  if (!hasEngineFills) {
    if (o.status === "PARTIALLY_FILLED" || o.status === "FULLY_FILLED") {
      return resolveExecutionFill(o as OrderForExecution);
    }
    return null;
  }

  const weightedNotional = o.fills.reduce(
    (sum, fillRow) => sum + fillRow.quantity * fillRow.price,
    0,
  );
  const filledQty = o.fills.reduce((sum, fillRow) => sum + fillRow.quantity, 0) || o.filledQuantity;
  const avgPrice = filledQty > 0 ? weightedNotional / filledQty : o.averageFillPrice ?? 0;
  const lastFill = o.fills[o.fills.length - 1];

  return {
    timeIso: lastFill?.executedAt ?? o.updatedAt,
    qty: filledQty,
    price: avgPrice,
    fillLabel: o.status === "FULLY_FILLED" ? "Filled" : "Partial",
  } as const;
}

export default function OrderExecutionExpand({
  order: o,
  onRunTransition,
  currentPrice,
}: Props) {
  const fill = useMemo(() => getExecutionSummary(o), [o]);

  const showFillDetail = o.fills.length > 0 || o.status === "PARTIALLY_FILLED" || o.status === "FULLY_FILLED" || o.status === "CANCELLED_PARTIAL";

  const tca = useMemo(() => {
    if (o.arrivalPrice == null || o.averageFillPrice == null || o.filledQuantity <= 0) {
      return null;
    }
    const slippagePerShare = o.averageFillPrice - o.arrivalPrice;
    const favorable = o.direction === "BUY" ? slippagePerShare < 0 : slippagePerShare > 0;
    const total = Math.abs(slippagePerShare * o.filledQuantity);
    return {
      arrivalPrice: o.arrivalPrice,
      averageFillPrice: o.averageFillPrice,
      slippagePerShare,
      total,
      label: favorable ? "saved" : "cost",
      favorable,
    };
  }, [o.arrivalPrice, o.averageFillPrice, o.direction, o.filledQuantity]);

  const executionLead = PENDING_STATUSES.includes(o.status) ? (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${pendingStageClass(o.status)}`}
      >
        {pendingStageLabel(o.status)}
      </span>
      <span className="text-xs text-slate-500">
        Updated {fmtTime(o.updatedAt)} · ref {fmtPriceRef(o.orderType, o.limitPrice)} · {o.strategy}
      </span>
    </div>
  ) : fill ? (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={
          o.status === "FULLY_FILLED"
            ? "inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800"
            : o.status === "CANCELLED_PARTIAL"
              ? "inline-flex rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-900"
              : "inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900"
        }
      >
        {o.status === "FULLY_FILLED"
          ? "Fully filled"
          : o.status === "CANCELLED_PARTIAL"
            ? "Cancelled (partial)"
            : "Partially filled"}
      </span>
      <span className="font-mono text-xs text-slate-600">
        {fill.qty.toLocaleString()} @ ${fill.price.toFixed(2)} · {fmtTime(fill.timeIso)}
      </span>
      <span className="text-xs text-slate-500">
        {o.filledQuantity.toLocaleString()} / {o.quantity.toLocaleString()} filled
      </span>
    </div>
  ) : (
    <p className="text-sm text-slate-600">
      {o.status === "DRAFT" && "Draft — not in the risk → broker → execution pipeline yet."}
      {(o.status === "REJECTED" || o.status === "CANCELLED" || o.status === "CANCELLED_PARTIAL") &&
        `${o.status === "REJECTED" ? "Rejected" : o.status === "CANCELLED_PARTIAL" ? "Cancelled (partial)" : "Cancelled"} — see activity below.`}
      {o.status !== "DRAFT" &&
        o.status !== "REJECTED" &&
        o.status !== "CANCELLED" &&
        o.status !== "CANCELLED_PARTIAL" &&
        "No execution detail for this state."}
    </p>
  );

  const shortLocatePanel = o.direction === "SHORT" ? (
    <section className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
      <h4 className="text-sm font-semibold text-slate-900">Short locate</h4>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className="text-slate-500">Locate status</div>
        <div>
          {o.shortLocateStatus === "CONFIRMED" ? (
            <span className="font-medium text-emerald-700">Confirmed</span>
          ) : o.shortLocateStatus === "REQUESTED" ? (
            <span className="font-medium text-amber-700">Requested — awaiting broker</span>
          ) : (
            <span className="text-slate-500">{o.shortLocateStatus ?? "NOT_REQUIRED"}</span>
          )}
        </div>
        <div className="text-slate-500">Shares requested (locate)</div>
        <div>{o.shortLocateQuantity?.toLocaleString() ?? o.quantity.toLocaleString()}</div>
        <div className="text-slate-500">Max borrow rate (cap)</div>
        <div>{o.shortBorrowRateCapPct != null ? `${o.shortBorrowRateCapPct.toFixed(2)}% annual` : "—"}</div>
        <div className="text-slate-500">Confirmed borrow rate</div>
        <div>{o.shortBorrowRatePct != null ? `${o.shortBorrowRatePct.toFixed(2)}% annual` : "—"}</div>
        <div className="text-slate-500">Locate confirmation ID</div>
        <div className="break-all font-mono text-xs">{o.shortLocateId ?? "—"}</div>
        <div className="text-slate-500">Lender / source</div>
        <div>{o.shortLocateProvider ?? "—"}</div>
      </div>
      {(o.shortLocateRequestedAt || o.shortLocateRespondedAt || o.shortLocateExpiresAt) && (
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-600">
          <div>Requested: {o.shortLocateRequestedAt ? fmtTime(o.shortLocateRequestedAt) : "—"}</div>
          <div>Responded: {o.shortLocateRespondedAt ? fmtTime(o.shortLocateRespondedAt) : "—"}</div>
          <div>Expires: {o.shortLocateExpiresAt ? fmtTime(o.shortLocateExpiresAt) : "—"}</div>
        </div>
      )}
    </section>
  ) : null;

  return (
    <div className="ticket-detail border-l-4 border-blue-500 bg-slate-50/90 px-4 py-4">
      <div className="mb-3">
        <p className="font-mono text-sm text-blue-600">{o.ticketKey}</p>
        <h2 className="text-lg font-semibold text-slate-900">{o.title}</h2>
      </div>

      <div className="mb-4 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <p className="font-semibold uppercase tracking-wide text-slate-500" style={{ fontSize: 13 }}>
          Execution & pipeline
        </p>
        <div className="mt-2">{executionLead}</div>
        <p className="mt-2 text-xs text-slate-500">
          This desk polls every few seconds; other tabs can advance the ticket.
        </p>
      </div>

      {shortLocatePanel && (
        <div className="mb-4">{shortLocatePanel}</div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {o.status === "FULLY_FILLED" && !o.allocationLockedAt && o.allocationInstructions.length > 0 && (
          <button
            type="button"
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white"
            onClick={() => onRunTransition({ action: "lock_allocations" })}
          >
            Allocate
          </button>
        )}
        {o.status === "FULLY_FILLED" && o.allocationLockedAt && (
          <span className="rounded-lg bg-emerald-100 px-3 py-2 text-sm text-emerald-800">
            Allocations locked
          </span>
        )}
        {o.status === "DRAFT" && (
          <button
            type="button"
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white"
            onClick={() => onRunTransition({ action: "submit_draft" })}
          >
            Submit for review
          </button>
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
        {(o.status === "RISK_APPROVED" || o.status === "ACKNOWLEDGED" || o.status === "PARTIALLY_FILLED") && (
          <button
            type="button"
            className="rounded-lg border border-rose-300 px-3 py-2 text-sm text-rose-700"
            onClick={() => onRunTransition({ action: "cancel" })}
          >
            Cancel order
          </button>
        )}
      </div>

      {showFillDetail && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Fills
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Fill ID</th>
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2">Qty</th>
                  <th className="px-3 py-2">Price</th>
                </tr>
              </thead>
              <tbody>
                {o.fills.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-slate-500">
                      No persisted fills yet.
                    </td>
                  </tr>
                ) : (
                  o.fills.map((fillRow) => (
                    <tr key={fillRow.id} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-mono text-xs text-blue-700">
                        #{fillRow.id}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500">
                        {fmtTime(fillRow.executedAt)}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {fillRow.quantity.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 font-mono tabular-nums text-slate-700">
                        ${fillRow.price.toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {o.fills.some((fillRow) => (fillRow.allocations?.length ?? 0) > 0) && (
            <div className="mt-4 rounded-lg bg-slate-50 p-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Real-time allocation splits
              </h4>
              <div className="mt-3 space-y-3 text-sm">
                {o.fills.map((fillRow) => (
                  <div key={fillRow.id} className="rounded border border-slate-200 bg-white p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-mono text-xs text-slate-500">Fill #{fillRow.id}</span>
                      <span className="text-xs text-slate-500">
                        {fmtTime(fillRow.executedAt)} · {fillRow.quantity.toLocaleString()} shares
                      </span>
                    </div>
                    <div className="grid gap-2">
                      {(fillRow.allocations ?? []).map((split) => {
                        const instruction = o.allocationInstructions.find((allocation) => allocation.id === split.instructionId);
                        return (
                          <div key={split.id} className="flex items-center justify-between text-xs">
                            <span className="text-slate-700">
                              {instruction?.account ?? "Legacy account"}
                            </span>
                            <span className="font-mono text-slate-500">
                              {split.shares.toLocaleString()} shares · ${split.notional.toFixed(2)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tca && (
            <div className="mt-4 rounded-lg bg-slate-50 p-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                TCA summary
              </h4>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <dt className="text-slate-500">Arrival price</dt>
                <dd className="font-mono text-slate-900">${tca.arrivalPrice.toFixed(2)}</dd>
                <dt className="text-slate-500">Average fill price</dt>
                <dd className="font-mono text-slate-900">${tca.averageFillPrice.toFixed(2)}</dd>
                <dt className="text-slate-500">Slippage / share</dt>
                <dd className={`font-mono ${tca.favorable ? "text-emerald-700" : "text-rose-700"}`}>
                  {tca.slippagePerShare >= 0 ? "+" : ""}${tca.slippagePerShare.toFixed(2)}
                </dd>
                <dt className="text-slate-500">Total {tca.label}</dt>
                <dd className={`font-mono font-semibold ${tca.favorable ? "text-emerald-700" : "text-rose-700"}`}>
                  {tca.label} ${tca.total.toFixed(2)}
                </dd>
              </dl>
            </div>
          )}

        </div>
      )}

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
            <span className="font-medium text-slate-700">Notes:</span> {o.notes || "—"}
          </p>
        </div>
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">
            Pre-trade allocations
          </h3>
          {o.allocationInstructions.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Account</th>
                    <th className="px-3 py-2">Split</th>
                  </tr>
                </thead>
                <tbody>
                  {o.allocationInstructions.map((allocation) => (
                    <tr key={allocation.id} className="border-t border-slate-100">
                      <td className="px-3 py-2">{allocation.account}</td>
                      <td className="px-3 py-2 tabular-nums">{allocation.weightPct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No allocation instructions on this order.</p>
          )}
          {o.allocationLockedAt && (
            <p className="mt-2 text-xs text-emerald-700">
              Locked {new Date(o.allocationLockedAt).toLocaleString()}
            </p>
          )}
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