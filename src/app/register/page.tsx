"use client";

import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { signIn } from "next-auth/react";

function RegisterPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  
  const [loading, setLoading] = useState(false);
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [passwordMatch, setPasswordMatch] = useState(true);

  useEffect(() => {
    if (!token) {
      router.replace("/");
      return;
    }

    const validateToken = async () => {
      try {
        const res = await fetch(`/api/invites?token=${token}`);
        if (!res.ok) {
          throw new Error("Invalid or expired invite link");
        }
        const data = await res.json();
        setEmail(data.email);
      } catch (e) {
        setError((e as Error).message);
        setTimeout(() => router.replace("/"), 2000);
      } finally {
        setLoadingInvite(false);
      }
    };

    validateToken();
  }, [token, router]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const password = formData.get("password")?.toString() || "";
    const confirm = formData.get("confirm")?.toString() || "";

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
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (loadingInvite) {
    return (
      <main className="w-screen h-screen flex flex-col justify-center items-center">
        <div className="bg-white py-6 px-6 rounded-xl w-96">
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="ml-3 text-gray-600">Loading...</p>
          </div>
        </div>
      </main>
    );
  }

  if (error && !email) {
    return (
      <main className="w-screen h-screen flex flex-col justify-center items-center">
        <div className="bg-white py-6 px-6 rounded-xl w-96">
          <div className="flex flex-col justify-center items-center">
            <p className="text-red-600 text-center mb-4">{error}</p>
            <p className="text-gray-500 text-sm">Redirecting...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="w-screen h-screen flex flex-col justify-center items-center">
      <div className="bg-white py-6 px-6 rounded-xl w-96 sm:w-[580px]">
        <div>
          <h1 className="mb-1 text-xl font-semibold">Create Account</h1>
          <p className="mb-4 text-sm font-light text-gray-500">
            Welcome! Please set your password to activate your account.
          </p>
          
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="block text-gray-800 text-sm mb-2 font-light">
                Email
              </label>
              <input
                type="email"
                value={email || ""}
                disabled
                className="bg-gray-100 w-full py-2 px-3 text-gray-700 rounded"
              />
            </div>

            <div className="mb-3">
              <label className="block text-gray-800 text-sm mb-2 font-light">
                Password
              </label>
              <input
                name="password"
                type="password"
                placeholder="••••••"
                required
                disabled={loading}
                className="bg-zinc-50 border border-gray-200 rounded w-full py-2 px-3"
              />
            </div>

            <div className="mb-3">
              <label className="block text-gray-800 text-sm mb-2 font-light">
                Confirm Password
              </label>
              <input
                name="confirm"
                type="password"
                placeholder="••••••"
                required
                disabled={loading}
                className={`bg-zinc-50 border rounded w-full py-2 px-3 ${
                  !passwordMatch ? "border-red-500" : "border-gray-200"
                }`}
              />
              {!passwordMatch && (
                <p className="text-red-600 text-sm mt-1">Passwords do not match</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white font-light py-2 rounded hover:bg-blue-700 disabled:bg-blue-400"
            >
              {loading ? "Creating..." : "Create Account"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <main className="w-screen h-screen flex flex-col justify-center items-center">
          <div className="bg-white py-6 px-6 rounded-xl w-96">
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="ml-3 text-gray-600">Loading...</p>
            </div>
          </div>
        </main>
      }
    >
      <RegisterPageInner />
    </Suspense>
  );
}
