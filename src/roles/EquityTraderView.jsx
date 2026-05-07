import {
  ACCOUNT_OPTIONS,
  DIRECTION_OPTIONS,
  ORDER_TYPE_OPTIONS,
  STRATEGY_OPTIONS,
  TICKER_OPTIONS,
} from '../data/constants'

const STATUS_OPTIONS = [
  'Draft',
  'Submitted',
  'Acknowledged',
  'Partially Filled',
  'Fully Filled',
  'Rejected',
  'Cancelled',
]

function EquityTraderView({
  profile,
  orders,
  ticket,
  setTicket,
  onSaveDraft,
  onSubmit,
  onTransition,
  selectedOrderId,
  setSelectedOrderId,
  preTradeImpact,
}) {
  const myOrders = orders.filter((order) => order.trader === profile.name)

  return (
    <div className="layout two-col">
      <section className="card">
        <h2>New Order Ticket</h2>
        <div className="form-grid">
          <label>
            Direction
            <select
              value={ticket.direction}
              onChange={(event) => setTicket((prev) => ({ ...prev, direction: event.target.value }))}
            >
              {DIRECTION_OPTIONS.map((direction) => (
                <option key={direction} value={direction}>
                  {direction}
                </option>
              ))}
            </select>
          </label>
          <label>
            Ticker
            <input
              list="ticker-options"
              value={ticket.ticker}
              onChange={(event) =>
                setTicket((prev) => ({ ...prev, ticker: event.target.value.toUpperCase() }))
              }
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
              onChange={(event) => setTicket((prev) => ({ ...prev, quantity: event.target.value }))}
            />
          </label>
          <label>
            Order Type
            <select
              value={ticket.orderType}
              onChange={(event) => setTicket((prev) => ({ ...prev, orderType: event.target.value }))}
            >
              {ORDER_TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          {ticket.orderType === 'Limit' && (
            <label>
              Limit Price
              <input
                type="number"
                min="0"
                step="0.01"
                value={ticket.limitPrice}
                onChange={(event) =>
                  setTicket((prev) => ({ ...prev, limitPrice: event.target.value }))
                }
              />
            </label>
          )}
          <label>
            Account
            <select
              value={ticket.account}
              onChange={(event) => setTicket((prev) => ({ ...prev, account: event.target.value }))}
            >
              {ACCOUNT_OPTIONS.map((account) => (
                <option key={account} value={account}>
                  {account}
                </option>
              ))}
            </select>
          </label>
          <label>
            Strategy
            <select
              value={ticket.strategy}
              onChange={(event) => setTicket((prev) => ({ ...prev, strategy: event.target.value }))}
            >
              {STRATEGY_OPTIONS.map((strategy) => (
                <option key={strategy} value={strategy}>
                  {strategy}
                </option>
              ))}
            </select>
          </label>
          <label className="full-width">
            Notes
            <textarea
              value={ticket.notes}
              onChange={(event) => setTicket((prev) => ({ ...prev, notes: event.target.value }))}
            />
          </label>
        </div>

        <div className="impact-box">
          <h3>Live Pre-Trade Impact</h3>
          <ul>
            <li>Single-name concentration (post): {preTradeImpact.singleNameAfter.toFixed(1)}%</li>
            <li>Sector exposure (post): {preTradeImpact.sectorAfter.toFixed(1)}%</li>
            <li>Buying power used (post): {preTradeImpact.buyingPowerAfter.toFixed(1)}%</li>
          </ul>
        </div>

        <div className="actions">
          <button type="button" onClick={onSaveDraft}>
            Save as Draft
          </button>
          <button type="button" onClick={onSubmit}>
            Submit for Review
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Today&apos;s Orders</h2>
        <table>
          <thead>
            <tr>
              <th>Ticket</th>
              <th>Ticker</th>
              <th>Status</th>
              <th>Time</th>
              <th>State</th>
            </tr>
          </thead>
          <tbody>
            {myOrders.map((order) => (
              <tr key={order.id} onClick={() => setSelectedOrderId(order.id)}>
                <td>{order.id}</td>
                <td>{order.ticker}</td>
                <td>
                  <span className={`pill ${order.status.toLowerCase().replace(/\s+/g, '-')}`}>
                    {order.status}
                  </span>
                </td>
                <td>{new Date(order.createdAt).toLocaleTimeString()}</td>
                <td>
                  <select
                    value={order.status}
                    onChange={(event) => onTransition(order.id, event.target.value)}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {selectedOrderId && (
          <div className="detail-box">
            <h3>Order Detail</h3>
            {myOrders
              .filter((order) => order.id === selectedOrderId)
              .map((order) => (
                <ul key={order.id}>
                  <li>Direction: {order.direction}</li>
                  <li>Qty: {order.quantity.toLocaleString()}</li>
                  <li>Type: {order.orderType}</li>
                  <li>Account: {order.account}</li>
                  <li>Strategy: {order.strategy}</li>
                  <li>Notes: {order.notes || '—'}</li>
                </ul>
              ))}
          </div>
        )}

        <h3>Position Monitor</h3>
        <table>
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Side</th>
              <th>Qty</th>
              <th>Day P&amp;L</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>MSFT</td>
              <td>Long</td>
              <td>90,000</td>
              <td>$182,000</td>
            </tr>
            <tr>
              <td>XOM</td>
              <td>Short</td>
              <td>35,000</td>
              <td>-$24,000</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  )
}

export default EquityTraderView
