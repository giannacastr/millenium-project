import { useMemo, useState } from 'react'
import './App.css'
import RoleSelection from './components/RoleSelection'
import EquityTraderView from './roles/EquityTraderView'
import RiskOfficerView from './roles/RiskOfficerView'
import PrimeBrokerView from './roles/PrimeBrokerView'
import { INITIAL_EXPOSURE, INITIAL_ORDERS, TICKER_OPTIONS } from './data/constants'

const emptyTicket = {
  direction: 'Buy',
  ticker: 'MSFT',
  quantity: 5000,
  orderType: 'Market',
  limitPrice: '',
  account: 'Long Book',
  strategy: 'Core Equity',
  notes: '',
}

function App() {
  const [profile, setProfile] = useState({ name: '', role: '' })
  const [orders, setOrders] = useState(INITIAL_ORDERS)
  const [ticket, setTicket] = useState(emptyTicket)
  const [selectedOrderId, setSelectedOrderId] = useState(null)

  const tickerMeta = useMemo(
    () => TICKER_OPTIONS.find((option) => option.symbol === ticket.ticker) ?? TICKER_OPTIONS[0],
    [ticket.ticker],
  )

  const preTradeImpact = useMemo(() => {
    const price = Number(ticket.limitPrice) || tickerMeta.price
    const notional = Math.max(0, Number(ticket.quantity)) * price
    const singleNameAfter = 7 + notional / 20000000
    const sectorAfter = (INITIAL_EXPOSURE.sectorWeights[tickerMeta.sector] ?? 12) + notional / 35000000
    const buyingPowerAfter = INITIAL_EXPOSURE.buyingPowerUsed + notional / 25000000

    return { singleNameAfter, sectorAfter, buyingPowerAfter }
  }, [ticket, tickerMeta])

  const createOrder = (status) => {
    const newOrder = {
      id: `ORD-${1000 + orders.length + 1}`,
      trader: profile.name,
      ...ticket,
      quantity: Number(ticket.quantity),
      limitPrice: ticket.limitPrice,
      status,
      createdAt: new Date().toISOString(),
      riskChecks: [
        preTradeImpact.singleNameAfter > 10 ? 'Single-name concentration' : null,
        preTradeImpact.sectorAfter > 30 ? 'Sector cap' : null,
        preTradeImpact.buyingPowerAfter > 90 ? 'Buying power' : null,
      ].filter(Boolean),
    }

    setOrders((prev) => [newOrder, ...prev])
    setTicket(emptyTicket)
    setSelectedOrderId(newOrder.id)
  }

  const transitionOrder = (id, status) => {
    setOrders((prev) => prev.map((order) => (order.id === id ? { ...order, status } : order)))
  }

  const header = profile.role
    ? `${profile.role} View — ${profile.name}`
    : 'Select role to enter the platform'

  return (
    <main className="app-shell">
      <header className="card top-bar">
        <h1>{header}</h1>
        {profile.role && (
          <button type="button" onClick={() => setProfile({ name: '', role: '' })}>
            Switch Role
          </button>
        )}
      </header>

      {!profile.role ? (
        <RoleSelection
          profile={profile}
          setProfile={setProfile}
          onEnter={() => setProfile((prev) => ({ ...prev }))}
        />
      ) : null}

      {profile.role === 'Equity Trader' && (
        <EquityTraderView
          profile={profile}
          orders={orders}
          ticket={ticket}
          setTicket={setTicket}
          onSaveDraft={() => createOrder('Draft')}
          onSubmit={() => createOrder('Submitted')}
          onTransition={transitionOrder}
          selectedOrderId={selectedOrderId}
          setSelectedOrderId={setSelectedOrderId}
          preTradeImpact={preTradeImpact}
          exposure={INITIAL_EXPOSURE}
        />
      )}

      {profile.role === 'Risk Officer' && (
        <RiskOfficerView
          orders={orders}
          exposure={INITIAL_EXPOSURE}
          onTransition={transitionOrder}
          selectedOrderId={selectedOrderId}
          setSelectedOrderId={setSelectedOrderId}
        />
      )}

      {profile.role === 'Prime Broker' && (
        <PrimeBrokerView orders={orders} onTransition={transitionOrder} />
      )}
    </main>
  )
}

export default App
