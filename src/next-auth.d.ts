import type { UserType } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      type: UserType;
      enabled: boolean;
      pending: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    type?: UserType;
    enabled?: boolean;
    pending?: boolean;
  }
}
