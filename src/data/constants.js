export const ROLE_OPTIONS = ['Equity Trader', 'Risk Officer', 'Prime Broker']

export const DIRECTION_OPTIONS = ['Buy', 'Sell', 'Short']
export const ORDER_TYPE_OPTIONS = ['Market', 'Limit', 'VWAP']
export const ACCOUNT_OPTIONS = ['Long Book', 'Short Book', 'Macro Sleeve']
export const STRATEGY_OPTIONS = ['Core Equity', 'Event Driven', 'Momentum']

export const TICKER_OPTIONS = [
  { symbol: 'MSFT', sector: 'Technology', price: 412 },
  { symbol: 'AAPL', sector: 'Technology', price: 189 },
  { symbol: 'NVDA', sector: 'Technology', price: 936 },
  { symbol: 'JPM', sector: 'Financials', price: 198 },
  { symbol: 'XOM', sector: 'Energy', price: 121 },
  { symbol: 'UNH', sector: 'Health Care', price: 476 },
  { symbol: 'PG', sector: 'Consumer Staples', price: 157 },
]

export const LIMITS = {
  singleName: 10,
  sector: 30,
  grossExposure: 180,
  netExposure: 70,
  buyingPowerUsed: 90,
}

export const INITIAL_EXPOSURE = {
  grossExposure: 122,
  netExposure: 51,
  buyingPowerUsed: 58,
  buyingPowerRemaining: '$42.0MM',
  sectorWeights: {
    Technology: 24,
    Financials: 18,
    Energy: 12,
    'Health Care': 16,
    'Consumer Staples': 9,
    Industrials: 8,
    Other: 13,
  },
  topSingleNames: [
    { ticker: 'MSFT', weight: 7.2 },
    { ticker: 'AAPL', weight: 6.9 },
    { ticker: 'NVDA', weight: 6.4 },
    { ticker: 'JPM', weight: 5.1 },
    { ticker: 'XOM', weight: 4.8 },
    { ticker: 'UNH', weight: 4.1 },
    { ticker: 'PG', weight: 3.7 },
  ],
}

export const INITIAL_ORDERS = [
  {
    id: 'ORD-1001',
    trader: 'Sam PM',
    direction: 'Buy',
    ticker: 'MSFT',
    quantity: 50000,
    orderType: 'Limit',
    limitPrice: 411.5,
    account: 'Long Book',
    strategy: 'Core Equity',
    notes: 'Model signal confirmed',
    status: 'Submitted',
    createdAt: new Date().toISOString(),
    riskChecks: ['Single-name concentration near cap'],
  },
  {
    id: 'ORD-1002',
    trader: 'Alex Trader',
    direction: 'Sell',
    ticker: 'XOM',
    quantity: 15000,
    orderType: 'Market',
    limitPrice: '',
    account: 'Long Book',
    strategy: 'Event Driven',
    notes: 'Trim position',
    status: 'Acknowledged',
    createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    riskChecks: [],
  },
]
