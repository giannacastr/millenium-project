"use client";

import { signOut } from "next-auth/react";

export default function PendingPage() {
  return (
    <main className="w-screen h-screen flex flex-col justify-center items-center bg-gray-100">
      <div className="bg-white py-8 px-8 rounded-xl max-w-md">
        <h1 className="mb-2 text-2xl font-semibold text-center">Account Pending</h1>
        <p className="text-gray-600 text-center mb-6">
          Your account has been created but is pending activation by an administrator.
        </p>
        <p className="text-gray-500 text-sm text-center mb-6">
          You will be notified via email once your account has been activated.
        </p>
        
        <button
          onClick={() => signOut({ redirect: true, callbackUrl: "/signIn" })}
          className="w-full bg-blue-600 text-white font-light py-2 rounded hover:bg-blue-700"
        >
          Sign Out
        </button>
      </div>
    </main>
  );
}
