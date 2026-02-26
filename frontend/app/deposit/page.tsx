"use client";

import { useState } from "react";
import { useAccount, useContract, useSendTransaction } from "@starknet-react/core";
import { GATE_ADAPTER_ABI } from "../../lib/abis";
import { useStoredProof } from "../../hooks/useStoredProof";

const GATE_ADAPTER_ADDRESS =
  process.env.NEXT_PUBLIC_GATE_ADAPTER_ADDRESS || "0x0";

export default function DepositPage() {
  const { address } = useAccount();
  const { proof } = useStoredProof();

  const [manualProofId, setManualProofId] = useState<string>(proof?.proof_id ?? "");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { contract } = useContract({
    abi: GATE_ADAPTER_ABI as any,
    address: GATE_ADAPTER_ADDRESS,
  });

  const { sendAsync } = useSendTransaction();

  const onDeposit = async () => {
    if (!address) {
      setError("Connect your Starknet wallet first.");
      return;
    }
    if (!proof) {
      setError("No proof in local storage. Generate one first.");
      return;
    }

    setLoading(true);
    setError(null);
    setStatusMessage("Preparing transaction...");

    try {
      const amountStr = proof.amount ?? "1";
      const amount = BigInt(Math.floor(parseFloat(amountStr) * 1e6) || 1n);
      const amountLow = amount & ((1n << 128n) - 1n);
      const amountHigh = amount >> 128n;

      const calls =
        contract && (contract as any).populate
          ? [
              (contract as any).populate("deposit", [
                BigInt(proof.policy_id),
                BigInt(proof.proof_id),
                0x1n, // proof_blob_ptr (special stub value)
                BigInt(proof.tier), // public_inputs_ptr -> tier
                BigInt(proof.nullifier),
                BigInt(proof.expiry_ts),
                { low: amountLow, high: amountHigh },
              ]),
            ]
          : undefined;

      if (!calls) {
        throw new Error("Contract not ready");
      }

      setStatusMessage("Sending transaction to Starknet...");

      const tx = await sendAsync({ calls });

      setStatusMessage(`Transaction sent: ${tx.transaction_hash}`);
    } catch (e: any) {
      console.error(e);
      setError(e.message ?? "Failed to send transaction");
      setStatusMessage(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen px-4 py-8 flex flex-col items-center">
      <div className="w-full max-w-xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold">Verify &amp; Deposit</h1>
          <p className="text-sm text-slate-300">
            Use your locally stored proof-of-clean-funds to deposit strkBTC via the GateAdapter.
          </p>
        </header>

        <section className="space-y-3 bg-slate-900/60 border border-slate-800 rounded p-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-200">Proof ID</span>
            <input
              type="text"
              value={manualProofId}
              onChange={(e) => setManualProofId(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded px-2 py-1"
              placeholder="Auto-populated from /generate"
            />
          </label>

          {proof && (
            <div className="text-xs text-slate-300 space-y-1">
              <div>Policy: {proof.policy_id}</div>
              <div>Tier: {proof.tier}</div>
              <div>Expiry: {proof.expiry_ts}</div>
              <div>Nullifier: {proof.nullifier}</div>
            </div>
          )}

          {error && <div className="text-sm text-rose-400">{error}</div>}
          {statusMessage && (
            <div className="text-sm text-emerald-400 break-all">
              {statusMessage}
            </div>
          )}

          <button
            onClick={onDeposit}
            disabled={loading}
            className="mt-2 px-4 py-2 rounded bg-sky-600 hover:bg-sky-500 text-sm"
          >
            {loading ? "Verifying & Depositing..." : "Verify & Deposit"}
          </button>
        </section>
      </div>
    </main>
  );
}

