import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import RoleSelection from './components/RoleSelection'
import EquityTraderView from './roles/EquityTraderView'
import RiskOfficerView from './roles/RiskOfficerView'
import PrimeBrokerView from './roles/PrimeBrokerView'
import { INITIAL_EXPOSURE, INITIAL_ORDERS, TICKER_OPTIONS } from './data/constants'
import { FINNHUB_KEY } from './data/finnhub'

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
  const [livePrice, setLivePrice] = useState(null)
  const [quote, setQuote] = useState(null)
  const wsRef = useRef(null)
  const subscribedRef = useRef(null)

  const tickerMeta = useMemo(
    () => TICKER_OPTIONS.find((option) => option.symbol === ticket.ticker) ?? TICKER_OPTIONS[0],
    [ticket.ticker],
  )

  // Single Finnhub WebSocket; subscribe to ticket.ticker, resubscribe on change
  useEffect(() => {
    if (!FINNHUB_KEY) return

    const ws = new WebSocket(`wss://ws.finnhub.io?token=${FINNHUB_KEY}`)
    wsRef.current = ws

    ws.addEventListener('open', () => {
      if (ticket.ticker) {
        ws.send(JSON.stringify({ type: 'subscribe', symbol: ticket.ticker }))
        subscribedRef.current = ticket.ticker
      }
    })

    ws.addEventListener('message', (evt) => {
      try {
        const msg = JSON.parse(evt.data)
        if (msg?.type === 'trade' && Array.isArray(msg.data) && msg.data.length > 0) {
          const last = msg.data[0]?.p
          if (typeof last === 'number' && Number.isFinite(last)) {
            setLivePrice(last)
          }
        }
      } catch {
        // ignore malformed messages
      }
    })

    ws.addEventListener('close', () => {
      wsRef.current = null
      subscribedRef.current = null
    })

    return () => {
      try {
        if (subscribedRef.current) {
          ws.send(JSON.stringify({ type: 'unsubscribe', symbol: subscribedRef.current }))
        }
      } catch {
        // ignore
      }
      ws.close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return

    const prev = subscribedRef.current
    if (prev && prev !== ticket.ticker) {
      ws.send(JSON.stringify({ type: 'unsubscribe', symbol: prev }))
      subscribedRef.current = null
    }
    if (ticket.ticker && subscribedRef.current !== ticket.ticker) {
      ws.send(JSON.stringify({ type: 'subscribe', symbol: ticket.ticker }))
      subscribedRef.current = ticket.ticker
    }
  }, [ticket.ticker])

  // On ticker change, fetch Finnhub quote snapshot (high/low/open/prev close/volume)
  useEffect(() => {
    let cancelled = false
    async function run() {
      try {
        const res = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticket.ticker)}&token=${FINNHUB_KEY}`,
        )
        const data = await res.json()
        if (!cancelled) setQuote(data)
      } catch {
        if (!cancelled) setQuote(null)
      }
    }
    if (ticket.ticker) void run()
    return () => {
      cancelled = true
    }
  }, [ticket.ticker])

  const preTradeImpact = useMemo(() => {
    const price = Number(ticket.limitPrice) || livePrice || tickerMeta.price
    const notional = Math.max(0, Number(ticket.quantity)) * price
    const singleNameAfter = 7 + notional / 20000000
    const sectorAfter = (INITIAL_EXPOSURE.sectorWeights[tickerMeta.sector] ?? 12) + notional / 35000000
    const buyingPowerAfter = INITIAL_EXPOSURE.buyingPowerUsed + notional / 25000000

    return { singleNameAfter, sectorAfter, buyingPowerAfter }
  }, [ticket, tickerMeta, livePrice])

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
          livePrice={livePrice}
          quote={quote}
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
