import { auth } from "@/auth";
import { UserType } from "@prisma/client";
import { redirect } from "next/navigation";
import RiskDesk from "./RiskDesk";

export default async function RiskPage() {
  const session = await auth();
  if (!session?.user) redirect("/platform");
  if (session.user.pending) redirect("/pending");
  if (!session.user.enabled) redirect("/deactivated");
  if (session.user.type !== UserType.RISK_OFFICER) redirect("/");
  return <RiskDesk />;
}
