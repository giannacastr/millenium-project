import { auth } from "@/auth";
import { redirect } from "next/navigation";
import PlatformClient from "./PlatformClient";

export default async function PlatformPage() {
  const session = await auth();
  if (session?.user?.pending) redirect("/pending");
  if (session?.user && !session.user.enabled) redirect("/deactivated");
  return <PlatformClient />;
}
