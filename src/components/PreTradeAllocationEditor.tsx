"use client";

import { useEffect, useMemo, useState } from "react";
import {
  allocationWeightTotal,
  createAllocationDraft,
  formatWeight,
  normalizeAllocationDrafts,
  type AllocationDraft,
} from "@/lib/trading/allocation";

type Props = {
  value: AllocationDraft[];
  onChange: (value: AllocationDraft[]) => void;
  availableAccounts: string[];
  locked?: boolean;
};

export default function PreTradeAllocationEditor({
  value,
  onChange,
  availableAccounts,
  locked = false,
}: Props) {
  const [rows, setRows] = useState<AllocationDraft[]>(
    value.length > 0 ? value : [createAllocationDraft(availableAccounts[0] ?? "Long Book")],
  );

  useEffect(() => {
    setRows(value.length > 0 ? value : [createAllocationDraft(availableAccounts[0] ?? "Long Book")]);
  }, [availableAccounts, value]);

  const normalized = useMemo(() => normalizeAllocationDrafts(rows), [rows]);
  const total = useMemo(() => allocationWeightTotal(normalized), [normalized]);

  const updateRows = (nextRows: AllocationDraft[]) => {
    setRows(nextRows);
    onChange(nextRows);
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Pre-trade allocation instructions</h3>
          <p className="text-xs text-slate-500">
            Define how fills should split across accounts before the ticket leaves draft.
          </p>
        </div>
        <div className="text-right text-xs">
          <div className="text-slate-500">Total</div>
          <div className={`font-semibold ${Math.abs(total - 100) <= 0.01 ? "text-emerald-700" : "text-amber-700"}`}>
            {formatWeight(total)}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="grid grid-cols-[1fr_110px_auto] gap-2">
            <label className="block text-xs">
              <span className="mb-1 block text-slate-500">Account</span>
              <input
                list="allocation-accounts"
                value={row.account}
                onChange={(e) =>
                  updateRows(
                    rows.map((existing) =>
                      existing.id === row.id ? { ...existing, account: e.target.value } : existing,
                    ),
                  )
                }
                disabled={locked}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
              />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block text-slate-500">Split %</span>
              <input
                type="number"
                min="0"
                step="0.1"
                value={row.weightPct}
                onChange={(e) =>
                  updateRows(
                    rows.map((existing) =>
                      existing.id === row.id ? { ...existing, weightPct: e.target.value } : existing,
                    ),
                  )
                }
                disabled={locked}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
              />
            </label>
            <div className="flex items-end pb-0.5">
              <button
                type="button"
                onClick={() => updateRows(rows.filter((existing) => existing.id !== row.id))}
                disabled={locked || rows.length === 1}
                className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <datalist id="allocation-accounts">
        {availableAccounts.map((account) => (
          <option key={account} value={account} />
        ))}
      </datalist>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => updateRows([...rows, createAllocationDraft(availableAccounts[0] ?? "Long Book", "")])}
          disabled={locked}
          className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Add account split
        </button>
        <p className="text-xs text-slate-500">
          Example: Long Book 60%, Co-invest 30%, SMA Fund A 10%
        </p>
      </div>

      {normalized.length === 0 && (
        <p className="mt-3 text-xs text-rose-700">Enter at least one valid allocation line.</p>
      )}
    </div>
  );
}
