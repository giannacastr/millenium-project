"use client";

import { useEffect, useRef, useState } from "react";

type TimeRange = "1D" | "1W" | "1M" | "1Y" | "5Y" | "all";

type CandleData = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

function hashString(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createFallbackCandles(symbol: string, range: TimeRange, basePrice: number): CandleData[] {
  const now = Math.floor(Date.now() / 1000);
  const seed = hashString(`${symbol}:${range}`) || 1;
  let state = seed;
  const nextRandom = () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0xffffffff;
  };

  const configByRange: Record<TimeRange, { points: number; stepSec: number; drift: number; vol: number }> = {
    "1D": { points: 78, stepSec: 300, drift: 0.008, vol: 0.35 },
    "1W": { points: 84, stepSec: 3600, drift: 0.015, vol: 0.8 },
    "1M": { points: 60, stepSec: 4 * 3600, drift: 0.02, vol: 1.4 },
    "1Y": { points: 252, stepSec: 24 * 3600, drift: 0.01, vol: 3.2 },
    "5Y": { points: 260, stepSec: 7 * 24 * 3600, drift: 0.012, vol: 6.5 },
    all: { points: 260, stepSec: 30 * 24 * 3600, drift: 0.016, vol: 8 },
  };

  const config = configByRange[range];
  const candles: CandleData[] = [];
  let lastClose = basePrice * (0.985 + nextRandom() * 0.03);
  const start = now - config.points * config.stepSec;

  for (let index = 0; index < config.points; index++) {
    const time = start + index * config.stepSec;
    const trend = index * config.drift;
    const wave = Math.sin(index / 7) * config.vol * 0.2;
    const noise = (nextRandom() - 0.5) * config.vol;
    const close = Math.max(1, lastClose + trend + wave + noise);
    const open = lastClose;
    const high = Math.max(open, close) + nextRandom() * config.vol * 0.5;
    const low = Math.min(open, close) - nextRandom() * config.vol * 0.5;

    candles.push({
      time,
      open,
      high,
      low: Math.max(1, low),
      close,
      volume: Math.round(500000 + nextRandom() * 7500000),
    });

    lastClose = close;
  }

  return candles;
}

type Props = {
  ticker: string;
  submittedAt: string;
  fills: Array<{
    price: number;
    executedAt: string;
    quantity: number;
  }>;
  currentPrice: number;
};

