import type { NextAuthConfig } from "next-auth";

export default {
  providers: [],
  trustHost: true,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/platform",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        const u = user as any;
        token.id = String(u.id) || "";
        token.type = u.type;
        token.enabled = u.enabled;
        token.pending = u.pending;
        token.isSuper = Boolean(u.isSuper);
      }
      return token;
    },
    session({ session, token }) {
      const user = session.user as any;
      user.id = String(token.id) || "";
      user.type = token.type;
      user.enabled = Boolean(token.enabled);
      user.pending = Boolean(token.pending);
      user.isSuper = Boolean(token.isSuper);
      return session;
    },
  },
} satisfies NextAuthConfig;
