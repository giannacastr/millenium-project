import type { OrderStatus } from "@prisma/client";

export const STATUS_LABEL: Record<OrderStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  IN_REVIEW: "In Review",
  RISK_APPROVED: "Approved / broker pending",
  ACKNOWLEDGED: "Acknowledged",
  PARTIALLY_FILLED: "Partially Filled",
  FULLY_FILLED: "Fully Filled",
  CANCELLED_PARTIAL: "Cancelled (partial)",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

export function statusPillClass(status: OrderStatus): string {
  switch (status) {
    case "DRAFT":
      return "bg-slate-200 text-slate-800";
    case "SUBMITTED":
    case "IN_REVIEW":
      return "bg-amber-100 text-amber-900";
    case "RISK_APPROVED":
      return "bg-indigo-100 text-indigo-900";
    case "ACKNOWLEDGED":
      return "bg-cyan-100 text-cyan-900";
    case "PARTIALLY_FILLED":
      return "bg-blue-100 text-blue-900";
    case "FULLY_FILLED":
      return "bg-emerald-100 text-emerald-900";
    case "CANCELLED_PARTIAL":
      return "bg-orange-100 text-orange-900";
    case "REJECTED":
    case "CANCELLED":
      return "bg-red-100 text-red-900";
    default:
      return "bg-gray-200 text-gray-800";
  }
}

/** Summary strip buckets matching product copy */
export type BlotterFilter =
  | "all"
  | "draft"
  | "submitted"
  | "inReview"
  | "filled"
  | "rejected";

export function filterForBucket(
  status: OrderStatus,
  bucket: BlotterFilter,
): boolean {
  if (bucket === "all") return true;
  if (bucket === "draft") return status === "DRAFT";
  if (bucket === "submitted") return status === "SUBMITTED";
  if (bucket === "inReview") return status === "IN_REVIEW";
  if (bucket === "filled")
    return status === "PARTIALLY_FILLED" || status === "FULLY_FILLED";
  if (bucket === "rejected")
    return status === "REJECTED" || status === "CANCELLED" || status === "CANCELLED_PARTIAL";
  return true;
}
