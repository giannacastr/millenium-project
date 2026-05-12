/** Demo portfolio snapshot — shared across desks */
export const LIMITS = {
  singleName: 10,
  sector: 30,
  grossExposure: 180,
  netExposure: 70,
  buyingPowerUsedPct: 90,
};

export const INITIAL_EXPOSURE = {
  grossExposure: 122,
  netExposure: 51,
  buyingPowerUsed: 58,
  buyingPowerRemaining: "$42.0MM",
  sectorWeights: {
    Technology: 24,
    Financials: 18,
    Energy: 12,
    "Health Care": 16,
    "Consumer Staples": 9,
    Industrials: 8,
    Other: 13,
  },
  topSingleNames: [
    { ticker: "MSFT", weight: 7.2 },
    { ticker: "AAPL", weight: 6.9 },
    { ticker: "NVDA", weight: 6.4 },
    { ticker: "JPM", weight: 5.1 },
    { ticker: "XOM", weight: 4.8 },
    { ticker: "UNH", weight: 4.1 },
    { ticker: "PG", weight: 3.7 },
  ],
};

export const TICKER_META: Record<
  string,
  { companyName: string; sector: string; price: number }
> = {
  MSFT: { companyName: "Microsoft", sector: "Technology", price: 412 },
  AAPL: { companyName: "Apple", sector: "Technology", price: 189 },
  NVDA: { companyName: "NVIDIA", sector: "Technology", price: 936 },
  JPM: { companyName: "JPMorgan Chase", sector: "Financials", price: 198 },
  XOM: { companyName: "Exxon Mobil", sector: "Energy", price: 121 },
  UNH: { companyName: "UnitedHealth Group", sector: "Health Care", price: 476 },
  PG: { companyName: "Procter & Gamble", sector: "Consumer Staples", price: 157 },
};

export const ACCOUNT_OPTIONS = ["Long Book", "Short Book", "Macro Sleeve"];
export const STRATEGY_OPTIONS = ["Core Equity", "Event Driven", "Momentum"];
