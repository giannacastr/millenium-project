import { auth } from "@/auth";
import { INITIAL_EXPOSURE, LIMITS } from "@/lib/trading/exposure";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ exposure: INITIAL_EXPOSURE, limits: LIMITS });
}
