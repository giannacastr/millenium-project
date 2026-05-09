import { useState, useEffect } from 'react'

function MarketDataPanel({ ticker, tickerMeta }) {
  const [marketData, setMarketData] = useState({
    bid: tickerMeta.price - 0.15,
    ask: tickerMeta.price + 0.15,
    lastPrice: tickerMeta.price,
    bidSize: 125000,
    askSize: 98000,
    volume: 2450000,
    high: tickerMeta.price + 2.5,
    low: tickerMeta.price - 1.8,
    change: 1.2,
    changePercent: 0.29,
  })

  // Simulate live market data updates
  useEffect(() => {
    const interval = setInterval(() => {
      setMarketData((prev) => {
        const drift = (Math.random() - 0.5) * 0.3
        const newPrice = Math.max(prev.lastPrice + drift, prev.low)
        return {
          ...prev,
          bid: newPrice - 0.15,
          ask: newPrice + 0.15,
          lastPrice: newPrice,
          bidSize: Math.max(50000, prev.bidSize + (Math.random() - 0.5) * 20000),
          askSize: Math.max(50000, prev.askSize + (Math.random() - 0.5) * 20000),
          volume: prev.volume + Math.floor(Math.random() * 5000),
        }
      })
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  return (
    <section className="market-data-panel">
      <div className="market-header">
        <h3 className="ticker-symbol">{ticker}</h3>
        <span className="sector-badge">{tickerMeta.sector}</span>
      </div>

      <div className="price-display">
        <div className="price-section">
          <span className="label">Last</span>
          <div className="price-value">${marketData.lastPrice.toFixed(2)}</div>
          <span className={`change ${marketData.change >= 0 ? 'positive' : 'negative'}`}>
            {marketData.change >= 0 ? '+' : ''}{marketData.change.toFixed(2)} ({marketData.changePercent.toFixed(2)}%)
          </span>
        </div>
      </div>

      <div className="order-book-mini">
        <div className="order-book-item ask">
          <span className="price">${marketData.ask.toFixed(2)}</span>
          <div className="size-bar">
            <div className="size-fill ask-fill" style={{ width: '65%' }}></div>
          </div>
          <span className="size">{marketData.askSize.toLocaleString()}</span>
        </div>
        <div className="order-book-item bid">
          <span className="price">${marketData.bid.toFixed(2)}</span>
          <div className="size-bar">
            <div className="size-fill bid-fill" style={{ width: '72%' }}></div>
          </div>
          <span className="size">{marketData.bidSize.toLocaleString()}</span>
        </div>
      </div>

      <div className="market-stats">
        <div className="stat">
          <span className="stat-label">High</span>
          <span className="stat-value">${marketData.high.toFixed(2)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Low</span>
          <span className="stat-value">${marketData.low.toFixed(2)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Vol</span>
          <span className="stat-value">{(marketData.volume / 1000000).toFixed(1)}M</span>
        </div>
        <div className="stat">
          <span className="stat-label">Spread</span>
          <span className="stat-value">${(marketData.ask - marketData.bid).toFixed(2)}</span>
        </div>
      </div>
    </section>
  )
}

export default MarketDataPanel
