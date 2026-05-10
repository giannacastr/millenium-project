import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { zfd } from "zod-form-data";
import UserService from "@/services/userService";
import { prisma } from "@/lib/db";
import { UserType } from "@prisma/client";

const createInviteSchema = zfd.formData({
  email: zfd.text(),
  userType: zfd.text(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse form data
    const formData = await req.formData();
    const parsed = createInviteSchema.parse(formData);

    const invite = await UserService.createUserInvite({
      email: parsed.email,
      userType: parsed.userType as UserType,
    });

    return NextResponse.json({ invite });
  } catch (error) {
    console.error("Invite creation error:", error);
    return NextResponse.json(
      { error: "Failed to create invite" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  try {
    const invite = await prisma.userInvite.findUnique({
      where: { token },
    });

    if (!invite) {
      return NextResponse.json({ error: "Invalid invite" }, { status: 404 });
    }

    const isExpired = new Date() > new Date(invite.expiresAt);
    if (isExpired) {
      return NextResponse.json({ error: "Invite expired" }, { status: 410 });
    }

    return NextResponse.json({
      email: invite.email,
      userType: invite.userType,
    });
  } catch (error) {
    console.error("Invite validation error:", error);
    return NextResponse.json(
      { error: "Failed to validate invite" },
      { status: 500 }
    );
  }
}
