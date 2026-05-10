"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const INVALID_CREDENTIALS_ERR = "INVALID_CREDENTIALS";

export default function SignInPage() {
  const router = useRouter();
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

      router.push("/");
    } catch (e) {
      setError("Unknown error occurred");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main 
      className="w-screen h-screen flex flex-col justify-center items-center"
      style={{
        background: 'linear-gradient(to top right, #4AA6EB, #F0424E)'
      }}
    >
      <div className="bg-white py-6 px-6 rounded-xl">
        <div className="flex flex-col justify-center items-center">
          <h1 className="mb-1 text-xl font-semibold">Millennium Project</h1>
          <h2 className="mb-4 text-gray-800 opacity-70 font-light text-sm">
            Please enter your credentials.
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="w-64 sm:w-80">
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label
              className="block text-gray-800 text-sm mb-2 font-light"
              htmlFor="email"
            >
              Email
            </label>
            <input
              className="bg-zinc-50 appearance-none border border-gray-200 rounded w-full py-2 px-3 text-gray-700 leading-tight font-light text-sm"
              id="email"
              name="email"
              type="email"
              placeholder="your@email.com"
              required
              disabled={loading}
            />
          </div>

          <div className="mb-4">
            <label
              className="block text-gray-800 text-sm mb-2 font-light"
              htmlFor="password"
            >
              Password
            </label>
            <input
              className="bg-zinc-50 appearance-none border border-gray-200 rounded w-full py-2 px-3 text-gray-700 leading-tight font-light text-sm"
              id="password"
              name="password"
              type="password"
              placeholder="••••••"
              required
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white font-light py-2 rounded hover:bg-blue-700 disabled:bg-blue-400"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </main>
  );
}
