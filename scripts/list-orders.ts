import { prisma } from "../src/lib/db";

async function main() {
  const rows = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      trader: { select: { id: true, email: true, name: true } },
      breachLogs: true,
      activities: { orderBy: { createdAt: "asc" } },
    },
  });

  for (const r of rows) {
    console.log(
      `${r.id}  ${r.ticketKey}  ${r.ticker}  ${r.direction}  qty=${r.quantity}  status=${r.status}  trader=${r.trader?.email ?? '—'}  created=${r.createdAt.toISOString()}`,
    );
    if (r.breachLogs?.length) {
      console.log("   breaches:", r.breachLogs.map((b) => b.checkType).join(", "));
    }
    const lastAct = r.activities?.[r.activities.length - 1];
    if (lastAct) console.log("   last activity:", lastAct.createdAt.toISOString(), lastAct.message);
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
