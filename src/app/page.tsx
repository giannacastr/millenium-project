import { auth } from "@/auth";
import { UserType } from "@prisma/client";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth();

  if (!session?.user) {
    redirect("/signIn");
  }

  if (session.user.pending) {
    redirect("/pending");
  }

  if (!session.user.enabled) {
    redirect("/deactivated");
  }

  if (session.user.isSuper) {
    redirect("/platform/admin");
  }

  switch (session.user.type) {
    case UserType.EQUITY_TRADER:
      redirect("/trader");
    case UserType.RISK_OFFICER:
      redirect("/risk");
    case UserType.PRIME_BROKER:
      redirect("/broker");
    default:
      redirect("/platform");
  }
}
