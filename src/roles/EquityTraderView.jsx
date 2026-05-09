import EnhancedOrderTicket from '../components/EnhancedOrderTicket'
import MarketDataPanel from '../components/MarketDataPanel'
import OrderLadder from '../components/OrderLadder'
import ExecutionHistory from '../components/ExecutionHistory'
import PortfolioMiniDashboard from '../components/PortfolioMiniDashboard'
import { TICKER_OPTIONS } from '../data/constants'

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
  exposure,
}) {
  const myOrders = orders.filter((order) => order.trader === profile.name)
  const activeOrders = myOrders.filter((o) => !['Fully Filled', 'Rejected', 'Cancelled'].includes(o.status))
  
  const tickerMeta = TICKER_OPTIONS.find((option) => option.symbol === ticket.ticker) ?? TICKER_OPTIONS[0]

  return (
    <div className="trader-layout">
      {/* Top Market Data Bar */}
      <div className="market-bar">
        <MarketDataPanel ticker={ticket.ticker} tickerMeta={tickerMeta} />
      </div>

      {/* Main Content Grid */}
      <div className="trader-grid">
        {/* Left: Order Ticket (Primary Workflow) */}
        <div className="panel ticket-panel">
          <EnhancedOrderTicket
            profile={profile}
            ticket={ticket}
            setTicket={setTicket}
            onSaveDraft={onSaveDraft}
            onSubmit={onSubmit}
            preTradeImpact={preTradeImpact}
            tickerMeta={tickerMeta}
          />
        </div>

        {/* Right: Market Data & Risk Dashboard */}
        <div className="panel right-stack">
          <OrderLadder ticker={ticket.ticker} currentPrice={tickerMeta.price} orders={activeOrders} />
          <PortfolioMiniDashboard exposure={exposure} preTradeImpact={preTradeImpact} />
        </div>
      </div>

      {/* Bottom: Execution History & Active Orders */}
      <div className="trader-footer">
        <div className="panel footer-panel">
          <ExecutionHistory orders={myOrders} traderName={profile.name} />
        </div>

        <div className="panel footer-panel">
          <section className="active-orders">
            <h3>All Orders</h3>
            {myOrders.length === 0 ? (
              <p className="empty-state">No orders yet</p>
            ) : (
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Ticker</th>
                    <th>Side</th>
                    <th>Qty</th>
                    <th>Type</th>
                    <th>Price</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {myOrders.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedOrderId(order.id)}
                      className={selectedOrderId === order.id ? 'selected' : ''}
                    >
                      <td className="order-id">{order.id}</td>
                      <td className="ticker">{order.ticker}</td>
                      <td className={`side ${order.direction.toLowerCase()}`}>{order.direction}</td>
                      <td className="qty">{order.quantity.toLocaleString()}</td>
                      <td className="type">{order.orderType}</td>
                      <td className="price">
                        {order.orderType === 'Limit' ? `$${order.limitPrice}` : 'MKT'}
                      </td>
                      <td>
                        <select
                          value={order.status}
                          onChange={(event) => onTransition(order.id, event.target.value)}
                          onClick={(event) => event.stopPropagation()}
                          className={`status-select ${order.status.toLowerCase().replace(/\s+/g, '-')}`}
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
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

export default EquityTraderView
