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
      <div className="rounded-2xl bg-white p-8">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-400 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm text-slate-700" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="your@email.com"
              required
              disabled={loading}
              className="w-full rounded-lg border border-blue-400/50 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-700" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="••••••"
              required
              disabled={loading}
              className="w-full rounded-lg border border-blue-400/50 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400"
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
        <p className="mt-4 text-center text-xs text-slate-500">
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
      <main className="min-h-screen bg-white">
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <p className="text-slate-500">Loading...</p>
        </div>
      </main>
    );
  }

  if (!session?.user) {
    return (
      <main className="min-h-screen bg-white">
        <header className="border-b-[4.5px] border-[#1434CB] bg-white">
          <div className="mx-auto max-w-4xl px-6 pt-24 pb-10 text-center">
            <img src="/images/logo-mlp.png" alt="Millennium" className="mx-auto h-16 w-auto mb-4" />
            <p className="text-slate-700">
              Sign in to access your desk.
            </p>
          </div>
        </header>
        <div className="mx-auto max-w-4xl px-6 pb-16 mt-10">
          <SignInForm onSuccess={() => router.refresh()} />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white">
      <header className="border-b-[4.5px] border-[#1434CB] bg-white">
        <div className="mx-auto max-w-4xl px-6 pt-24 pb-10 text-center">
          <img src="/images/logo-mlp.png" alt="Millennium" className="mx-auto h-16 w-auto mb-4" />
          <p className="text-slate-700">
            Signed in as{" "}
            <strong>{session?.user?.name}</strong> ({session?.user?.email})
          </p>
        </div>
        <button
          type="button"
          onClick={() => signOut({ redirectTo: "/platform" })}
          className="absolute right-4 top-4 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Sign out
        </button>
      </header>

      <div className="mx-auto max-w-4xl px-6 pb-16 mt-10">
        <div className={`grid gap-6 ${isSuper ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
          {[...ROLES, ...(isSuper ? [{
            type: "ADMIN" as UserType,
            label: "Administrator",
            path: "/platform/admin",
            desc: "Portfolio builder, user management, system configuration.",
          }] : [])].map((r) => {
            const allowed = selfType === r.type || (r.type === ("ADMIN" as UserType) && isSuper);
            return (
              <div
                key={r.type}
                className={`flex flex-col rounded-2xl border p-6 ${
                  allowed
                    ? "border-blue-400/50 bg-white shadow-sm"
                    : "border-slate-200 bg-white opacity-70"
                }`}
              >
                <h2 className="text-xl font-semibold text-slate-900">{r.label}</h2>
                <p className="mt-2 flex-1 text-sm text-slate-600">{r.desc}</p>
                {allowed ? (
                  <Link
                    href={r.path}
                    className="mt-6 inline-flex justify-center rounded-xl bg-blue-500 px-4 py-3 text-center text-sm font-medium text-white hover:bg-blue-400"
                  >
                    Enter desk
                  </Link>
                ) : (
                  <p className="mt-6 rounded-xl bg-slate-100 px-4 py-3 text-center text-xs text-slate-600">
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
      </div>
    </main>
  );
}
