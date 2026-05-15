export type AllocationDraft = {
  id: string;
  account: string;
  weightPct: string;
};

export type AllocationInstructionInput = {
  account: string;
  weightPct: number;
};

export type AllocationInstructionRecord = AllocationInstructionInput & {
  id: number;
  sequence: number;
};

export type AllocationSplit = AllocationInstructionRecord & {
  shares: number;
  notional: number;
};

export function createAllocationDraft(
  account = "Long Book",
  weightPct = "100",
): AllocationDraft {
  return {
    id: `alloc-${Math.random().toString(36).slice(2, 10)}`,
    account,
    weightPct,
  };
}

export function normalizeAllocationDrafts(
  drafts: AllocationDraft[],
): AllocationInstructionInput[] {
  return drafts
    .map((draft) => ({
      account: draft.account.trim(),
      weightPct: Number(draft.weightPct),
    }))
    .filter((row) => row.account.length > 0 && Number.isFinite(row.weightPct) && row.weightPct > 0);
}

export function allocationWeightTotal(rows: AllocationInstructionInput[]): number {
  return rows.reduce((sum, row) => sum + row.weightPct, 0);
}

export function formatWeight(weightPct: number): string {
  return Number.isInteger(weightPct) ? `${weightPct}%` : `${weightPct.toFixed(1)}%`;
}

export function formatAllocationSummary(rows: AllocationInstructionInput[]): string {
  return rows.map((row) => `${row.account} — ${formatWeight(row.weightPct)}`).join(" · ");
}

export function buildDefaultAllocations(account: string): AllocationInstructionInput[] {
  const trimmed = account.trim();
  return [{ account: trimmed.length > 0 ? trimmed : "Long Book", weightPct: 100 }];
}

export function splitQuantityAcrossAllocations(
  quantity: number,
  allocations: AllocationInstructionRecord[],
): Array<AllocationSplit> {
  if (quantity <= 0) return [];
  if (!allocations.length) return [];

  const totalWeight = allocationWeightTotal(allocations);
  if (totalWeight <= 0) return [];

  const rawSplits = allocations.map((allocation) => {
    const exact = (quantity * allocation.weightPct) / totalWeight;
    const shares = Math.floor(exact);
    return {
      ...allocation,
      shares,
      remainder: exact - shares,
      notional: 0,
    };
  });

  let remaining = quantity - rawSplits.reduce((sum, row) => sum + row.shares, 0);
  const ranked = [...rawSplits].sort((a, b) => {
    if (b.remainder !== a.remainder) return b.remainder - a.remainder;
    return a.sequence - b.sequence;
  });

  for (const row of ranked) {
    if (remaining <= 0) break;
    row.shares += 1;
    remaining -= 1;
  }

  return rawSplits.map((row) => ({
    id: row.id,
    sequence: row.sequence,
    account: row.account,
    weightPct: row.weightPct,
    shares: row.shares,
    notional: 0,
  }));
}

export function hasValidAllocationTotal(rows: AllocationInstructionInput[]): boolean {
  return Math.abs(allocationWeightTotal(rows) - 100) <= 0.01;
}
