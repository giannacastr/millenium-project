"use client";

import { signOut } from "next-auth/react";

export default function DeactivatedPage() {
  return (
    <main className="w-screen h-screen flex flex-col justify-center items-center bg-gray-100">
      <div className="bg-white py-8 px-8 rounded-xl max-w-md">
        <h1 className="mb-2 text-2xl font-semibold text-center text-red-600">Account Deactivated</h1>
        <p className="text-gray-600 text-center mb-6">
          Your account has been deactivated. Please contact an administrator for assistance.
        </p>
        
        <button
          onClick={() => signOut({ redirect: true, callbackUrl: "/platform" })}
          className="w-full bg-blue-600 text-white font-light py-2 rounded hover:bg-blue-700"
        >
          Sign Out
        </button>
      </div>
    </main>
  );
}
