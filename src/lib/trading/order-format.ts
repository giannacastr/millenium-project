import type { OrderDirection } from "@prisma/client";

export function formatOrderTitle(
  direction: OrderDirection,
  ticker: string,
  quantity: number,
): string {
  const d =
    direction === "BUY"
      ? "Buy"
      : direction === "SELL"
        ? "Sell"
        : "Short";
  return `${d} ${ticker} · ${quantity.toLocaleString()} shares`;
}

export async function nextTicketKey(
  nextId: () => Promise<number>,
): Promise<string> {
  const n = await nextId();
  return `EQ-${String(n).padStart(3, "0")}`;
}
