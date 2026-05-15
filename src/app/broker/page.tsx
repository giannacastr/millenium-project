import { auth } from "@/auth";
import { UserType } from "@prisma/client";
import { redirect } from "next/navigation";
import BrokerDesk from "./BrokerDesk";

export default async function BrokerPage() {
  const session = await auth();
  if (!session?.user) redirect("/platform");
  if (session.user.pending) redirect("/pending");
  if (!session.user.enabled) redirect("/deactivated");
  if (session.user.type !== UserType.PRIME_BROKER) redirect("/");
  return <BrokerDesk />;
}
