import { prisma } from "../src/lib/db";

async function main() {
  console.log("\n=== Orders in database ===\n");

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      trader: { select: { email: true, name: true } },
      activities: { take: 1, orderBy: { createdAt: "desc" } },
    },
  });

  if (!orders.length) {
    console.log("No orders found");
    return;
  }

  console.log(`Found ${orders.length} orders:\n`);
  for (const o of orders) {
    console.log(`  ID: ${o.id}`);
    console.log(`  Ticket: ${o.ticketKey}`);
    console.log(`  Ticker: ${o.ticker} ${o.direction}`);
    console.log(`  Status: ${o.status}`);
    console.log(`  Trader: ${o.trader?.name} (${o.trader?.email})`);
    console.log(`  Created: ${o.createdAt.toISOString()}`);
    console.log(`  Last activity: ${o.activities[0]?.createdAt.toISOString()} - "${o.activities[0]?.message}"`);
    console.log("");
  }
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
