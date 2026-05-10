import { prisma } from "@/lib/db";
import { hash } from "bcryptjs";
import { UserType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  password: z.string().min(6),
  userType: z.nativeEnum(UserType),
});

/** Public self-service signup (demo / open registration). */
export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const body = registerSchema.parse(json);

    const existing = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
    });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 },
      );
    }

    const passwordHash = await hash(body.password, 12);

    await prisma.user.create({
      data: {
        email: body.email.toLowerCase(),
        name: body.name.trim(),
        passwordHash,
        type: body.userType,
        enabled: true,
        pending: false,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
