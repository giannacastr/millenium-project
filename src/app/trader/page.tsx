import { auth } from "@/auth";
import { UserType } from "@prisma/client";
import { redirect } from "next/navigation";
import TraderDesk from "./TraderDesk";

export default async function TraderPage() {
  const session = await auth();
  if (!session?.user) redirect("/signIn");
  if (session.user.pending) redirect("/pending");
  if (!session.user.enabled) redirect("/deactivated");
  if (session.user.type !== UserType.EQUITY_TRADER) redirect("/");
  return <TraderDesk />;
}
