"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { UserType } from "@prisma/client";

const INVALID_CREDENTIALS_ERR = "INVALID_CREDENTIALS";

const ROLES: {
  type: UserType;
  label: string;
  path: string;
  desc: string;
}[] = [
  {
    type: UserType.EQUITY_TRADER,
    label: "Equity Trader",
    path: "/trader",
    desc: "Submit tickets, monitor blotter, execution & positions.",
  },
  {
    type: UserType.RISK_OFFICER,
    label: "Risk Officer",
    path: "/risk",
    desc: "Approve trades, breach log, portfolio exposure dashboard.",
  },
  {
    type: UserType.PRIME_BROKER,
    label: "Prime Broker",
    path: "/broker",
    desc: "Acknowledge routed orders, daily activity feed.",
  },
];

function SignInForm({ onSuccess }: { onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email")?.toString() || "";
    const password = formData.get("password")?.toString() || "";

    try {
      const resp = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (resp?.error === INVALID_CREDENTIALS_ERR) {
        setError("Invalid email or password");
        return;
      }

      if (resp?.error) {
        setError(resp.error);
        return;
      }

      onSuccess();
    } catch {
      setError("Unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-2xl border border-slate-600/50 bg-white/5 p-8 backdrop-blur">
        <h2 className="mb-6 text-center text-2xl font-semibold text-white">
          Sign in
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-400 bg-red-100/10 p-3 text-sm text-red-300">
              {error}
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm text-slate-300" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="your@email.com"
              required
              disabled={loading}
              className="w-full rounded-lg border border-slate-600 bg-slate-800/50 px-3 py-2 text-sm text-white placeholder-slate-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-300" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="••••••"
              required
              disabled={loading}
              className="w-full rounded-lg border border-slate-600 bg-slate-800/50 px-3 py-2 text-sm text-white placeholder-slate-400"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-blue-500 py-3 text-sm font-medium text-white hover:bg-blue-400 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-slate-400">
          Demo accounts: trader@test.com / risk@test.com / broker@test.com
          <br />
          Password: password123
        </p>
      </div>
    </div>
  );
}

export default function PlatformClient() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const selfType = session?.user?.type;
  const isSuper = Boolean((session?.user as any)?.isSuper);

  if (status === "loading") {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <p className="text-slate-400">Loading...</p>
        </div>
      </main>
    );
  }

  if (!session?.user) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <header className="mb-12 border-b-[4.5px] border-[#1434CB] pb-10 text-center">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
              Millennium
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">
              Equity Order Ticket System
            </h1>
            <p className="mt-4 text-slate-300">
              Sign in to access your desk.
            </p>
          </header>
          <SignInForm onSuccess={() => router.refresh()} />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="mx-auto max-w-4xl px-6 py-16">
        <header className="mb-12 border-b-[4.5px] border-[#1434CB] pb-10 text-center">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
            Millennium
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">
            Equity Order Ticket System
          </h1>
          <p className="mt-4 text-slate-300">
            Signed in as{" "}
            <strong>{session?.user?.name}</strong> ({session?.user?.email})
          </p>
          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => signOut({ redirectTo: "/platform" })}
              className="rounded-lg border border-slate-500 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
            >
              Sign out
            </button>
            <img src="/images/logo-mlp.png" alt="Millennium" className="ml-3 h-5 w-auto mt-2" />
          </div>
        </header>

        <div className="grid gap-6 md:grid-cols-3">
          {ROLES.map((r) => {
            const allowed = selfType === r.type;
            return (
              <div
                key={r.type}
                className={`flex flex-col rounded-2xl border p-6 ${
                  allowed
                    ? "border-blue-400/50 bg-white/10 shadow-lg shadow-blue-900/20"
                    : "border-slate-600/50 bg-white/5 opacity-70"
                }`}
              >
                <h2 className="text-xl font-semibold">{r.label}</h2>
                <p className="mt-2 flex-1 text-sm text-slate-300">{r.desc}</p>
                {allowed ? (
                  <Link
                    href={r.path}
                    className="mt-6 inline-flex justify-center rounded-xl bg-blue-500 px-4 py-3 text-center text-sm font-medium text-white hover:bg-blue-400"
                  >
                    Enter desk
                  </Link>
                ) : (
                  <p className="mt-6 rounded-xl bg-slate-800/80 px-4 py-3 text-center text-xs text-slate-400">
                    Sign in with a user assigned to this role (e.g.{" "}
                    {r.type === UserType.EQUITY_TRADER
                      ? "trader@test.com"
                      : r.type === UserType.RISK_OFFICER
                        ? "risk@test.com"
                        : "broker@test.com"}
                    ).
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {isSuper && (
          <div className="mt-10 text-center">
            <Link
              href="/platform/admin"
              className="inline-flex justify-center rounded-xl bg-white/10 px-4 py-3 text-sm font-medium text-white hover:bg-white/15"
            >
              Admin: Portfolio builder
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
