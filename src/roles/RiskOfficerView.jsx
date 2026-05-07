import { LIMITS } from '../data/constants'

function RiskOfficerView({ orders, exposure, onTransition, selectedOrderId, setSelectedOrderId }) {
  const waitingOrders = orders.filter((order) => order.status === 'Submitted')
  const selectedOrder = orders.find((order) => order.id === selectedOrderId) || waitingOrders[0]

  return (
    <div className="layout two-col">
      <section className="card">
        <h2>Awaiting Review</h2>
        <table>
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Ticker</th>
              <th>Waiting</th>
              <th>Triggered Checks</th>
            </tr>
          </thead>
          <tbody>
            {waitingOrders.map((order) => (
              <tr key={order.id} onClick={() => setSelectedOrderId(order.id)}>
                <td>{order.id}</td>
                <td>{order.ticker}</td>
                <td>{new Date(order.createdAt).toLocaleTimeString()}</td>
                <td>{order.riskChecks.length ? order.riskChecks.join(', ') : 'Pass'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {selectedOrder && (
          <div className="review-panel">
            <h3>Order Review Panel</h3>
            <p>
              <strong>Order:</strong> {selectedOrder.id} • {selectedOrder.direction}{' '}
              {selectedOrder.quantity.toLocaleString()} {selectedOrder.ticker}
            </p>
            <p>
              <strong>Ticket:</strong> {selectedOrder.orderType}
              {selectedOrder.orderType === 'Limit' && ` @ ${selectedOrder.limitPrice}`} •{' '}
              {selectedOrder.account} / {selectedOrder.strategy}
            </p>
            <div className="actions">
              <button type="button" onClick={() => onTransition(selectedOrder.id, 'Approved')}>
                Approve
              </button>
              <button
                type="button"
                onClick={() => onTransition(selectedOrder.id, 'Approved with Conditions')}
              >
                Approve with Conditions
              </button>
              <button type="button" onClick={() => onTransition(selectedOrder.id, 'Rejected')}>
                Reject
              </button>
            </div>
          </div>
        )}

        <h3>Breach Log</h3>
        <table>
          <thead>
            <tr>
              <th>Order</th>
              <th>Check</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {orders
              .filter((order) => order.riskChecks.length)
              .map((order) => (
                <tr key={`${order.id}-breach`}>
                  <td>{order.id}</td>
                  <td>{order.riskChecks.join(', ')}</td>
                  <td>{order.status}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>Portfolio Exposure Dashboard</h2>
        <div className="donut" aria-label="Sector donut chart">
          <div>
            {Object.entries(exposure.sectorWeights).map(([sector, weight]) => (
              <p key={sector}>
                {sector}: {weight}% / cap {LIMITS.sector}%
              </p>
            ))}
          </div>
        </div>

        <h3>Single-Name Concentration (Top positions)</h3>
        <div className="bars">
          {exposure.topSingleNames.map((position) => (
            <div key={position.ticker} className="bar-row">
              <span>{position.ticker}</span>
              <div className="bar-wrap">
                <div
                  className={`bar ${position.weight >= LIMITS.singleName ? 'breach' : ''}`}
                  style={{ width: `${Math.min(100, position.weight * 8)}%` }}
                >
                  {position.weight}%
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="gauges">
          <div>
            <h3>Gross Exposure</h3>
            <meter min="0" max={LIMITS.grossExposure} value={exposure.grossExposure} />
            <p>
              {exposure.grossExposure}% / {LIMITS.grossExposure}%
            </p>
          </div>
          <div>
            <h3>Net Exposure</h3>
            <meter min="0" max={LIMITS.netExposure} value={exposure.netExposure} />
            <p>
              {exposure.netExposure}% / {LIMITS.netExposure}%
            </p>
          </div>
        </div>

        <div className="buying-power">
          Buying Power Remaining: <strong>{exposure.buyingPowerRemaining}</strong>
        </div>
      </section>
    </div>
  )
}

export default RiskOfficerView
