import { useMemo } from 'react'

function OrderLadder({ ticker, currentPrice, orders }) {
  const ladderData = useMemo(
    () => [
      { price: currentPrice + 0.4, type: 'ask', size: 8500, status: 'resting' },
      { price: currentPrice + 0.25, type: 'ask', size: 6200, status: 'resting' },
      { price: currentPrice + 0.1, type: 'ask', size: 12100, status: 'resting' },
      { price: currentPrice - 0.05, type: 'bid', size: 15600, status: 'resting' },
      { price: currentPrice - 0.2, type: 'bid', size: 9800, status: 'resting' },
      { price: currentPrice - 0.35, type: 'bid', size: 7300, status: 'resting' },
    ],
    [currentPrice],
  )

  const userOrders = orders.filter((o) => o.ticker === ticker && o.status !== 'Fully Filled' && o.status !== 'Rejected')

  return (
    <section className="order-ladder">
      <h3>Order Book Ladder</h3>
      <div className="ladder-container">
        {ladderData
          .sort((a, b) => b.price - a.price)
          .map((level, idx) => (
            <div key={idx} className={`ladder-level ${level.type}`}>
              <div className="level-price">${level.price.toFixed(2)}</div>
              <div className="level-size-display">
                <div
                  className={`size-indicator ${level.type}`}
                  style={{
                    width: `${Math.min(90, (level.size / 20000) * 100)}%`,
                  }}
                ></div>
              </div>
              <div className="level-size">{(level.size / 1000).toFixed(0)}K</div>
              {userOrders.some(
                (o) => Math.abs(o.limitPrice ? Number(o.limitPrice) : currentPrice - o.price) < 0.01,
              ) && <div className="user-order-mark">●</div>}
            </div>
          ))}
      </div>

      {userOrders.length > 0 && (
        <div className="ladder-orders-summary">
          <h4>Your Resting Orders</h4>
          {userOrders.map((order) => (
            <div key={order.id} className="resting-order">
              <span className="order-side">{order.direction}</span>
              <span className="order-qty">{order.quantity.toLocaleString()} {order.ticker}</span>
              {order.orderType === 'Limit' && <span className="order-price">@ ${order.limitPrice}</span>}
              <span className={`order-status ${order.status.toLowerCase().replace(/\s+/g, '-')}`}>
                {order.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export default OrderLadder
