import { prisma } from "@/lib/db";
import { hash, compare } from "bcryptjs";
import { v4 as uuid } from "uuid";
import { UserType } from "@prisma/client";

interface CreateUserInviteData {
  email: string;
  userType: UserType;
}

interface CreateUserFromInviteData {
  token: string;
  password: string;
  name: string;
}

class UserService {
  static async createUserInvite(data: CreateUserInviteData) {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new Error("User already exists");
    }

    const existingInvite = await prisma.userInvite.findUnique({
      where: { email: data.email },
    });

    if (existingInvite && new Date() < new Date(existingInvite.expiresAt)) {
      throw new Error("Invite already sent");
    }

    const token = uuid();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    return prisma.userInvite.create({
      data: {
        email: data.email,
        userType: data.userType,
        token,
        expiresAt,
      },
    });
  }

  static async createUserFromInvite(data: CreateUserFromInviteData) {
    const invite = await prisma.userInvite.findUnique({
      where: { token: data.token },
    });

    if (!invite) {
      throw new Error("Invalid invite");
    }

    if (new Date() > new Date(invite.expiresAt)) {
      throw new Error("Invite expired");
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: invite.email },
    });

    if (existingUser) {
      throw new Error("User already exists");
    }

    const passwordHash = await hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        email: invite.email,
        name: data.name,
        passwordHash,
        type: invite.userType,
        pending: true,
        enabled: false,
      },
    });

    await prisma.userInvite.delete({
      where: { token: data.token },
    });

    return user;
  }

  static async validatePassword(
    password: string,
    passwordHash: string
  ): Promise<boolean> {
    return compare(password, passwordHash);
  }

  static async checkPermission(
    userId: number | string,
    permission: keyof PermissionFlags
  ): Promise<boolean> {
    const numUserId = typeof userId === "string" ? parseInt(userId) : userId;
    const user = await prisma.user.findUnique({
      where: { id: numUserId },
    });

    if (!user || !user.enabled) {
      return false;
    }

    if (user.isSuper) {
      return true;
    }

    return Boolean(user[permission]);
  }
}

interface PermissionFlags {
  userRead: boolean;
  userWrite: boolean;
  orderRead: boolean;
  orderWrite: boolean;
  reportRead: boolean;
  reportWrite: boolean;
}

export default UserService;
