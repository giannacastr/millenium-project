import type { OrderStatus } from "@prisma/client";
import { TICKER_META } from "./exposure";

export type OrderForExecution = {
  id: number;
  ticker: string;
  quantity: number;
  direction: string;
  strategy: string;
  limitPrice: string | null;
  status: OrderStatus;
  createdAt: string;
  activities: { message: string; createdAt: string }[];
};

const FULL_RE = /Fully filled @ \$([\d.]+)/;
const PARTIAL_RE = /Partial fill: ([\d,]+) shares @ \$([\d.]+)/;

export function resolveExecutionFill(order: OrderForExecution): {
  timeIso: string;
  qty: number;
  price: number;
  fillLabel: "Filled" | "Partial";
} {
  const activitiesDesc = [...order.activities].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  for (const a of activitiesDesc) {
    const full = FULL_RE.exec(a.message);
    if (full) {
      return {
        timeIso: a.createdAt,
        qty: order.quantity,
        price: Number(full[1]),
        fillLabel: "Filled",
      };
    }
    const partial = PARTIAL_RE.exec(a.message);
    if (partial) {
      return {
        timeIso: a.createdAt,
        qty: Number(partial[1].replace(/,/g, "")),
        price: Number(partial[2]),
        fillLabel: "Partial",
      };
    }
  }

  const ref =
    Number(order.limitPrice) ||
    TICKER_META[order.ticker]?.price ||
    0;
  return {
    timeIso: order.createdAt,
    qty: order.quantity,
    price: ref,
    fillLabel: order.status === "FULLY_FILLED" ? "Filled" : "Partial",
  };
}
