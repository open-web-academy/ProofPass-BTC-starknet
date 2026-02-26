"use client";

import useSWR from "swr";
import { PROOF_VERIFIER_ABI } from "../../lib/abis";
import { RpcProvider } from "starknet";

const PROOF_VERIFIER_ADDRESS =
  process.env.NEXT_PUBLIC_PROOF_VERIFIER_ADDRESS || "0x0";
const RPC_URL =
  process.env.NEXT_PUBLIC_STARKNET_RPC_URL || "http://127.0.0.1:5050";

interface ProofEvent {
  proof_id: string;
  policy_id: string;
  tier: number;
  timestamp: number;
}

const fetcher = async (): Promise<ProofEvent[]> => {
  const provider = new RpcProvider({ nodeUrl: RPC_URL });
  // This is a simplified example: in a real app, use getEvents with the ABI's event selector.
  // Here we just return an empty list as a placeholder to keep the demo focused.
  void provider;
  void PROOF_VERIFIER_ABI;
  return [];
};

export default function DashboardPage() {
  const { data } = useSWR("proof-events", fetcher, { fallbackData: [] });

  const events = data ?? [];
  const verifiedCount = events.length;
  const blockedCount = 0; // simulated

  return (
    <main className="min-h-screen px-4 py-8 flex flex-col items-center">
      <div className="w-full max-w-3xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold">Compliance Dashboard</h1>
          <p className="text-sm text-slate-300">
            View on-chain ProofVerified events and simple compliance stats.
            For this minimal demo, stats are simulated and event loading is a placeholder.
          </p>
        </header>

        <section className="grid grid-cols-2 gap-4">
          <div className="bg-slate-900/70 border border-slate-800 rounded p-4">
            <div className="text-xs text-slate-400">Verified proofs</div>
            <div className="text-2xl font-semibold text-emerald-400">
              {verifiedCount}
            </div>
          </div>
          <div className="bg-slate-900/70 border border-slate-800 rounded p-4">
            <div className="text-xs text-slate-400">Blocked attempts (simulated)</div>
            <div className="text-2xl font-semibold text-rose-400">
              {blockedCount}
            </div>
          </div>
        </section>

        <section className="bg-slate-900/60 border border-slate-800 rounded p-4 text-sm">
          <div className="font-semibold mb-3">Recent ProofVerified events</div>
          {events.length === 0 ? (
            <div className="text-slate-400 text-xs">
              Events fetching is stubbed in this minimal demo. In a real setup,
              this table would be populated from ProofVerifier events via
              Starknet RPC.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-slate-400">
                <tr>
                  <th className="text-left">Time</th>
                  <th className="text-left">Proof ID</th>
                  <th className="text-left">Policy</th>
                  <th className="text-left">Tier</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <tr key={ev.proof_id}>
                    <td>{new Date(ev.timestamp * 1000).toLocaleString()}</td>
                    <td>{ev.proof_id}</td>
                    <td>{ev.policy_id}</td>
                    <td>{ev.tier}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </main>
  );
}

