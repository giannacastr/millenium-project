import { prisma } from "../src/lib/db";
import detectAndLogWashSale from "../src/lib/trading/washSale";

async function main() {
  const recent = await prisma.orderFill.findFirst({ orderBy: { executedAt: "desc" } });
  if (!recent) {
    console.log("No fills found in DB.");
    return;
  }

  console.log(`Running wash-sale detection for fill ${recent.id} (order ${recent.orderId}) executedAt=${recent.executedAt.toISOString()}`);

  try {
    await detectAndLogWashSale(recent.id);
  } catch (e) {
    console.error("Detection failed:", e);
  }

  const activities = await prisma.orderActivity.findMany({
    where: { message: { contains: "[WASH SALE]" } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  if (!activities.length) {
    console.log("No wash-sale activities found.");
  } else {
    console.log("Recent wash-sale activities:");
    for (const a of activities) {
      console.log(`${a.createdAt.toISOString()}  order=${a.orderId}  ${a.message}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
