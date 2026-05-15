"use client";

import { useEffect, useMemo, useState } from "react";
import OrderExecutionExpand from "../../../trader/OrderExecutionExpand";

type ApiOrder = any;

function parsePrimaryAccounts(order: ApiOrder): string[] {
  if (order.allocationInstructions && order.allocationInstructions.length > 0) {
    return order.allocationInstructions.map((a: any) => a.account);
  }
  if (typeof order.account === "string") {
    // account may be of the form "Long Book — 100%" or "Long Book"
    const parts = order.account.split(" · ").map((p: string) => p.split(" — ")[0].trim());
    return parts.filter(Boolean);
  }
  return ["Unspecified"];
}

export default function AdminOrdersView() {
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ApiOrder | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/orders", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!data.orders) {
          setError(data.error ?? "Failed to load orders");
          setOrders([]);
        } else {
          setOrders(data.orders);
        }
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }, []);

  const groups = useMemo(() => {
    const map = new Map<string, ApiOrder[]>();
    for (const o of orders) {
      const accounts = parsePrimaryAccounts(o);
      for (const a of accounts) {
        if (!map.has(a)) map.set(a, []);
        map.get(a)!.push(o);
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [orders]);

  return (
    <div>
      <h3 className="text-lg font-semibold">Filled orders by account</h3>
      <p className="text-sm text-slate-500">Click an order to view details and allocations.</p>

      {loading ? (
        <div className="mt-6 text-sm text-slate-500">Loading orders…</div>
      ) : error ? (
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">{error}</div>
      ) : groups.length === 0 ? (
        <div className="mt-6 text-sm text-slate-500">No orders found.</div>
      ) : (
        <div className="mt-4 space-y-6">
          {groups.map(([account, rows]) => (
            <section key={account} className="rounded-lg border border-slate-100 bg-white">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-900">{account}</div>
                  <div className="text-xs text-slate-500">{rows.length} orders</div>
                </div>
              </div>
              <div className="overflow-x-auto p-3">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-slate-500 uppercase">
                    <tr>
                      <th className="px-3 py-2">Ticket</th>
                      <th className="px-3 py-2">Ticker</th>
                      <th className="px-3 py-2">Qty</th>
                      <th className="px-3 py-2">Filled</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Trader</th>
                      <th className="px-3 py-2">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((o: any) => (
                      <tr
                        key={o.id}
                        className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                        onClick={() => setSelected(o)}
                      >
                        <td className="px-3 py-2 font-mono text-xs">{o.ticketKey}</td>
                        <td className="px-3 py-2">{o.ticker}</td>
                        <td className="px-3 py-2">{o.quantity.toLocaleString?.() ?? o.quantity}</td>
                        <td className="px-3 py-2">{o.filledQuantity?.toLocaleString?.() ?? o.filledQuantity}</td>
                        <td className="px-3 py-2">{o.status}</td>
                        <td className="px-3 py-2">{o.trader?.name ?? "-"}</td>
                        <td className="px-3 py-2">{new Date(o.updatedAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-6">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-4xl max-h-[calc(100vh-6rem)] overflow-y-auto rounded-lg bg-white p-6 shadow-lg">
            <div className="flex items-start justify-between">
              <h4 className="text-lg font-semibold">Order {selected.ticketKey}</h4>
              <button className="text-sm text-slate-500" onClick={() => setSelected(null)}>Close</button>
            </div>
            <div className="mt-4">
              <OrderExecutionExpand order={selected} onRunTransition={() => {}} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
