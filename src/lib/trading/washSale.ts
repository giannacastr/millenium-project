import { prisma } from "@/lib/db";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 30;

export async function detectAndLogWashSale(fillId: number) {
  const fill = await prisma.orderFill.findUnique({
    where: { id: fillId },
    include: { order: true },
  });
  if (!fill) return;

  const ticker = fill.order.ticker;
  const center = fill.executedAt;
  const windowStart = new Date(center.getTime() - WINDOW_DAYS * MS_PER_DAY);
  const windowEnd = new Date(center.getTime() + WINDOW_DAYS * MS_PER_DAY);

  const fills = await prisma.orderFill.findMany({
    where: {
      order: { ticker },
      executedAt: {
        gte: windowStart,
        lte: windowEnd,
      },
    },
    include: { order: true },
    orderBy: { executedAt: "asc" },
  });

  if (!fills.length) return;

  // For each SELL in the window, check for buys in the +/-30d window
  const sells = fills.filter((f) => f.order.direction === "SELL");
  const buys = fills.filter((f) => f.order.direction === "BUY");
  if (!sells.length || !buys.length) return;

  for (const sell of sells) {
    // compute weighted average buy price for buys before this sell
    const priorBuys = await prisma.orderFill.findMany({
      where: {
        order: { ticker, direction: "BUY" },
        executedAt: { lt: sell.executedAt },
      },
    });

    const totalBoughtQty = priorBuys.reduce((s, b) => s + b.quantity, 0);
    if (totalBoughtQty <= 0) continue; // no basis data

    const weightedNotional = priorBuys.reduce((s, b) => s + b.quantity * b.price, 0);
    const avgCost = weightedNotional / totalBoughtQty;

    // if sell occurred at a loss relative to avg cost
    if (sell.price >= avgCost) continue;

    // find a buy within window that is not the same order
    const matchingBuy = fills.find(
      (f) => f.order.direction === "BUY" && f.orderId !== sell.orderId,
    );
    if (!matchingBuy) continue;

    // create an activity on the sell order to flag the potential wash
    const msg = `[WASH SALE] Potential wash-sale: sell ${sell.quantity} ${ticker} @ $${sell.price.toFixed(2)} on ${sell.executedAt.toISOString()} may be disallowed due to buy within ${WINDOW_DAYS} days (order ${matchingBuy.orderId}).`;
    try {
      await prisma.orderActivity.create({
        data: {
          orderId: sell.orderId,
          message: msg,
          actorName: "EMS",
        },
      });
    } catch (e) {
      console.error("[wash-sale] failed to create activity", e);
    }
  }
}

export default detectAndLogWashSale;
