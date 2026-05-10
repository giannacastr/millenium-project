"use client";

import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/signIn");
    }
  }, [status, router]);

  if (status === "loading") {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!session?.user) {
    return null;
  }

  const user = session.user as any;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
            <button
              onClick={() => signOut({ redirectTo: "/signIn" })}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
            >
              Sign Out
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-slate-50 p-6 rounded-lg">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Account Information</h2>
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm font-medium text-slate-600">Email</dt>
                  <dd className="text-slate-900">{user.email}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-slate-600">Name</dt>
                  <dd className="text-slate-900">{user.name || "N/A"}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-slate-600">User ID</dt>
                  <dd className="text-slate-900 text-sm font-mono">{user.id}</dd>
                </div>
              </dl>
            </div>

            <div className="bg-slate-50 p-6 rounded-lg">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Status</h2>
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm font-medium text-slate-600">Type</dt>
                  <dd className="text-slate-900 capitalize">{user.type}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-slate-600">Enabled</dt>
                  <dd className="text-slate-900">
                    <span className={`px-2 py-1 rounded text-sm font-medium ${user.enabled ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                      {user.enabled ? "Yes" : "No"}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-slate-600">Pending</dt>
                  <dd className="text-slate-900">
                    <span className={`px-2 py-1 rounded text-sm font-medium ${user.pending ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"}`}>
                      {user.pending ? "Yes" : "No"}
                    </span>
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900">
              <strong>Session Debug:</strong> Open your browser DevTools Console to see the full session object
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
