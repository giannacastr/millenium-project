"use client";

import { useSession, signOut } from "next-auth/react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  createAllocationDraft,
  formatAllocationSummary,
  hasValidAllocationTotal,
  normalizeAllocationDrafts,
  type AllocationDraft,
} from "@/lib/trading/allocation";
import PreTradeImpactAnalysis from "@/components/PreTradeImpactAnalysis";
import PreTradeAllocationEditor from "@/components/PreTradeAllocationEditor";
import IntradayTickerChart from "@/components/IntradayTickerChart";
import Top5Positions from "@/components/Top5Positions";
import BuyingPowerGauge from "@/components/BuyingPowerGauge";
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
  shortLocateStatus?: string | null;
  shortLocateId?: string | null;
  shortLocateQuantity?: number | null;
  shortBorrowRateCapPct?: number | null;
  shortBorrowRatePct?: number | null;
  shortLocateProvider?: string | null;
  shortLocateRequestedAt?: string | null;
  shortLocateRespondedAt?: string | null;
  shortLocateExpiresAt?: string | null;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
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
  activities: { id: number; message: string; actorName: string | null; createdAt: string }[];
  trader: { name: string };
};

type TicketState = {
  direction: "BUY" | "SELL" | "SHORT";
  ticker: string;
  quantity: number;
  orderType: "MARKET" | "LIMIT" | "VWAP";
  limitPrice: string;
  allocations: AllocationDraft[];
  strategy: string;
  notes: string;
  shortLocateQuantity: number;
  shortBorrowRateCapPct: string;
  shortLocateProvider: string;
  shortLocateNotes: string;
};

function createEmptyTicket(): TicketState {
  return {
    direction: "BUY",
    ticker: "",
    quantity: 5000,
    orderType: "MARKET",
    limitPrice: "",
    allocations: [createAllocationDraft(ACCOUNT_OPTIONS[0], "100")],
    strategy: STRATEGY_OPTIONS[0],
    notes: "",
    shortLocateQuantity: 5000,
    shortBorrowRateCapPct: "0.50",
    shortLocateProvider: "",
    shortLocateNotes: "",
  };
}

function createTicketFromOrder(order: ApiOrder): TicketState {
  return {
    direction: order.direction as TicketState["direction"],
    ticker: order.ticker,
    quantity: order.quantity,
    orderType: order.orderType as TicketState["orderType"],
    limitPrice: order.limitPrice ?? "",
    allocations:
      order.allocationInstructions.length > 0
        ? order.allocationInstructions.map((allocation) =>
            createAllocationDraft(allocation.account, String(allocation.weightPct)),
          )
        : [createAllocationDraft(order.account, "100")],
    strategy: order.strategy,
    notes: order.notes ?? "",
    shortLocateQuantity: order.shortLocateQuantity ?? order.quantity,
    shortBorrowRateCapPct: order.shortBorrowRateCapPct != null ? String(order.shortBorrowRateCapPct) : "0.50",
    shortLocateProvider: order.shortLocateProvider ?? "",
    shortLocateNotes: order.notes ?? "",
  };
}

function isCancelableStatus(status: OrderStatus): boolean {
  return [
    "DRAFT",
    "SUBMITTED",
    "IN_REVIEW",
    "RISK_APPROVED",
    "ACKNOWLEDGED",
    "PARTIALLY_FILLED",
  ].includes(status);
}

