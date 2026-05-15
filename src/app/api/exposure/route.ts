import { auth } from "@/auth";
import { computeExposureSnapshot } from "@/lib/trading/portfolio";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const snapshot = await computeExposureSnapshot();
    return NextResponse.json(snapshot, {
      headers: { "Cache-Control": "private, max-age=5, stale-while-revalidate=10" },
    });
  } catch (e) {
    console.error("[api/exposure]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
