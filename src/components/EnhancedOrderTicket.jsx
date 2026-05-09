import {
  ACCOUNT_OPTIONS,
  DIRECTION_OPTIONS,
  ORDER_TYPE_OPTIONS,
  STRATEGY_OPTIONS,
  TICKER_OPTIONS,
  LIMITS,
} from '../data/constants'

function EnhancedOrderTicket({
  profile,
  ticket,
  setTicket,
  onSaveDraft,
  onSubmit,
  preTradeImpact,
  tickerMeta,
}) {
  const singleNameBreach = preTradeImpact.singleNameAfter > LIMITS.singleName
  const sectorBreach = preTradeImpact.sectorAfter > LIMITS.sector
  const buyingPowerBreach = preTradeImpact.buyingPowerAfter > LIMITS.buyingPowerUsed

  const hasBreaches = singleNameBreach || sectorBreach || buyingPowerBreach

  return (
    <section className="enhanced-order-ticket">
      <div className="ticket-header">
        <h2>New Order Ticket</h2>
        <span className="trader-badge">{profile.name}</span>
      </div>

      <div className="ticket-form">
        {/* Primary Order Details */}
        <div className="form-section primary-section">
          <h3 className="section-title">Order Details</h3>

          <div className="form-row-tight">
            <label>
              Side
              <select
                value={ticket.direction}
                onChange={(e) => setTicket((prev) => ({ ...prev, direction: e.target.value }))}
                className="input-lg"
              >
                {DIRECTION_OPTIONS.map((dir) => (
                  <option key={dir} value={dir}>
                    {dir}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Symbol
              <input
                list="ticker-options"
                value={ticket.ticker}
                onChange={(e) => setTicket((prev) => ({ ...prev, ticker: e.target.value.toUpperCase() }))}
                className="input-lg"
                placeholder="MSFT"
              />
              <datalist id="ticker-options">
                {TICKER_OPTIONS.map(({ symbol }) => (
                  <option key={symbol} value={symbol} />
                ))}
              </datalist>
            </label>

            <label>
              Quantity
              <input
                type="number"
                min="1"
                value={ticket.quantity}
                onChange={(e) => setTicket((prev) => ({ ...prev, quantity: e.target.value }))}
                className="input-lg"
              />
            </label>

            <label>
              Type
              <select
                value={ticket.orderType}
                onChange={(e) => setTicket((prev) => ({ ...prev, orderType: e.target.value }))}
                className="input-lg"
              >
                {ORDER_TYPE_OPTIONS.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {ticket.orderType === 'Limit' && (
            <div className="form-row-tight">
              <label className="full-width-label">
                Limit Price
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={ticket.limitPrice}
                  onChange={(e) => setTicket((prev) => ({ ...prev, limitPrice: e.target.value }))}
                  className="input-lg"
                  placeholder={`Market: $${tickerMeta.price}`}
                />
              </label>
            </div>
          )}
        </div>

        {/* Order Routing & Strategy */}
        <div className="form-section routing-section">
          <h3 className="section-title">Routing & Strategy</h3>

          <div className="form-row-tight">
            <label>
              Account
              <select
                value={ticket.account}
                onChange={(e) => setTicket((prev) => ({ ...prev, account: e.target.value }))}
              >
                {ACCOUNT_OPTIONS.map((acc) => (
                  <option key={acc} value={acc}>
                    {acc}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Strategy
              <select
                value={ticket.strategy}
                onChange={(e) => setTicket((prev) => ({ ...prev, strategy: e.target.value }))}
              >
                {STRATEGY_OPTIONS.map((strat) => (
                  <option key={strat} value={strat}>
                    {strat}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="full-width-label">
            Trading Notes
            <textarea
              value={ticket.notes}
              onChange={(e) => setTicket((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="E.g., rebalancing signal, event-driven rationale..."
              rows="3"
            />
          </label>
        </div>

        {/* Pre-Trade Risk Checks */}
        <div className={`form-section risk-section ${hasBreaches ? 'risk-alert' : ''}`}>
          <h3 className="section-title">Pre-Trade Impact Analysis</h3>

          <div className="risk-items">
            <div className={`risk-item ${singleNameBreach ? 'breach' : 'pass'}`}>
              <span className="risk-icon">{singleNameBreach ? '⚠' : '✓'}</span>
              <span className="risk-label">Single-Name Concentration (post)</span>
              <span className="risk-value">{preTradeImpact.singleNameAfter.toFixed(1)}%</span>
              <span className="risk-limit">/ {LIMITS.singleName}% cap</span>
            </div>

            <div className={`risk-item ${sectorBreach ? 'breach' : 'pass'}`}>
              <span className="risk-icon">{sectorBreach ? '⚠' : '✓'}</span>
              <span className="risk-label">Sector Exposure (post)</span>
              <span className="risk-value">{preTradeImpact.sectorAfter.toFixed(1)}%</span>
              <span className="risk-limit">/ {LIMITS.sector}% cap</span>
            </div>

            <div className={`risk-item ${buyingPowerBreach ? 'breach' : 'pass'}`}>
              <span className="risk-icon">{buyingPowerBreach ? '⚠' : '✓'}</span>
              <span className="risk-label">Buying Power Usage (post)</span>
              <span className="risk-value">{preTradeImpact.buyingPowerAfter.toFixed(1)}%</span>
              <span className="risk-limit">/ {LIMITS.buyingPowerUsed}% cap</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="ticket-actions">
          <button type="button" onClick={onSaveDraft} className="btn-secondary">
            Save Draft
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className={`btn-primary ${hasBreaches ? 'breached' : ''}`}
            disabled={hasBreaches}
            title={hasBreaches ? 'Risk limits breached' : ''}
          >
            {hasBreaches ? 'Risk Breach - Review Required' : 'Submit for Review'}
          </button>
        </div>
      </div>
    </section>
  )
}

export default EnhancedOrderTicket