export default function TraderDesk() {
  const { data: session } = useSession();
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [bucket, setBucket] = useState<BlotterFilter>("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [amendSourceOrder, setAmendSourceOrder] = useState<ApiOrder | null>(null);
  const [cancelTargetOrder, setCancelTargetOrder] = useState<ApiOrder | null>(null);
  const [sort, setSort] = useState<"time" | "ticker" | "status">("time");
  const [tickerOptions, setTickerOptions] = useState<string[]>(
    Object.keys(TICKER_META).sort(),
  );
  const [tickerDetails, setTickerDetails] = useState<
    Record<string, { companyName: string; sector: string; price: number }>
  >({});
  const [tickerQuery, setTickerQuery] = useState("");
  const [tickerDropdownOpen, setTickerDropdownOpen] = useState(false);
  const [exposureSnapshot, setExposureSnapshot] = useState<{
    exposure: ExposureDTO;
    limits: RiskLimitsDTO;
  } | null>(null);

  const [ticket, setTicket] = useState<TicketState>(() => createEmptyTicket());

  const normalizedAllocations = useMemo(
    () => normalizeAllocationDrafts(ticket.allocations),
    [ticket.allocations],
  );
  const allocationSummary = useMemo(
    () =>
      normalizedAllocations.length > 0
        ? formatAllocationSummary(normalizedAllocations)
        : ACCOUNT_OPTIONS[0],
    [normalizedAllocations],
  );
  const allocationTotalOk = useMemo(
    () => hasValidAllocationTotal(normalizedAllocations),
    [normalizedAllocations],
  );

  const load = useCallback(async () => {
    const res = await fetch("/api/orders", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setOrders(data.orders ?? []);
  }, []);

  const loadExposure = useCallback(async () => {
    try {
      const res = await fetch("/api/exposure", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.exposure && data.limits) {
        setExposureSnapshot({
          exposure: data.exposure as ExposureDTO,
          limits: data.limits as RiskLimitsDTO,
        });
      }
    } catch {
      // non-critical; exposure loads on next poll
    }
  }, []);

  useEffect(() => {
    Promise.all([load(), loadExposure()]).finally(() => setLoading(false));
  }, [load, loadExposure]);

  useEffect(() => {
    let cancelled = false;
    async function loadTickers() {
      try {
        const res = await fetch("/api/tickers", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const details: Record<
          string,
          { companyName: string; sector: string; price: number }
        > = {};
        const symbols = Array.isArray(data.symbols)
          ? data.symbols
              .map((item: { symbol?: string; companyName?: string; sector?: string; price?: number }) => {
                if (item.symbol) {
                  details[item.symbol] = {
                    companyName: item.companyName ?? item.symbol,
                    sector: item.sector ?? "Other",
                    price: item.price ?? 0,
                  };
                }
                return item.symbol;
              })
              .filter((symbol: string | undefined): symbol is string => Boolean(symbol))
              .sort((a: string, b: string) => a.localeCompare(b))
          : [];
        if (!cancelled && symbols.length > 0) {
          setTickerOptions(symbols);
          setTickerDetails(details);
        }
      } catch {
        // Keep the local fallback list if the API is unavailable.
      }
    }

    void loadTickers();
    return () => {
      cancelled = true;
    };
  }, []);

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
  const currentTicketPrice = tickerDetails[ticket.ticker]?.price ?? tickerMeta.price;
  const filteredTickers = useMemo(() => {
    const query = tickerQuery.trim().toUpperCase();
    const base = [...tickerOptions].sort((a, b) => a.localeCompare(b));
    if (!query) return base;
    return base.filter((sym) => sym.toUpperCase().startsWith(query));
  }, [tickerOptions, tickerQuery]);
  const limitNum =
    ticket.orderType === "LIMIT" && ticket.limitPrice
      ? Number(ticket.limitPrice)
      : undefined;
  const impact = computePreTradeImpact({
    ticker: ticket.ticker,
    quantity: ticket.quantity,
    limitPrice: limitNum,
    livePrice: currentTicketPrice,
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

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedId) ?? null,
    [orders, selectedId],
  );

  const counts = useMemo(() => {
    const c = {
      draft: 0,
      submitted: 0,
      inReview: 0,
      filled: 0,
      rejected: 0,
    };
    for (const o of orders) {
      const status = o.status as string;
      if (status === "DRAFT") c.draft++;
      if (status === "SUBMITTED") c.submitted++;
      if (status === "IN_REVIEW") c.inReview++;
      if (status === "PARTIALLY_FILLED" || status === "FULLY_FILLED")
        c.filled++;
      if (status === "REJECTED" || status === "CANCELLED" || status === "CANCELLED_PARTIAL")
        c.rejected++;
    }
    return c;
  }, [orders]);

  function openNewTicket() {
    setTicket(createEmptyTicket());
    setAmendSourceOrder(null);
    setDrawerOpen(true);
    setTickerQuery("");
    setTickerDropdownOpen(false);
    setSubmitError(null);
  }

  function openAmendTicket(order: ApiOrder) {
    setTicket(createTicketFromOrder(order));
    setAmendSourceOrder(order);
    setDrawerOpen(true);
    setSelectedId(order.id);
    setTickerQuery(order.ticker);
    setTickerDropdownOpen(false);
  }

  async function submitTicket(mode: "draft" | "submit") {
    setSubmitError(null);

    const sym = ticket.ticker.trim().toUpperCase();
    if (!sym) {
      setSubmitError("Please input a valid stock ticker.");
      return false;
    }
    if (!tickerOptions.includes(sym)) {
      setSubmitError("Invalid ticker — please input a valid stock ticker.");
      return false;
    }

    const payload = {
      direction: ticket.direction,
      ticker: ticket.ticker,
      quantity: ticket.quantity,
      orderType: ticket.orderType,
      limitPrice:
        ticket.orderType === "LIMIT" ? Number(ticket.limitPrice) || null : null,
      account: allocationSummary,
      allocations: normalizedAllocations,
      strategy: ticket.strategy,
      notes:
        ticket.direction === "SHORT" && ticket.shortLocateNotes.trim().length > 0
          ? `${ticket.notes ? `${ticket.notes}\n\n` : ""}${ticket.shortLocateNotes.trim()}`
          : ticket.notes,
      shortLocateQuantity:
        ticket.direction === "SHORT" ? ticket.shortLocateQuantity : undefined,
      shortBorrowRateCapPct:
        ticket.direction === "SHORT" && ticket.shortBorrowRateCapPct.trim().length > 0
          ? Number(ticket.shortBorrowRateCapPct)
          : undefined,
      shortLocateProvider:
        ticket.direction === "SHORT" ? ticket.shortLocateProvider : undefined,
      mode,
    };

    if (amendSourceOrder?.status === "DRAFT") {
      const patchRes = await fetch(`/api/orders/${amendSourceOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!patchRes.ok) {
        const patchErr = await patchRes.json().catch(() => null);
        setSubmitError(patchErr?.error ?? "Failed to update draft.");
        return false;
      }

      if (mode === "submit") {
        const submitRes = await fetch(`/api/orders/${amendSourceOrder.id}/transition`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "submit_draft" }),
        });
        if (!submitRes.ok) {
          const submitErr = await submitRes.json().catch(() => null);
          setSubmitError(submitErr?.error ?? "Failed to submit draft.");
          return false;
        }
      }

      setDrawerOpen(false);
      setTickerDropdownOpen(false);
      setAmendSourceOrder(null);
      await load();
      setSelectedId(amendSourceOrder.id);
      return true;
    }

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      setSubmitError(err?.error ?? "Failed to create order.");
      return false;
    }
    const data = await res.json();
    setDrawerOpen(false);
    setTickerDropdownOpen(false);
    setAmendSourceOrder(null);
    await load();
    setSelectedId(data.order?.id ?? null);
    return true;
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
      return true;
    }
    return false;
  }

  async function confirmCancel() {
    if (!cancelTargetOrder) return;
    const ok = await runTransition(cancelTargetOrder.id, { action: "cancel" });
    if (ok) {
      setCancelTargetOrder(null);
    }
  }

  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const [leftWidth, setLeftWidth] = useState<number | null>(null);
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    setIsLargeScreen(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setIsLargeScreen(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!containerRef.current || leftWidth !== null || !isLargeScreen) return;
    const total = containerRef.current.offsetWidth;
    const leftMinPx = total * 0.63;
    const leftDefaultPx = total - 405 - 8;
    setLeftWidth(Math.max(leftMinPx, leftDefaultPx));
  }, [leftWidth, isLargeScreen]);

  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const minLeft = rect.width * 0.63;
      const maxLeft = rect.width - 405 - 8;
      setLeftWidth(Math.max(minLeft, Math.min(maxLeft, x)));
    };
    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

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
      <header className="sticky top-0 z-30 border-b-[4.5px] border-[#1434CB] bg-white/95 backdrop-blur">
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
              onClick={openNewTicket}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              New order ticket
            </button>
            <button
              type="button"
              onClick={() => signOut({ redirectTo: "/platform" })}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
            >
              Sign out
            </button>
            <img src="/images/logo-mlp.png" alt="Millennium" className="ml-3 h-5 w-auto mt-2" />
          </div>
        </div>
      </header>

      <div ref={containerRef} className="mx-auto flex max-w-[1600px] flex-col px-4 py-6 lg:flex-row">
        <div className="space-y-4 overflow-hidden" style={{ flexShrink: 0, width: isLargeScreen && leftWidth != null ? leftWidth : undefined }}>
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
                  <th className="px-4 py-3">Avg Px</th>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                      Loading…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
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
                            <div className="flex flex-col gap-1">
                              <span
                                className={`inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-medium ${statusPillClass(o.status)}`}
                              >
                                {STATUS_LABEL[o.status]}
                              </span>
                              {o.filledQuantity > 0 && (
                                <span className="text-xs text-slate-500">
                                  {o.filledQuantity.toLocaleString()} / {o.quantity.toLocaleString()}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 tabular-nums text-slate-700">
                            {o.averageFillPrice != null
                              ? `$${o.averageFillPrice.toFixed(2)}`
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {new Date(o.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  if (isCancelableStatus(o.status)) {
                                    setCancelTargetOrder(o);
                                  }
                                }}
                                disabled={!isCancelableStatus(o.status)}
                                title={
                                  isCancelableStatus(o.status)
                                    ? "Cancel order"
                                    : "Order cannot be cancelled in its current state"
                                }
                                className={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-sm transition ${
                                  isCancelableStatus(o.status)
                                    ? "border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
                                    : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                                }`}
                                aria-label={`Cancel ${o.ticketKey}`}
                              >
                                ×
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openAmendTicket(o);
                                }}
                                title="Amend order"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                                aria-label={`Amend ${o.ticketKey}`}
                              >
                                ✎
                              </button>
                            </div>
                          </td>
                        </tr>
                        {expanded && (
                          <tr className="border-b border-slate-200 bg-slate-50/50">
                            <td colSpan={9} className="p-0 align-top">
                              <OrderExecutionExpand
                                order={o}
                                onRunTransition={(body: Record<string, unknown>) =>
                                  runTransition(o.id, body)
                                }
                                currentPrice={
                                  o.ticker === ticket.ticker
                                    ? currentTicketPrice
                                    : undefined
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

        <div
          className="hidden lg:block cursor-col-resize shrink-0"
          style={{ width: 8 }}
          onMouseDown={handleDividerMouseDown}
        />

        <aside className="space-y-4 overflow-hidden" style={{ flex: "1 1 0%", minWidth: 0 }}>
          {selectedOrder && (
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              {(() => {
                const companyName =
                  tickerDetails[selectedOrder.ticker]?.companyName ??
                  TICKER_META[selectedOrder.ticker]?.companyName ??
                  selectedOrder.ticker;
                return (
                  <>
              <h3 className="mb-3 text-sm font-semibold text-slate-900">
                {selectedOrder.ticketKey} · {companyName}
              </h3>
              <p className="mb-3 text-xs italic text-slate-500">
                Selected order chart. Click a different row to switch.
              </p>
              <IntradayTickerChart
                ticker={selectedOrder.ticker}
                submittedAt={selectedOrder.createdAt}
                fills={selectedOrder.fills.map((fill) => ({
                  price: fill.price,
                  executedAt: fill.executedAt,
                  quantity: fill.quantity,
                }))}
                currentPrice={
                  selectedOrder.averageFillPrice ??
                  tickerDetails[selectedOrder.ticker]?.price ??
                  TICKER_META[selectedOrder.ticker]?.price ??
                  150
                }
              />
                  </>
                );
              })()}
            </section>
          )}

          <Top5Positions exposure={exposureSnapshot?.exposure ?? null} />

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
                <div className="mb-4 flex justify-center">
                  <BuyingPowerGauge
                    usedPct={exposureSnapshot.exposure.buyingPowerUsed}
                    capPct={exposureSnapshot.limits.buyingPowerUsedCapPct}
                    title="Buying Power Utilization"
                    showLabel={true}
                  />
                </div>
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
                <p className="mb-2 text-sm font-semibold text-slate-500">
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
                <p className="mb-2 mt-4 text-sm font-semibold text-slate-500">
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
              <div>
                <h2 className="text-lg font-semibold">
                  {amendSourceOrder ? "Amend equity ticket" : "New equity ticket"}
                </h2>
                {amendSourceOrder && amendSourceOrder.status !== "DRAFT" && (
                  <p className="text-xs text-amber-700">
                    Amending {amendSourceOrder.ticketKey} — changes will require re-submission.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  setAmendSourceOrder(null);
                  setTickerDropdownOpen(false);
                  setSubmitError(null);
                }}
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
                      setTicket((t) => ({
                        ...t,
                        direction: d,
                        allocations:
                          d === "SHORT" && t.allocations.length === 1 && t.allocations[0].account === "Long Book"
                            ? [createAllocationDraft("Short Book", t.allocations[0].weightPct)]
                            : d !== "SHORT" && t.allocations.length === 1 && t.allocations[0].account === "Short Book"
                              ? [createAllocationDraft("Long Book", t.allocations[0].weightPct)]
                              : t.allocations,
                      }))
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
                <div className="relative mt-1">
                  <input
                    value={tickerQuery}
                    onChange={(e) => {
                      const next = e.target.value.toUpperCase();
                      setTickerQuery(next);
                      setTickerDropdownOpen(true);
                      setSubmitError(null);
                      if (filteredTickers.length === 1 && filteredTickers[0] === next) {
                        setTicket((t) => ({ ...t, ticker: next }));
                      }
                    }}
                    onFocus={() => setTickerDropdownOpen(true)}
                    onBlur={() => {
                      window.setTimeout(() => setTickerDropdownOpen(false), 120);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const next = filteredTickers[0];
                        if (next) {
                          e.preventDefault();
                          setTicket((t) => ({ ...t, ticker: next }));
                          setTickerQuery(next);
                          setTickerDropdownOpen(false);
                        }
                      }
                    }}
                    className="w-full rounded border border-slate-300 px-3 py-2 font-mono uppercase tracking-wide"
                    placeholder="Type ticker"
                    autoComplete="off"
                  />
                  {tickerDropdownOpen && filteredTickers.length > 0 && (
                    <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                      {filteredTickers.map((sym) => (
                        <button
                          key={sym}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setTicket((t) => ({ ...t, ticker: sym }));
                            setTickerQuery(sym);
                            setTickerDropdownOpen(false);
                          }}
                          className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                            sym === ticket.ticker ? "bg-slate-50" : ""
                          }`}
                        >
                          <span className="font-mono font-medium text-slate-900">{sym}</span>
                          <span className="text-xs text-slate-500">
                            {tickerDetails[sym]?.companyName ?? TICKER_META[sym]?.companyName ?? sym}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Start typing to filter available tickers in alphabetical order.
                </p>
              </label>
              <DraftTickerInsight ticker={ticket.ticker} />
              <label className="block text-sm">
                <span className="text-slate-600">Quantity</span>
                <input
                  type="number"
                  value={ticket.quantity}
                  onChange={(e) => {
                    const nextQty = Number(e.target.value);
                    setTicket((t) => ({
                      ...t,
                      quantity: nextQty,
                      shortLocateQuantity:
                        t.direction === "SHORT" && t.shortLocateQuantity === t.quantity
                          ? nextQty
                          : t.shortLocateQuantity,
                    }));
                  }}
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
              {ticket.direction === "SHORT" && (
                <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                  <div className="rounded-lg border border-amber-300 bg-amber-100/60 px-3 py-2">
                    <p className="text-xs font-medium text-amber-900">
                      Short selling sells borrowed shares, hoping to buy them back cheaper. If the price
                      rises instead, losses are unlimited. A locate (borrow confirmation) from the prime
                      broker is required before the short can be executed.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Short locate request</h3>
                    <p className="mt-1 text-xs text-slate-600">
                      These details tell the prime broker which shares to borrow and at what cost.
                    </p>
                  </div>
                  <label className="block text-sm">
                    <span className="text-slate-600">Shares to borrow (locate quantity)</span>
                    <p className="text-xs text-slate-500">How many shares you need to borrow from the broker. Usually matches the order quantity.</p>
                    <input
                      type="number"
                      value={ticket.shortLocateQuantity}
                      onChange={(e) =>
                        setTicket((t) => ({ ...t, shortLocateQuantity: Number(e.target.value) }))
                      }
                      className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-slate-600">Max acceptable borrow rate (% annual)</span>
                    <p className="text-xs text-slate-500">The highest annual interest rate you are willing to pay on the borrowed shares. Hard-to-borrow stocks can have rates above 50%.</p>
                    <input
                      type="number"
                      step="0.01"
                      value={ticket.shortBorrowRateCapPct}
                      onChange={(e) =>
                        setTicket((t) => ({ ...t, shortBorrowRateCapPct: e.target.value }))
                      }
                      className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-slate-600">Preferred locate source</span>
                    <p className="text-xs text-slate-500">Where to source the borrow — the broker's internal inventory, a third-party lender, or another prime broker.</p>
                    <input
                      type="text"
                      value={ticket.shortLocateProvider}
                      onChange={(e) =>
                        setTicket((t) => ({ ...t, shortLocateProvider: e.target.value }))
                      }
                      placeholder="e.g. Prime broker, internal desk, external lender"
                      className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                    />
                  </label>
                  <div className="block text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Short rationale / cover plan</span>
                      <button
                        type="button"
                        disabled={aiLoading || !ticket.ticker}
                        onClick={async () => {
                          setAiLoading(true);
                          setAiError(null);
                          try {
                            const res = await fetch("/api/ai/generate-rationale", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ ticker: ticket.ticker }),
                            });
                            const data = await res.json();
                            if (res.ok) {
                              setTicket((t) => ({ ...t, shortLocateNotes: data.rationale }));
                            } else {
                              setAiError(data.error ?? "Failed to generate");
                            }
                          } catch {
                            setAiError("Network error");
                          } finally {
                            setAiLoading(false);
                          }
                        }}
                        className="rounded bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-800 hover:bg-indigo-200 disabled:opacity-40"
                      >
                        {aiLoading ? "Generating..." : "Generate with AI"}
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Explain why you expect the stock to fall and how/when you plan to cover (buy back) the position.</p>
                    <textarea
                      value={ticket.shortLocateNotes}
                      onChange={(e) =>
                        setTicket((t) => ({ ...t, shortLocateNotes: e.target.value }))
                      }
                      rows={3}
                      className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                    />
                    {aiError && <p className="mt-1 text-xs text-red-600">{aiError}</p>}
                  </div>
                </section>
              )}
              <PreTradeAllocationEditor
                value={ticket.allocations}
                onChange={(allocations) =>
                  setTicket((t) => ({ ...t, allocations }))
                }
                availableAccounts={ACCOUNT_OPTIONS}
              />
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

              <div className="rounded-lg bg-slate-50 p-4">
                {exposureSnapshot ? (
                  <PreTradeImpactAnalysis
                    impact={impact}
                    limits={exposureSnapshot.limits}
                  />
                ) : (
                  <div>
                    <h4 className="mb-2 text-sm font-semibold text-slate-800">
                      Pre-trade impact (legacy demo curve)
                    </h4>
                    <ul className="space-y-1 text-sm text-slate-600">
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
                    {impact.triggeredChecks.length > 0 && (
                      <p className="mt-2 text-amber-700">
                        Flags: {impact.triggeredChecks.join(", ")}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {submitError && (
                <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {submitError}
                </div>
              )}

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
                  {amendSourceOrder?.status === "DRAFT" ? "Submit draft" : "Submit for review"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {cancelTargetOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">
                  Confirm cancel request
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">
                  Cancel {cancelTargetOrder.ticketKey}?
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCancelTargetOrder(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>
            <p className="text-sm leading-6 text-slate-600">
              This order is at the broker. Cancelling will send a cancel request. Any filled shares cannot be recalled.
            </p>
            {cancelTargetOrder.filledQuantity > 0 && (
              <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Filled so far: {cancelTargetOrder.filledQuantity.toLocaleString()} shares.
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelTargetOrder(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
              >
                Keep order
              </button>
              <button
                type="button"
                onClick={() => void confirmCancel()}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
              >
                Send cancel request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
