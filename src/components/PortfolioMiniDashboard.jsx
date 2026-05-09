import { LIMITS } from '../data/constants'

function PortfolioMiniDashboard({ exposure, preTradeImpact }) {
  const breach = (value, limit) => value > limit

  return (
    <section className="portfolio-mini-dashboard">
      <h3>Live Risk Exposure</h3>

      <div className="risk-gauge">
        <div className={`gauge-item ${breach(preTradeImpact.singleNameAfter, LIMITS.singleName) ? 'breach' : ''}`}>
          <span className="gauge-label">Single-Name</span>
          <div className="gauge-bar">
            <div
              className={`gauge-fill ${breach(preTradeImpact.singleNameAfter, LIMITS.singleName) ? 'breach' : ''}`}
              style={{
                width: `${Math.min(100, (preTradeImpact.singleNameAfter / LIMITS.singleName) * 100)}%`,
              }}
            ></div>
          </div>
          <span className="gauge-value">
            {preTradeImpact.singleNameAfter.toFixed(1)}% / {LIMITS.singleName}%
          </span>
        </div>

        <div className={`gauge-item ${breach(preTradeImpact.sectorAfter, LIMITS.sector) ? 'breach' : ''}`}>
          <span className="gauge-label">Sector</span>
          <div className="gauge-bar">
            <div
              className={`gauge-fill ${breach(preTradeImpact.sectorAfter, LIMITS.sector) ? 'breach' : ''}`}
              style={{
                width: `${Math.min(100, (preTradeImpact.sectorAfter / LIMITS.sector) * 100)}%`,
              }}
            ></div>
          </div>
          <span className="gauge-value">
            {preTradeImpact.sectorAfter.toFixed(1)}% / {LIMITS.sector}%
          </span>
        </div>

        <div className={`gauge-item ${breach(preTradeImpact.buyingPowerAfter, LIMITS.buyingPowerUsed) ? 'breach' : ''}`}>
          <span className="gauge-label">Buying Power</span>
          <div className="gauge-bar">
            <div
              className={`gauge-fill ${breach(preTradeImpact.buyingPowerAfter, LIMITS.buyingPowerUsed) ? 'breach' : ''}`}
              style={{
                width: `${Math.min(100, (preTradeImpact.buyingPowerAfter / LIMITS.buyingPowerUsed) * 100)}%`,
              }}
            ></div>
          </div>
          <span className="gauge-value">
            {preTradeImpact.buyingPowerAfter.toFixed(1)}% / {LIMITS.buyingPowerUsed}%
          </span>
        </div>
      </div>

      <div className="top-positions">
        <h4>Top 5 Positions</h4>
        <div className="position-list">
          {exposure.topSingleNames.slice(0, 5).map((pos) => (
            <div key={pos.ticker} className="position-item">
              <span className="pos-ticker">{pos.ticker}</span>
              <div className="pos-bar">
                <div className="pos-fill" style={{ width: `${(pos.weight / 10) * 100}%` }}></div>
              </div>
              <span className="pos-weight">{pos.weight.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default PortfolioMiniDashboard