export default function IntradayTickerChart({
  ticker,
  submittedAt,
  fills,
  currentPrice,
}: Props) {
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [range, setRange] = useState<TimeRange>("1D");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredPrice, setHoveredPrice] = useState<number | null>(null);
  const [hoveredTime, setHoveredTime] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Fetch candles when ticker or range changes
  useEffect(() => {
    const fetchCandles = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(
          `/api/candles?symbol=${encodeURIComponent(ticker)}&range=${range}`,
          { cache: "no-store" },
        );
        const data = await res.json();
        if (data.candles && Array.isArray(data.candles)) {
          setCandles(data.candles);
          setError(null);
        } else {
          setCandles(createFallbackCandles(ticker, range, currentPrice));
          setError(null);
        }
      } catch (err) {
        setCandles(createFallbackCandles(ticker, range, currentPrice));
        setError(null);
      } finally {
        setLoading(false);
      }
    };

    void fetchCandles();
  }, [ticker, range, currentPrice]);

  const chartWidth = 600;
  const chartHeight = 300;
  const marginLeft = 60;
  const marginRight = 20;
  const marginTop = 20;
  const marginBottom = 40;

  const plotWidth = chartWidth - marginLeft - marginRight;
  const plotHeight = chartHeight - marginTop - marginBottom;

  // Calculate price range
  const allPrices = [
    ...candles.map((c) => c.high),
    ...candles.map((c) => c.low),
    ...fills.map((f) => f.price),
    currentPrice,
  ];

  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  const padding = (maxPrice - minPrice) * 0.08;
  const yMin = minPrice - padding;
  const yMax = maxPrice + padding;

  // Scale functions
  const scaleX = (unixTime: number) => {
    if (candles.length === 0) return marginLeft;
    const timeRange = candles[candles.length - 1].time - candles[0].time;
    if (timeRange === 0) return marginLeft + plotWidth / 2;
    const elapsed = unixTime - candles[0].time;
    return marginLeft + (elapsed / timeRange) * plotWidth;
  };

  const scaleY = (price: number) => {
    const normalized = (price - yMin) / (yMax - yMin);
    return marginTop + plotHeight - normalized * plotHeight;
  };

  // Create path for close prices
  const pathData =
    candles.length > 0
      ? candles
          .map((c, idx) => {
            const x = scaleX(c.time);
            const y = scaleY(c.close);
            return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
          })
          .join(" ")
      : "";

  // Handle mouse movement
  const handleMouseMove = (
    e: React.MouseEvent<SVGSVGElement>,
  ) => {
    if (!svgRef.current || candles.length === 0) return;

    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Only interact within plot area
    if (
      x < marginLeft ||
      x > chartWidth - marginRight ||
      y < marginTop ||
      y > marginTop + plotHeight
    ) {
      setHoveredPrice(null);
      setHoveredTime(null);
      return;
    }

    // Calculate nearest candle based on X
    const ratio = (x - marginLeft) / plotWidth;
    const timeRange = candles[candles.length - 1].time - candles[0].time;
    const hoverTime = candles[0].time + ratio * timeRange;

    // Find closest candle
    let closest = candles[0];
    let minDiff = Math.abs(closest.time - hoverTime);

    for (const c of candles) {
      const diff = Math.abs(c.time - hoverTime);
      if (diff < minDiff) {
        minDiff = diff;
        closest = c;
      }
    }

    // Calculate price from Y position
    const priceRatio = (marginTop + plotHeight - y) / plotHeight;
    const hoverPrice = yMin + priceRatio * (yMax - yMin);

    setHoveredTime(closest.time);
    setHoveredPrice(hoverPrice);
  };

  const handleMouseLeave = () => {
    setHoveredPrice(null);
    setHoveredTime(null);
  };

  const submittedUnix = Math.floor(new Date(submittedAt).getTime() / 1000);
  const submittedX = scaleX(submittedUnix);

  const formatPrice = (p: number) => `$${p.toFixed(2)}`;
  const formatTime = (unixTime: number) => {
    return new Date(unixTime * 1000).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const rangeLabels: Record<TimeRange, string> = {
    "1D": "1D",
    "1W": "1W",
    "1M": "1M",
    "1Y": "1Y",
    "5Y": "5Y",
    all: "All",
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Price chart
          </h3>
          <p className="mt-1 text-sm font-medium text-slate-900">{ticker}</p>
        </div>
        <div className="flex gap-3 text-right text-xs">
          <div>
            <p className="text-slate-500">Current</p>
            <p className="font-mono font-semibold text-slate-900">
              {formatPrice(currentPrice)}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Range</p>
            <p className="font-mono text-slate-700">
              {formatPrice(minPrice)} - {formatPrice(maxPrice)}
            </p>
          </div>
        </div>
      </div>

      {/* Time range buttons */}
      <div className="mb-4 flex gap-2">
        {(["1D", "1W", "1M", "1Y", "5Y", "all"] as TimeRange[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`rounded px-3 py-1.5 text-xs font-medium transition ${
              range === r
                ? "bg-blue-600 text-white"
                : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {rangeLabels[r]}
          </button>
        ))}
      </div>

      {/* Chart */}
      {loading ? (
        <div className="flex h-80 items-center justify-center bg-slate-50/50">
          <span className="text-sm text-slate-500">Loading chart...</span>
        </div>
      ) : error ? (
        <div className="flex h-80 items-center justify-center bg-slate-50/50">
          <span className="text-sm text-red-600">{error}</span>
        </div>
      ) : candles.length === 0 ? (
        <div className="flex h-80 items-center justify-center bg-slate-50/50">
          <span className="text-sm text-slate-500">No data available</span>
        </div>
      ) : (
        <svg
          ref={svgRef}
          width={chartWidth}
          height={chartHeight}
          className="w-full bg-slate-50/50"
          style={{
            border: "1px solid #e2e8f0",
            cursor: hoveredPrice ? "crosshair" : "default",
          }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
            const y = marginTop + plotHeight * (1 - pct);
            const price = yMin + (yMax - yMin) * pct;
            return (
              <g key={idx}>
                <line
                  x1={marginLeft}
                  y1={y}
                  x2={chartWidth - marginRight}
                  y2={y}
                  stroke="#e5e7eb"
                  strokeDasharray="2,2"
                  strokeWidth={0.5}
                />
                <text
                  x={marginLeft - 8}
                  y={y + 3}
                  fontSize="10"
                  fill="#9ca3af"
                  textAnchor="end"
                  fontFamily="monospace"
                >
                  {formatPrice(price)}
                </text>
              </g>
            );
          })}

          {/* Price line */}
          <path
            d={pathData}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Order submitted marker */}
          {candles.some((c) => c.time >= submittedUnix - 3600 && c.time <= submittedUnix + 3600) && (
            <>
              <line
                x1={submittedX}
                y1={marginTop}
                x2={submittedX}
                y2={marginTop + plotHeight}
                stroke="#a78bfa"
                strokeWidth={1.5}
                strokeDasharray="3,3"
              />
              <circle cx={submittedX} cy={marginTop + 4} r={3} fill="#a78bfa" />
            </>
          )}

          {/* Fill markers */}
          {fills.map((fill, idx) => {
            const fillUnix = Math.floor(new Date(fill.executedAt).getTime() / 1000);
            if (fillUnix < candles[0].time || fillUnix > candles[candles.length - 1].time) {
              return null;
            }
            const x = scaleX(fillUnix);
            const y = scaleY(fill.price);

            return (
              <g key={idx}>
                <circle cx={x} cy={y} r={5} fill="#10b981" />
                <circle cx={x} cy={y} r={2.5} fill="white" />
              </g>
            );
          })}

          {/* Hover line and tooltip */}
          {hoveredTime && hoveredPrice && (
            <>
              <line
                x1={scaleX(hoveredTime)}
                y1={marginTop}
                x2={scaleX(hoveredTime)}
                y2={marginTop + plotHeight}
                stroke="#94a3b8"
                strokeWidth={1}
                opacity={0.5}
              />
              <circle
                cx={scaleX(hoveredTime)}
                cy={scaleY(hoveredPrice)}
                r={4}
                fill="#0ea5e9"
                stroke="white"
                strokeWidth={2}
              />
              <rect
                x={scaleX(hoveredTime) - 50}
                y={scaleY(hoveredPrice) - 35}
                width="100"
                height="28"
                rx="4"
                fill="#1f2937"
                opacity={0.95}
              />
              <text
                x={scaleX(hoveredTime)}
                y={scaleY(hoveredPrice) - 18}
                textAnchor="middle"
                fontSize="12"
                fontWeight="600"
                fill="#0ea5e9"
                fontFamily="monospace"
              >
                {formatPrice(hoveredPrice)}
              </text>
              <text
                x={scaleX(hoveredTime)}
                y={scaleY(hoveredPrice) - 2}
                textAnchor="middle"
                fontSize="9"
                fill="#d1d5db"
                fontFamily="monospace"
              >
                {new Date(hoveredTime * 1000).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </text>
            </>
          )}
        </svg>
      )}

      {/* Legend and info */}
      <div className="mt-4 flex flex-col gap-3">
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="h-1 w-4 bg-blue-500" />
            <span className="text-slate-600">Price line</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-1 w-4 border-t-2 border-dashed border-purple-400" />
            <span className="text-slate-600">Order submitted</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span className="text-slate-600">Fill executed</span>
          </div>
        </div>

        {/* Summary info */}
        <div className="text-[10px] text-slate-600">
          <p>
            Order submitted:{" "}
            <span className="font-mono font-semibold text-slate-800">
              {formatTime(submittedUnix)}
            </span>
          </p>
          {fills.length > 0 && (
            <p>
              Fills: {fills.length} · Price range: {formatPrice(Math.min(...fills.map((f) => f.price)))} -{" "}
              {formatPrice(Math.max(...fills.map((f) => f.price)))} · Current:{" "}
              <span className={currentPrice > (fills[0]?.price ?? 0) ? "text-emerald-600" : "text-red-600"}>
                {currentPrice > (fills[0]?.price ?? 0) ? "+" : ""}
                {(currentPrice - (fills[0]?.price ?? 0)).toFixed(2)}
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
