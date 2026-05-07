# Millenium Project - Equity Order Ticket System

Bare-bones React web app for order entry with role-based front-end views backed by shared in-memory order data.

## Roles
- **Equity Trader**: enter new orders, save draft/submit, view order table, update state, inspect order detail, and view position monitor.
- **Risk Officer**: review submitted orders, approve/reject/approve-with-conditions, breach log, and exposure dashboard.
- **Prime Broker**: incoming queue for broker actions (acknowledge/reject) and daily activity log.

## Core capabilities
- Enter orders (new order ticket)
- View orders (tables/logs across all roles)
- Change state (status transitions by role actions)
- Pre-trade impact preview and simple portfolio exposure visualizations

## Run locally
```bash
npm install
npm run dev
```

## Validate
```bash
npm run lint
npm run build
```
