import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { zfd } from "zod-form-data";
import UserService from "@/services/userService";
import { prisma } from "@/lib/db";

const createUserSchema = zfd.formData({
  inviteToken: zfd.text(),
  password: zfd.text(),
  name: zfd.text(),
});

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const parsed = createUserSchema.parse(formData);

    const user = await UserService.createUserFromInvite({
      token: parsed.inviteToken,
      password: parsed.password,
      name: parsed.name,
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        type: user.type,
      },
    });
  } catch (error) {
    console.error("User creation error:", error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        type: true,
        enabled: true,
        pending: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("User list error:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
