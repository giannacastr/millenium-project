import { prisma } from "../src/lib/db";
import { hash } from "bcryptjs";
import {
  OrderDirection,
  OrderStatus,
  OrderTypeEnum,
  UserType,
} from "@prisma/client";

async function main() {
  console.log("Seeding database...");

  await prisma.orderActivity.deleteMany();
  await prisma.riskBreachLog.deleteMany();
  await prisma.order.deleteMany();

  const hashedPassword = await hash("password123", 12);

  const trader = await prisma.user.upsert({
    where: { email: "trader@test.com" },
    update: {
      name: "Alex Trader",
      passwordHash: hashedPassword,
      type: UserType.EQUITY_TRADER,
      enabled: true,
      pending: false,
      orderRead: true,
      orderWrite: true,
    },
    create: {
      email: "trader@test.com",
      name: "Alex Trader",
      passwordHash: hashedPassword,
      type: UserType.EQUITY_TRADER,
      enabled: true,
      pending: false,
      orderRead: true,
      orderWrite: true,
    },
  });

  const risk = await prisma.user.upsert({
    where: { email: "risk@test.com" },
    update: {
      name: "Jordan Risk",
      passwordHash: hashedPassword,
      type: UserType.RISK_OFFICER,
      enabled: true,
      pending: false,
      reportRead: true,
      orderRead: true,
    },
    create: {
      email: "risk@test.com",
      name: "Jordan Risk",
      passwordHash: hashedPassword,
      type: UserType.RISK_OFFICER,
      enabled: true,
      pending: false,
      reportRead: true,
      orderRead: true,
    },
  });

  const broker = await prisma.user.upsert({
    where: { email: "broker@test.com" },
    update: {
      name: "Sam Broker",
      passwordHash: hashedPassword,
      type: UserType.PRIME_BROKER,
      enabled: true,
      pending: false,
      orderRead: true,
      orderWrite: true,
    },
    create: {
      email: "broker@test.com",
      name: "Sam Broker",
      passwordHash: hashedPassword,
      type: UserType.PRIME_BROKER,
      enabled: true,
      pending: false,
      orderRead: true,
      orderWrite: true,
    },
  });

  console.log("✓ Users:", trader.email, risk.email, broker.email);

  const admin = await prisma.user.upsert({
    where: { email: "admin@test.com" },
    update: {
      name: "Casey Admin",
      passwordHash: hashedPassword,
      type: UserType.RISK_OFFICER,
      enabled: true,
      pending: false,
      isSuper: true,
      userRead: true,
      userWrite: true,
      orderRead: true,
      orderWrite: true,
      reportRead: true,
      reportWrite: true,
    },
    create: {
      email: "admin@test.com",
      name: "Casey Admin",
      passwordHash: hashedPassword,
      type: UserType.RISK_OFFICER,
      enabled: true,
      pending: false,
      isSuper: true,
      userRead: true,
      userWrite: true,
      orderRead: true,
      orderWrite: true,
      reportRead: true,
      reportWrite: true,
    },
  });

  console.log("✓ Admin:", admin.email);

  // --- Portfolio + limits (new) ---
  await prisma.holding.deleteMany();
  await prisma.riskLimit.deleteMany();

  await prisma.holding.createMany({
    data: [
      { ticker: "MSFT", shares: 10_000 },
      { ticker: "AAPL", shares: 8_500 },
      { ticker: "NVDA", shares: 6_200 },
      { ticker: "JPM", shares: 12_000 },
      { ticker: "XOM", shares: 9_800 },
    ],
  });

  await prisma.riskLimit.create({
    data: {
      singleNameCapPct: 10,
      sectorCapPct: 30,
      grossExposureCapPct: 180,
      netExposureCapPct: 70,
      buyingPowerUsedCapPct: 90,
      // Simple initial value; will be editable in admin screen.
      maxOrderNotional: 5_000_000,
    },
  });

  console.log("✓ Seeded initial holdings + risk limits");

  const mkTitle = (dir: OrderDirection, ticker: string, qty: number) =>
    `${dir === OrderDirection.BUY ? "Buy" : dir === OrderDirection.SELL ? "Sell" : "Short"} ${ticker} · ${qty.toLocaleString()} shares`;

  const o1 = await prisma.order.create({
    data: {
      ticketKey: "EQ-001",
      title: mkTitle(OrderDirection.BUY, "MSFT", 50000),
      direction: OrderDirection.BUY,
      ticker: "MSFT",
      quantity: 50000,
      orderType: OrderTypeEnum.LIMIT,
      limitPrice: "411.50",
      account: "Long Book",
      strategy: "Core Equity",
      notes: "Model signal confirmed",
      status: OrderStatus.SUBMITTED,
      traderId: trader.id,
    },
  });

  await prisma.orderActivity.createMany({
    data: [
      {
        orderId: o1.id,
        message: `Submitted by ${trader.name} · ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
        actorName: trader.name,
      },
      {
        orderId: o1.id,
        message:
          "Risk check flagged: single-name concentration · pending manual review",
        actorName: "System",
      },
    ],
  });

  await prisma.riskBreachLog.create({
    data: {
      orderId: o1.id,
      checkType: "Single-name concentration",
      breachDetail: "Post-trade weight would exceed soft limit",
      resolution: "Pending",
    },
  });

  const o2 = await prisma.order.create({
    data: {
      ticketKey: "EQ-002",
      title: mkTitle(OrderDirection.SELL, "XOM", 15000),
      direction: OrderDirection.SELL,
      ticker: "XOM",
      quantity: 15000,
      orderType: OrderTypeEnum.MARKET,
      limitPrice: null,
      account: "Long Book",
      strategy: "Event Driven",
      notes: "Trim position",
      status: OrderStatus.RISK_APPROVED,
      traderId: trader.id,
      reviewedById: risk.id,
    },
  });

  await prisma.orderActivity.createMany({
    data: [
      {
        orderId: o2.id,
        message: `Submitted by ${trader.name}`,
        actorName: trader.name,
      },
      {
        orderId: o2.id,
        message: `Approved by ${risk.name}`,
        actorName: risk.name,
      },
    ],
  });

  console.log("✓ Sample orders EQ-001, EQ-002");

  console.log("\nSeed completed! Test logins (password: password123):");
  console.log("- Equity Trader: trader@test.com");
  console.log("- Risk Officer:   risk@test.com");
  console.log("- Prime Broker:   broker@test.com");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
