import { useState } from "react";
import type { PreTradeImpact } from "@/lib/trading/risk";
import type { RiskLimitsDTO } from "@/lib/trading/portfolio";

interface PreTradeImpactAnalysisProps {
  impact: PreTradeImpact;
  limits: RiskLimitsDTO;
}

interface CheckItem {
  label: string;
  value: number;
  cap: number;
  key: "singleName" | "sector" | "buyingPower";
}

export default function PreTradeImpactAnalysis({
  impact,
  limits,
}: PreTradeImpactAnalysisProps) {
  const [hoveredCheck, setHoveredCheck] = useState<string | null>(null);

  const checks: CheckItem[] = [
    {
      label: "Single-name concentration",
      value: impact.singleNameAfter,
      cap: limits.singleNameCapPct,
      key: "singleName",
    },
    {
      label: "Sector exposure",
      value: impact.sectorAfter,
      cap: limits.sectorCapPct,
      key: "sector",
    },
    {
      label: "Buying power usage",
      value: impact.buyingPowerAfter,
      cap: limits.buyingPowerUsedCapPct,
      key: "buyingPower",
    },
  ];

  const isPass = (value: number, cap: number) => value <= cap;

  const getTooltip = (check: CheckItem): string => {
    const isBreached = !isPass(check.value, check.cap);
    if (isBreached) {
      return `Flagged: ${check.label} is ${check.value.toFixed(1)}%, exceeds ${check.cap}% cap`;
    }
    return `${check.label} limit is ${check.cap}%`;
  };

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-slate-800">
        Pre-trade impact analysis
      </h4>
      <div className="space-y-3">
        {checks.map((check) => {
          const pass = isPass(check.value, check.cap);
          const isHovered = hoveredCheck === check.key;
          return (
            <div
              key={check.label}
              className={`flex items-center gap-3 rounded-lg border-l-4 px-3 py-2 ${
                pass
                  ? "border-l-emerald-500 bg-emerald-50"
                  : "border-l-amber-500 bg-amber-50"
              }`}
            >
              <div className="relative flex-shrink-0">
                <button
                  type="button"
                  onMouseEnter={() => setHoveredCheck(check.key)}
                  onMouseLeave={() => setHoveredCheck(null)}
                  className="cursor-help rounded-full p-0.5 hover:opacity-80"
                  aria-label={getTooltip(check)}
                >
                  {pass ? (
                    <svg
                      className="h-5 w-5 text-emerald-600"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="h-5 w-5 text-amber-600"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>

                {isHovered && (
                  <div className="absolute bottom-full left-2 z-10 mb-2 max-w-[640px] -translate-x-6 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-lg">
                    {getTooltip(check)}
                    <div className="absolute top-full left-6 -translate-x-100 border-4 border-transparent border-t-slate-900" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${
                    pass ? "text-emerald-900" : "text-amber-900"
                  }`}
                >
                  {check.label}
                </p>
              </div>

              <div className="flex-shrink-0 text-right">
                <p
                  className={`text-sm font-semibold tabular-nums ${
                    pass ? "text-emerald-900" : "text-amber-900"
                  }`}
                >
                  {check.value.toFixed(1)}%{" "}
                  <span className={pass ? "text-emerald-700" : "text-amber-700"}>
                    / {check.cap}%
                  </span>
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
