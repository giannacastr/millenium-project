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
}

export default function PreTradeImpactAnalysis({
  impact,
  limits,
}: PreTradeImpactAnalysisProps) {
  const checks: CheckItem[] = [
    {
      label: "Single-name concentration",
      value: impact.singleNameAfter,
      cap: limits.singleNameCapPct,
    },
    {
      label: "Sector exposure",
      value: impact.sectorAfter,
      cap: limits.sectorCapPct,
    },
    {
      label: "Buying power usage",
      value: impact.buyingPowerAfter,
      cap: limits.buyingPowerUsedCapPct,
    },
  ];

  const isPass = (value: number, cap: number) => value <= cap;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-900 p-4 text-slate-100">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-300">
        Pre-trade impact analysis
      </h3>
      <div className="space-y-3">
        {checks.map((check) => {
          const pass = isPass(check.value, check.cap);
          return (
            <div
              key={check.label}
              className={`flex items-center gap-3 rounded-lg border-l-4 px-3 py-2 ${
                pass
                  ? "border-l-emerald-500 bg-slate-800/50 text-slate-100"
                  : "border-l-amber-500 bg-slate-800/50 text-slate-100"
              }`}
            >
              {/* Icon */}
              <div className="flex-shrink-0">
                {pass ? (
                  <svg
                    className="h-5 w-5 text-emerald-500"
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
                    className="h-5 w-5 text-amber-500"
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
              </div>

              {/* Label and value */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-100">
                  {check.label}
                </p>
              </div>

              {/* Value and cap */}
              <div className="flex-shrink-0 text-right">
                <p className="text-sm font-semibold text-slate-100">
                  {check.value.toFixed(1)}% <span className="text-slate-400">/ {check.cap}%</span>
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Breach flags summary */}
      {impact.triggeredChecks.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">
            ⚠ Risk flags
          </p>
          <ul className="mt-2 space-y-1 text-sm text-amber-100">
            {impact.triggeredChecks.map((check) => (
              <li key={check} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                {check}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
