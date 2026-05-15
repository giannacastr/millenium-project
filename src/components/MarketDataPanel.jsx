import { useMemo } from 'react'

function MarketDataPanel({ ticker, tickerMeta, livePrice, quote }) {
  const derived = useMemo(() => {
    const last = typeof livePrice === 'number' ? livePrice : tickerMeta.price
    const open = quote?.o
    const prevClose = quote?.pc
    const high = quote?.h
    const low = quote?.l
    const change = typeof open === 'number' && open > 0 ? last - open : null
    const changePercent = typeof open === 'number' && open > 0 ? (change / open) * 100 : null
    return {
      lastPrice: last,
      open,
      prevClose,
      high,
      low,
      change,
      changePercent,
      // removed bid/ask/volume/spread per UX
    }
  }, [livePrice, quote, tickerMeta.price])

  return (
    <section className="market-data-panel">
      <div className="market-header">
        <h3 className="ticker-symbol">{ticker}</h3>
        <span className="sector-badge">{tickerMeta.sector}</span>
      </div>

      <div className="price-display">
        <div className="price-section">
          <span className="label">Last</span>
          <div className="price-value">${derived.lastPrice.toFixed(2)}</div>
          {derived.changePercent != null && derived.change != null && (
            <span className={`change ${derived.change >= 0 ? 'positive' : 'negative'}`}>
              {derived.change >= 0 ? '+' : ''}{derived.change.toFixed(2)} ({derived.changePercent.toFixed(2)}%)
            </span>
          )}
        </div>
      </div>

      {/* removed order-book mini (ask/bid) per UX request */}

      <div className="market-stats">
        <div className="stat">
          <span className="stat-label">High</span>
          <span className="stat-value">
            {typeof derived.high === 'number' ? `$${derived.high.toFixed(2)}` : '—'}
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">Low</span>
          <span className="stat-value">
            {typeof derived.low === 'number' ? `$${derived.low.toFixed(2)}` : '—'}
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">High</span>
          <span className="stat-value">
            {typeof derived.high === 'number' ? `$${derived.high.toFixed(2)}` : '—'}
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">Low</span>
          <span className="stat-value">
            {typeof derived.low === 'number' ? `$${derived.low.toFixed(2)}` : '—'}
          </span>
        </div>
      </div>
    </section>
  )
}

export default MarketDataPanel
