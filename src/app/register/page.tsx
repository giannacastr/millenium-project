"use client";

import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, Suspense } from "react";
import { signIn } from "next-auth/react";
import { UserType } from "@prisma/client";

const ROLE_LABELS: Record<UserType, string> = {
  [UserType.EQUITY_TRADER]: "Equity Trader",
  [UserType.RISK_OFFICER]: "Risk Officer",
  [UserType.PRIME_BROKER]: "Prime Broker",
};

function RegisterPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const inviteMode = Boolean(token);

  const [loading, setLoading] = useState(false);
  const [loadingInvite, setLoadingInvite] = useState(inviteMode);
  const [email, setEmail] = useState<string | null>(inviteMode ? null : "");
  const [inviteRole, setInviteRole] = useState<UserType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [passwordMatch, setPasswordMatch] = useState(true);

  const [openForm, setOpenForm] = useState({
    email: "",
    name: "",
    password: "",
    confirm: "",
    userType: UserType.EQUITY_TRADER as UserType,
  });

  useEffect(() => {
    if (!inviteMode || !token) return;

    const validateToken = async () => {
      try {
        const res = await fetch(`/api/invites?token=${token}`);
        if (!res.ok) {
          throw new Error("Invalid or expired invite link");
        }
        const data = await res.json();
        setEmail(data.email);
        if (data.userType) {
          setInviteRole(data.userType as UserType);
        }
      } catch (e) {
        setError((e as Error).message);
        setTimeout(() => router.replace("/platform"), 2000);
      } finally {
        setLoadingInvite(false);
      }
    };

    validateToken();
  }, [inviteMode, token, router]);

  const handleInviteSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const password = formData.get("password")?.toString() || "";
    const confirm = formData.get("confirm")?.toString() || "";
    const name = formData.get("name")?.toString()?.trim() || "";

    if (!name) {
      setError("Please enter your name");
      setLoading(false);
      return;
    }

    if (password !== confirm) {
      setPasswordMatch(false);
      setLoading(false);
      return;
    }

    setPasswordMatch(true);

    try {
      const registerFormData = new FormData();
      registerFormData.append("inviteToken", token || "");
      registerFormData.append("password", password);
      registerFormData.append("name", name);

      const res = await fetch("/api/users", {
        method: "POST",
        body: registerFormData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to register");
      }

      const signInResult = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (signInResult?.error) {
        setError(signInResult.error);
        return;
      }

      router.push("/");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (openForm.password !== openForm.confirm) {
      setPasswordMatch(false);
      return;
    }
    setPasswordMatch(true);
    setLoading(true);

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: openForm.email.trim().toLowerCase(),
          name: openForm.name.trim(),
          password: openForm.password,
          userType: openForm.userType,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Registration failed");
      }

      const signInResult = await signIn("credentials", {
        email: openForm.email.trim().toLowerCase(),
        password: openForm.password,
        redirect: false,
      });

      if (signInResult?.error) {
        setError(signInResult.error);
        return;
      }

      router.push("/");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (inviteMode && loadingInvite) {
    return (
      <main className="flex h-screen w-screen flex-col items-center justify-center">
        <div className="w-96 rounded-xl bg-white px-6 py-6">
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
            <p className="ml-3 text-gray-600">Loading invite…</p>
          </div>
        </div>
      </main>
    );
  }

  if (inviteMode && error && !email) {
    return (
      <main className="flex h-screen w-screen flex-col items-center justify-center">
        <div className="w-96 rounded-xl bg-white px-6 py-6">
          <p className="mb-4 text-center text-red-600">{error}</p>
          <p className="text-center text-sm text-gray-500">Redirecting…</p>
        </div>
      </main>
    );
  }

  if (inviteMode && email) {
    return (
      <main className="flex min-h-screen w-screen flex-col items-center justify-center px-4">
        <div className="w-full max-w-[580px] rounded-xl bg-white px-6 py-6 shadow-lg">
          <h1 className="mb-1 text-xl font-semibold">Create account</h1>
          <p className="mb-4 text-sm font-light text-gray-500">
            You were invited to Millennium. Set your name and password.
          </p>
          {inviteRole && (
            <p className="mb-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <span className="font-medium">Assigned role:</span>{" "}
              {ROLE_LABELS[inviteRole]}
            </p>
          )}

          {error && (
            <div className="mb-4 rounded border border-red-400 bg-red-100 p-3 text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleInviteSubmit}>
            <label className="mb-3 block text-sm">
              <span className="mb-2 block font-light text-gray-800">Email</span>
              <input
                type="email"
                value={email}
                disabled
                className="w-full rounded bg-gray-100 px-3 py-2 text-gray-700"
              />
            </label>
            <label className="mb-3 block text-sm">
              <span className="mb-2 block font-light text-gray-800">Full name</span>
              <input
                name="name"
                type="text"
                required
                placeholder="Your name"
                disabled={loading}
                className="w-full rounded border border-gray-200 bg-zinc-50 px-3 py-2"
              />
            </label>
            <label className="mb-3 block text-sm">
              <span className="mb-2 block font-light text-gray-800">Password</span>
              <input
                name="password"
                type="password"
                required
                disabled={loading}
                className="w-full rounded border border-gray-200 bg-zinc-50 px-3 py-2"
              />
            </label>
            <label className="mb-3 block text-sm">
              <span className="mb-2 block font-light text-gray-800">
                Confirm password
              </span>
              <input
                name="confirm"
                type="password"
                required
                disabled={loading}
                className={`w-full rounded border bg-zinc-50 px-3 py-2 ${
                  !passwordMatch ? "border-red-500" : "border-gray-200"
                }`}
              />
              {!passwordMatch && (
                <p className="mt-1 text-sm text-red-600">Passwords do not match</p>
              )}
            </label>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded bg-blue-600 py-2 font-light text-white hover:bg-blue-700 disabled:bg-blue-400"
            >
              {loading ? "Creating…" : "Create account"}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{" "}
            <Link href="/platform" className="text-blue-600 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </main>
    );
  }

  /* Open registration — choose desk role */
  return (
    <main className="flex min-h-screen w-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-[580px] rounded-xl bg-white px-6 py-6 shadow-lg">
        <h1 className="mb-1 text-xl font-semibold">Create account</h1>
        <p className="mb-4 text-sm font-light text-gray-500">
          Choose your desk role, then sign in to the matching workspace.
        </p>

        {error && (
          <div className="mb-4 rounded border border-red-400 bg-red-100 p-3 text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleOpenSubmit}>
          <label className="mb-3 block text-sm">
            <span className="mb-2 block font-light text-gray-800">Full name</span>
            <input
              value={openForm.name}
              onChange={(e) =>
                setOpenForm((f) => ({ ...f, name: e.target.value }))
              }
              type="text"
              required
              disabled={loading}
              className="w-full rounded border border-gray-200 bg-zinc-50 px-3 py-2"
            />
          </label>
          <label className="mb-3 block text-sm">
            <span className="mb-2 block font-light text-gray-800">Email</span>
            <input
              value={openForm.email}
              onChange={(e) =>
                setOpenForm((f) => ({ ...f, email: e.target.value }))
              }
              type="email"
              required
              disabled={loading}
              className="w-full rounded border border-gray-200 bg-zinc-50 px-3 py-2"
            />
          </label>
          <label className="mb-3 block text-sm">
            <span className="mb-2 block font-light text-gray-800">Desk role</span>
            <select
              value={openForm.userType}
              onChange={(e) =>
                setOpenForm((f) => ({
                  ...f,
                  userType: e.target.value as UserType,
                }))
              }
              disabled={loading}
              className="w-full rounded border border-gray-200 bg-zinc-50 px-3 py-2"
            >
              {(
                [
                  UserType.EQUITY_TRADER,
                  UserType.RISK_OFFICER,
                  UserType.PRIME_BROKER,
                ] as const
              ).map((ut) => (
                <option key={ut} value={ut}>
                  {ROLE_LABELS[ut]}
                </option>
              ))}
            </select>
          </label>
          <label className="mb-3 block text-sm">
            <span className="mb-2 block font-light text-gray-800">Password</span>
            <input
              value={openForm.password}
              onChange={(e) =>
                setOpenForm((f) => ({ ...f, password: e.target.value }))
              }
              type="password"
              required
              minLength={6}
              disabled={loading}
              className="w-full rounded border border-gray-200 bg-zinc-50 px-3 py-2"
            />
          </label>
          <label className="mb-3 block text-sm">
            <span className="mb-2 block font-light text-gray-800">
              Confirm password
            </span>
            <input
              value={openForm.confirm}
              onChange={(e) =>
                setOpenForm((f) => ({ ...f, confirm: e.target.value }))
              }
              type="password"
              required
              disabled={loading}
              className={`w-full rounded border bg-zinc-50 px-3 py-2 ${
                !passwordMatch ? "border-red-500" : "border-gray-200"
              }`}
            />
            {!passwordMatch && (
              <p className="mt-1 text-sm text-red-600">Passwords do not match</p>
            )}
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-blue-600 py-2 font-light text-white hover:bg-blue-700 disabled:bg-blue-400"
          >
            {loading ? "Creating…" : "Create account"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-gray-400">
          Have an invite link? Open it or append{" "}
          <code className="rounded bg-gray-100 px-1">?token=…</code> to this page.
        </p>
        <p className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{" "}
           <Link href="/platform" className="text-blue-600 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <main className="flex h-screen w-screen flex-col items-center justify-center">
          <div className="w-96 rounded-xl bg-white px-6 py-6">
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
              <p className="ml-3 text-gray-600">Loading…</p>
            </div>
          </div>
        </main>
      }
    >
      <RegisterPageInner />
    </Suspense>
  );
}
