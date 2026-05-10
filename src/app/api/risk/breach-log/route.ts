import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { UserType } from "@prisma/client";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.type !== UserType.RISK_OFFICER) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await prisma.riskBreachLog.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      order: { select: { ticketKey: true, ticker: true, status: true } },
    },
    take: 200,
  });

  return NextResponse.json({ breaches: rows });
}
