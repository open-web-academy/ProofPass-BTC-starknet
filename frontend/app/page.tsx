"use client";

import Link from "next/link";
import { WalletConnector } from "../components/WalletConnector";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 px-4">
      <div className="text-center space-y-3">
        <h1 className="text-3xl md:text-4xl font-semibold">
          Proof-of-Clean-Funds using <span className="text-sky-400">strkBTC</span>
        </h1>
        <p className="text-slate-300 max-w-xl mx-auto">
          Minimal demo dApp for a Proof-of-Clean-Funds flow on Starknet:
          generate a proof off-chain, verify on-chain, and deposit strkBTC via a
          compliant gate adapter.
        </p>
      </div>

      <WalletConnector />

      <div className="flex flex-wrap justify-center gap-4 mt-6">
        <Link
          href="/generate"
          className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500"
        >
          Generate Proof
        </Link>
        <Link
          href="/deposit"
          className="px-4 py-2 rounded bg-sky-600 hover:bg-sky-500"
        >
          Deposit with Proof
        </Link>
        <Link
          href="/dashboard"
          className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600"
        >
          Compliance Dashboard
        </Link>
      </div>
    </main>
  );
}

