"use client";

import useSWR from "swr";
import { PROOF_VERIFIER_ABI } from "../../lib/abis";
import { RpcProvider } from "starknet";

const PROOF_VERIFIER_ADDRESS =
  process.env.NEXT_PUBLIC_PROOF_VERIFIER_ADDRESS || "0x0";
const RPC_URL =
  process.env.NEXT_PUBLIC_STARKNET_RPC_URL || "http://127.0.0.1:5050/rpc";

interface ProofEvent {
  proof_id: string;
  policy_id: string;
  tier: number;
  timestamp: number;
}

const fetcher = async (): Promise<ProofEvent[]> => {
  const provider = new RpcProvider({ nodeUrl: RPC_URL });

  try {
    // 0x192... is the keccak hash of 'ProofVerified'
    const PROOF_VERIFIED_KEY = "0x1927c9d9f1db7eb983b63b2ad912ef88062fa92dc0cc4dfdd6d22ef101ba0ce";

    // We fetch the last 100 blocks or from genesis, depending on the network.
    // In devnet, blocks might be few, so we query recent ones.
    const res = await provider.getEvents({
      from_block: { block_number: 0 },
      to_block: { tag: "latest" } as any,
      address: PROOF_VERIFIER_ADDRESS,
      keys: [[PROOF_VERIFIED_KEY]],
      chunk_size: 50,
    });

    const events: ProofEvent[] = [];

    // Map raw events to our ProofEvent interface
    for (const edge of res.events || []) {
      if (edge.data && edge.data.length >= 3) {
        // According to our ABI: data = [proof_id, policy_id, tier]
        const proof_id = "0x" + BigInt(edge.data[0]).toString(16);
        const policy_id = BigInt(edge.data[1]).toString();
        const tier = Number(edge.data[2]);

        let timestamp = Date.now() / 1000;

        // Try to get block timestamp if block_hash is available
        if (edge.block_hash) {
          try {
            const block = await provider.getBlock(edge.block_hash);
            timestamp = block.timestamp;
          } catch (e) {
            // Fallback to current time if block not found
          }
        }

        events.push({
          proof_id,
          policy_id,
          tier,
          timestamp,
        });
      }
    }

    // Sort descending by timestamp
    return events.sort((a, b) => b.timestamp - a.timestamp);
  } catch (err) {
    console.error("Error fetching ProofVerified events:", err);
    return [];
  }
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
            View on-chain ProofVerified events and compliance stats.
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
            <div className="text-slate-400 text-xs text-center py-4">
              No recent proof verification events found.
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
                  <tr key={ev.proof_id} className="border-t border-slate-800">
                    <td className="py-2">{new Date(ev.timestamp * 1000).toLocaleString()}</td>
                    <td className="py-2 font-mono">{ev.proof_id}</td>
                    <td className="py-2">{ev.policy_id}</td>
                    <td className="py-2">{ev.tier}</td>
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

