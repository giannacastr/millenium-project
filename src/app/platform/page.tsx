import { auth } from "@/auth";
import { redirect } from "next/navigation";
import PlatformClient from "./PlatformClient";

export default async function PlatformPage() {
  const session = await auth();
  if (!session?.user) redirect("/signIn");
  if (session.user.pending) redirect("/pending");
  if (!session.user.enabled) redirect("/deactivated");
  return <PlatformClient />;
}
