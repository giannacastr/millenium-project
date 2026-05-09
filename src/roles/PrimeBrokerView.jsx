function PrimeBrokerView({ orders, onTransition }) {
  const queue = orders.filter((order) => ['Approved', 'Approved with Conditions'].includes(order.status))

  return (
    <div className="layout two-col">
      <section className="card">
        <h2>Incoming Order Queue</h2>
        <table>
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Direction</th>
              <th>Quantity</th>
              <th>Type</th>
              <th>Strategy</th>
              <th>Trader</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {queue.map((order) => (
              <tr key={order.id}>
                <td>{order.ticker}</td>
                <td>{order.direction}</td>
                <td>{order.quantity.toLocaleString()}</td>
                <td>{order.orderType}</td>
                <td>{order.strategy}</td>
                <td>{order.trader}</td>
                <td>
                  <div className="actions inline">
                    <button type="button" onClick={() => onTransition(order.id, 'Acknowledged')}>
                      Acknowledge
                    </button>
                    <button type="button" onClick={() => onTransition(order.id, 'Rejected')}>
                      Reject
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>Daily Activity Log</h2>
        <ul className="activity-log">
          {[...orders]
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .map((order) => (
              <li key={`${order.id}-${order.status}`}>
                <strong>{new Date(order.createdAt).toLocaleTimeString()}</strong> — {order.id} {order.ticker}{' '}
                {order.status}
              </li>
            ))}
        </ul>
      </section>
    </div>
  )
}

export default PrimeBrokerView
