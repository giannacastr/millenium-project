import { useMemo } from 'react'

function MarketDataPanel({ ticker, tickerMeta, livePrice, quote }) {
  const derived = useMemo(() => {
    const last = typeof livePrice === 'number' ? livePrice : tickerMeta.price
    const open = quote?.o
    const prevClose = quote?.pc
    const high = quote?.h
    const low = quote?.l
    const volume = quote?.v
    const change = typeof open === 'number' && open > 0 ? last - open : null
    const changePercent = typeof open === 'number' && open > 0 ? (change / open) * 100 : null
    const bid = last - 0.15
    const ask = last + 0.15
    return {
      lastPrice: last,
      open,
      prevClose,
      high,
      low,
      volume,
      change,
      changePercent,
      bid,
      ask,
      bidSize: null,
      askSize: null,
      spread: ask - bid,
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

      <div className="order-book-mini">
        <div className="order-book-item ask">
          <span className="price">${derived.ask.toFixed(2)}</span>
          <div className="size-bar">
            <div className="size-fill ask-fill" style={{ width: '65%' }}></div>
          </div>
          <span className="size">—</span>
        </div>
        <div className="order-book-item bid">
          <span className="price">${derived.bid.toFixed(2)}</span>
          <div className="size-bar">
            <div className="size-fill bid-fill" style={{ width: '72%' }}></div>
          </div>
          <span className="size">—</span>
        </div>
      </div>

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
          <span className="stat-label">Vol</span>
          <span className="stat-value">
            {typeof derived.volume === 'number' ? `${(derived.volume / 1000000).toFixed(1)}M` : '—'}
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">Spread</span>
          <span className="stat-value">${derived.spread.toFixed(2)}</span>
        </div>
      </div>
    </section>
  )
}

export default MarketDataPanel
