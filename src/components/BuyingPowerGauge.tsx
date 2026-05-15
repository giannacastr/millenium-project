"use client";

interface Props {
  usedPct: number;
  capPct: number;
  title?: string;
  showLabel?: boolean;
}

export default function BuyingPowerGauge({
  usedPct,
  capPct,
  title = "Buying Power Utilization",
  showLabel = true,
}: Props) {
  // Determine color based on utilization
  const getColor = (pct: number) => {
    if (pct >= capPct) return "#dc2626"; // Red - breach
    if (pct >= capPct * 0.85) return "#f59e0b"; // Amber - caution
    return "#10b981"; // Green - safe
  };

  const color = getColor(usedPct);
  const isBreach = usedPct >= capPct;

  // SVG arc parameters
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const arcLength = (usedPct / 100) * circumference;
  const strokeDashoffset = circumference - arcLength;

  // Calculate angles for arc path
  const startAngle = -90; // Start from top
  const endAngle = startAngle + (usedPct / 100) * 360;
  const endRad = (endAngle * Math.PI) / 180;

  const x = 50 + radius * Math.cos(endRad);
  const y = 50 + radius * Math.sin(endRad);

  // Remaining arc (light background)
  const capEndRad = ((startAngle + (capPct / 100) * 360) * Math.PI) / 180;
  const capX = 50 + radius * Math.cos(capEndRad);
  const capY = 50 + radius * Math.sin(capEndRad);

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      {title && (
        <h3 className="text-sm font-semibold text-slate-500">
          {title}
        </h3>
      )}

      <div className="relative inline-flex items-center justify-center">
        {/* SVG Gauge */}
        <svg width="120" height="120" viewBox="0 0 100 100" className="relative">
          {/* Background arc (cap limit) */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={0}
            style={{
              transform: "rotate(-90deg)",
              transformOrigin: "50px 50px",
            }}
          />

          {/* Remaining arc (to cap) */}
          {usedPct < capPct && (
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="#f3f4f6"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={((capPct - usedPct) / 100) * circumference}
              strokeDashoffset={-((usedPct / 100) * circumference)}
              style={{
                transform: "rotate(-90deg)",
                transformOrigin: "50px 50px",
              }}
            />
          )}

          {/* Used arc */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{
              transform: "rotate(-90deg)",
              transformOrigin: "50px 50px",
              transition: "stroke-dashoffset 0.3s ease-in-out, stroke 0.3s ease-in-out",
            }}
          />

          {/* Center text */}
          <text
            x="50"
            y="48"
            textAnchor="middle"
            fontSize="18"
            fontWeight="700"
            fill="#1f2937"
            fontFamily="monospace"
          >
            {Math.round(usedPct)}%
          </text>
          <text
            x="50"
            y="62"
            textAnchor="middle"
            fontSize="10"
            fill="#9ca3af"
            fontFamily="monospace"
          >
            / {capPct}% cap
          </text>
        </svg>

        {/* Breach indicator */}
        {isBreach && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-24 w-24 rounded-full border-2 border-red-500 opacity-30" />
          </div>
        )}
      </div>

      {/* Status indicator and text */}
      {showLabel && (
        <div className="flex flex-col items-center gap-2 text-center">
          <div
            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              isBreach
                ? "bg-red-100 text-red-800"
                : usedPct >= capPct * 0.85
                  ? "bg-amber-100 text-amber-900"
                  : "bg-emerald-100 text-emerald-800"
            }`}
          >
            {isBreach
              ? "Limit breached"
              : usedPct >= capPct * 0.85
                ? "Approaching limit"
                : "Within limit"}
          </div>

          <div className="text-xs text-slate-600">
            <span className="font-semibold text-slate-900">${usedPct.toFixed(1)}</span> used ·{" "}
            <span className="text-slate-500">
              ${(capPct - usedPct).toFixed(1)} remaining
            </span>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-2 flex gap-3 text-[10px]">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-slate-600">Safe</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-amber-500" />
          <span className="text-slate-600">Caution</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-red-500" />
          <span className="text-slate-600">Breach</span>
        </div>
      </div>
    </div>
  );
}
