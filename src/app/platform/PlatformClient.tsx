"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { UserType } from "@prisma/client";

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

export default function PlatformClient() {
  const { data: session } = useSession();
  const selfType = session?.user?.type;
  const isSuper = Boolean((session?.user as any)?.isSuper);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="mx-auto max-w-4xl px-6 py-16">
        <header className="mb-12 text-center">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
            Millennium
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">
            Equity Order Ticket System
          </h1>
          <p className="mt-4 text-slate-300">
            Shared live data — role-specific desks. Signed in as{" "}
            <strong>{session?.user?.name}</strong> ({session?.user?.email})
          </p>
          <button
            type="button"
            onClick={() => signOut({ redirectTo: "/signIn" })}
            className="mt-6 rounded-lg border border-slate-500 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
          >
            Sign out
          </button>
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
