import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminPortfolioBuilder from "./ui/AdminPortfolioBuilder";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/signIn");
  if (session.user.pending) redirect("/pending");
  if (!session.user.enabled) redirect("/deactivated");
  if (!session.user.isSuper) redirect("/platform");

  return <AdminPortfolioBuilder />;
}

