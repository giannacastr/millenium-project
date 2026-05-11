import type { ExposureDTO } from "@/lib/trading/portfolio";

interface Top5PositionsProps {
  exposure: ExposureDTO | null;
}

export default function Top5Positions({ exposure }: Top5PositionsProps) {
  if (!exposure || exposure.topSingleNames.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">
            Top 5 positions
          </h3>
        </div>
        <div className="px-4 py-6 text-center text-sm text-slate-500">
          No positions
        </div>
      </div>
    );
  }

  // Get top 5
  const top5 = exposure.topSingleNames.slice(0, 5);
  const maxWeight = Math.max(...top5.map((p) => p.weight), 10);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">
          Top 5 positions
        </h3>
      </div>
      <div className="p-4 space-y-3">
        {top5.map((position) => {
          const barWidth = (position.weight / maxWeight) * 100;
          return (
            <div key={position.ticker} className="flex items-center gap-3">
              <div className="w-10 flex-shrink-0">
                <p className="text-sm font-semibold text-slate-900">
                  {position.ticker}
                </p>
              </div>
              <div className="flex-1 min-w-0">
                <div className="h-6 rounded-lg bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
              <div className="w-12 flex-shrink-0 text-right">
                <p className="text-sm font-semibold text-slate-900 tabular-nums">
                  {position.weight.toFixed(1)}%
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
