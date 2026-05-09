function ExecutionHistory({ orders, traderName }) {
  const executedOrders = orders
    .filter((o) => o.trader === traderName && (o.status === 'Fully Filled' || o.status === 'Partially Filled'))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  const totalNotional = executedOrders.reduce(
    (sum, o) => sum + (Number(o.quantity) * (Number(o.limitPrice) || 100)),
    0,
  )

  const totalShares = executedOrders.reduce((sum, o) => sum + Number(o.quantity), 0)

  return (
    <section className="execution-history">
      <h3>Execution History</h3>

      <div className="exec-summary">
        <div className="exec-stat">
          <span className="stat-label">Filled Orders</span>
          <span className="stat-value">{executedOrders.length}</span>
        </div>
        <div className="exec-stat">
          <span className="stat-label">Total Shares</span>
          <span className="stat-value">{totalShares.toLocaleString()}</span>
        </div>
        <div className="exec-stat">
          <span className="stat-label">Total Notional</span>
          <span className="stat-value">${(totalNotional / 1000000).toFixed(1)}M</span>
        </div>
      </div>

      <div className="exec-table-container">
        <table className="exec-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Ticker</th>
              <th>Side</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Status</th>
              <th>Strategy</th>
            </tr>
          </thead>
          <tbody>
            {executedOrders.slice(0, 10).map((order) => (
              <tr key={order.id} className={`status-${order.status.toLowerCase().replace(/\s+/g, '-')}`}>
                <td className="time">{new Date(order.createdAt).toLocaleTimeString()}</td>
                <td className="ticker">{order.ticker}</td>
                <td className={`side ${order.direction.toLowerCase()}`}>{order.direction}</td>
                <td className="qty">{order.quantity.toLocaleString()}</td>
                <td className="price">
                  {order.orderType === 'Limit' ? `$${order.limitPrice}` : 'MKT'}
                </td>
                <td>
                  <span className={`status-badge ${order.status.toLowerCase().replace(/\s+/g, '-')}`}>
                    {order.status}
                  </span>
                </td>
                <td className="strategy">{order.strategy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default ExecutionHistory
