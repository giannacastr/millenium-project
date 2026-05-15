"use client";

import { useSession, signOut } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { OrderStatus } from "@prisma/client";

type ApiOrder = {
  id: number;
  ticketKey: string;
  title: string | null;
  direction: string;
  ticker: string;
  quantity: number;
  orderType: string;
  limitPrice: string | null;
  strategy: string;
  status: OrderStatus;
  createdAt: string;
  shortLocateStatus?: string | null;
  shortLocateId?: string | null;
  shortLocateQuantity?: number | null;
  shortBorrowRateCapPct?: number | null;
  shortBorrowRatePct?: number | null;
  shortLocateProvider?: string | null;
  shortLocateRequestedAt?: string | null;
  shortLocateRespondedAt?: string | null;
  shortLocateExpiresAt?: string | null;
  trader: { name: string };
  activities: { id: number; message: string; createdAt: string }[];
};

export default function BrokerDesk() {
  const { data: session } = useSession();
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [ackId, setAckId] = useState<number | null>(null);
  const [locateDraft, setLocateDraft] = useState({
    shortLocateId: "",
    shortLocateQuantity: "",
    shortBorrowRatePct: "0.50",
    shortLocateProvider: "",
    shortLocateExpiresAt: "",
  });
  const [ackError, setAckError] = useState<string | null>(null);
  const [rejectCode, setRejectCode] = useState("BAD_SYMBOLOGY");

  function toIsoDatetime(value: string): string | null {
    if (!value.trim()) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString();
  }

  const load = useCallback(async () => {
    const res = await fetch("/api/orders");
    if (res.ok) {
      const data = await res.json();
      console.log("[BrokerDesk] orders response:", data);
      console.log("[BrokerDesk] total orders:", data.orders?.length ?? 0);
      if (data.orders?.length) {
        console.log("[BrokerDesk] statuses:", data.orders.map((o: ApiOrder) => ({ id: o.id, ticket: o.ticketKey, status: o.status })));
      }
      setOrders(data.orders ?? []);
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const queue = useMemo(
    () => orders.filter((o) => o.status === "RISK_APPROVED"),
    [orders],
  );

  const dailyLog = useMemo(() => {
    const lines: { t: string; msg: string }[] = [];
    for (const o of orders) {
      for (const a of o.activities) {
        lines.push({
          t: a.createdAt,
          msg: `${o.ticketKey} · ${a.message}`,
        });
      }
    }
    lines.sort((a, b) => new Date(b.t).getTime() - new Date(a.t).getTime());
    return lines.slice(0, 80);
  }, [orders]);

  async function ack(id: number) {
    const order = orders.find((o) => o.id === id);
    const isShort = order?.direction === "SHORT";
    const quantity = order?.quantity ?? 0;

    if (isShort) {
      const shortLocateId = locateDraft.shortLocateId.trim();
      const shortLocateProvider = locateDraft.shortLocateProvider.trim();
      const shortBorrowRatePct = Number(locateDraft.shortBorrowRatePct);
      const shortLocateQuantity = Number(locateDraft.shortLocateQuantity) || quantity;
      const shortLocateExpiresAt = toIsoDatetime(locateDraft.shortLocateExpiresAt);

      if (!shortLocateId || !shortLocateProvider || !Number.isFinite(shortBorrowRatePct) || shortBorrowRatePct <= 0) {
        setAckError("Enter locate ID, locate source, and a valid borrow rate before acknowledging.");
        return;
      }

      if (!Number.isFinite(shortLocateQuantity) || shortLocateQuantity <= 0) {
        setAckError("Enter a valid locate quantity before acknowledging.");
        return;
      }

      setAckError(null);
      const res = await fetch(`/api/orders/${id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "broker_ack",
          shortLocateId,
          shortLocateQuantity,
          shortBorrowRatePct,
          shortLocateProvider,
          shortLocateExpiresAt,
        }),
      });

      if (res.ok) {
        setAckId(null);
        setLocateDraft({
          shortLocateId: "",
          shortLocateQuantity: "",
          shortBorrowRatePct: "0.50",
          shortLocateProvider: "",
          shortLocateExpiresAt: "",
        });
        await load();
        return;
      }

      const data = await res.json().catch(() => null);
      setAckError(data?.error ?? "Failed to acknowledge locate");
      return;
    }

    const res = await fetch(`/api/orders/${id}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "broker_ack" }),
    });
    if (res.ok) {
      setAckId(null);
      await load();
    }
  }

  async function rej(id: number) {
    const res = await fetch(`/api/orders/${id}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "broker_reject",
        code: rejectCode,
        reason: "Rejected from broker desk",
      }),
    });
    if (res.ok) {
      setRejectId(null);
      setAckError(null);
      await load();
    }
  }

  const reasons = [
    "BAD_SYMBOLOGY",
    "INSUFFICIENT_MARGIN",
    "ACCOUNT_NOT_ENABLED",
    "OTHER",
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between">
          <div>
            <p className="text-xs uppercase text-slate-500">
              Millennium · Prime Broker
            </p>
            <h1 className="text-xl font-semibold">
              Incoming queue — {session?.user?.name}
            </h1>
          </div>
          <button
            type="button"
            onClick={() => signOut({ redirectTo: "/signIn" })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1200px] gap-6 px-4 py-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold">
            Awaiting acknowledgment ({queue.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">Ticket</th>
                  <th className="px-4 py-2">Ticker</th>
                  <th className="px-4 py-2">Side</th>
                  <th className="px-4 py-2">Qty</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Strategy</th>
                  <th className="px-4 py-2">Trader</th>
                  <th className="px-4 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center">
                      Loading…
                    </td>
                  </tr>
                ) : (
                  queue.map((o) => (
                    <tr key={o.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-mono text-xs text-blue-700">
                        {o.ticketKey}
                      </td>
                      <td className="px-4 py-3 font-medium">{o.ticker}</td>
                      <td className="px-4 py-3">{o.direction}</td>
                      <td className="px-4 py-3 tabular-nums">
                        {o.quantity.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">{o.orderType}</td>
                      <td className="px-4 py-3">{o.strategy}</td>
                      <td className="px-4 py-3">{o.trader.name}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            className="rounded bg-emerald-600 px-2 py-1 text-xs text-white"
                            onClick={() => {
                              if (o.direction === "SHORT") {
                                setAckError(null);
                                setAckId(ackId === o.id ? null : o.id);
                                setLocateDraft({
                                  shortLocateId: o.shortLocateId ?? "",
                                  shortLocateQuantity: String(o.shortLocateQuantity ?? o.quantity),
                                  shortBorrowRatePct: String(o.shortBorrowRatePct ?? o.shortBorrowRateCapPct ?? 0.5),
                                  shortLocateProvider: o.shortLocateProvider ?? "",
                                  shortLocateExpiresAt: o.shortLocateExpiresAt
                                    ? o.shortLocateExpiresAt.slice(0, 16)
                                    : "",
                                });
                                return;
                              }
                              void ack(o.id);
                            }}
                          >
                            {o.direction === "SHORT" ? "Ack + locate" : "Acknowledge"}
                          </button>
                          <button
                            type="button"
                            className="rounded border border-red-300 px-2 py-1 text-xs text-red-700"
                            onClick={() =>
                              setRejectId(rejectId === o.id ? null : o.id)
                            }
                          >
                            Reject
                          </button>
                          {rejectId === o.id && (
                            <div className="mt-2 flex flex-col gap-1 rounded border border-slate-200 p-2">
                              <select
                                value={rejectCode}
                                onChange={(e) => setRejectCode(e.target.value)}
                                className="rounded border px-1 py-1 text-xs"
                              >
                                {reasons.map((r) => (
                                  <option key={r} value={r}>
                                    {r.replace(/_/g, " ")}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                className="rounded bg-red-600 px-2 py-1 text-xs text-white"
                                onClick={() => rej(o.id)}
                              >
                                Confirm reject
                              </button>
                            </div>
                          )}
                          {ackId === o.id && o.direction === "SHORT" && (
                            <div className="mt-2 flex flex-col gap-2 rounded border border-indigo-200 bg-indigo-50 p-2">
                              <input
                                value={locateDraft.shortLocateId}
                                onChange={(e) =>
                                  setLocateDraft((prev) => ({ ...prev, shortLocateId: e.target.value }))
                                }
                                placeholder="shortLocateId"
                                className="rounded border border-indigo-200 px-2 py-1 text-xs"
                              />
                              <input
                                value={locateDraft.shortLocateProvider}
                                onChange={(e) =>
                                  setLocateDraft((prev) => ({ ...prev, shortLocateProvider: e.target.value }))
                                }
                                placeholder="shortLocateProvider"
                                className="rounded border border-indigo-200 px-2 py-1 text-xs"
                              />
                              <div className="grid grid-cols-2 gap-1">
                                <input
                                  type="number"
                                  value={locateDraft.shortLocateQuantity}
                                  onChange={(e) =>
                                    setLocateDraft((prev) => ({ ...prev, shortLocateQuantity: e.target.value }))
                                  }
                                  placeholder="Qty"
                                  className="rounded border border-indigo-200 px-2 py-1 text-xs"
                                />
                                <input
                                  type="number"
                                  step="0.01"
                                  value={locateDraft.shortBorrowRatePct}
                                  onChange={(e) =>
                                    setLocateDraft((prev) => ({ ...prev, shortBorrowRatePct: e.target.value }))
                                  }
                                  placeholder="shortBorrowRatePct"
                                  className="rounded border border-indigo-200 px-2 py-1 text-xs"
                                />
                              </div>
                              <input
                                type="datetime-local"
                                value={locateDraft.shortLocateExpiresAt}
                                onChange={(e) =>
                                  setLocateDraft((prev) => ({ ...prev, shortLocateExpiresAt: e.target.value }))
                                }
                                placeholder="shortLocateExpiresAt"
                                className="rounded border border-indigo-200 px-2 py-1 text-xs"
                              />
                              <button
                                type="button"
                                className="rounded bg-emerald-600 px-2 py-1 text-xs text-white"
                                onClick={() => void ack(o.id)}
                              >
                                Confirm locate + acknowledge
                              </button>
                              {ackError && (
                                <p className="text-xs text-rose-700">{ackError}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">Daily activity log</h2>
          <ul className="max-h-[560px] space-y-2 overflow-y-auto text-sm">
            {dailyLog.map((line, i) => (
              <li
                key={`${line.t}-${i}`}
                className="border-b border-slate-50 pb-2 text-slate-700"
              >
                <span className="text-xs text-slate-400">
                  {new Date(line.t).toLocaleString()}
                </span>
                <br />
                {line.msg}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
