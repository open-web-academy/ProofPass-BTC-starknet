"use client";

import { useState } from "react";
import { useAccount, useContract, useSendTransaction, useReadContract, useProvider } from "@starknet-react/core";
import { GATE_ADAPTER_ABI } from "../../lib/abis";
import { useStoredProof } from "../../hooks/useStoredProof";

const GATE_ADAPTER_ADDRESS =
  (process.env.NEXT_PUBLIC_GATE_ADAPTER_ADDRESS || "0x0") as `0x${string}`;

export default function DepositPage() {
  const { address } = useAccount();
  const { provider } = useProvider();
  const { proof } = useStoredProof();

  const [manualProofId, setManualProofId] = useState<string>(proof?.proof_id ?? "");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { contract } = useContract({
    abi: GATE_ADAPTER_ABI as any,
    address: GATE_ADAPTER_ADDRESS,
  });

  const { data: balanceData } = useReadContract({
    functionName: "get_balance",
    args: address ? [address] : [],
    abi: GATE_ADAPTER_ABI as any,
    address: GATE_ADAPTER_ADDRESS,
    watch: true,
  });

  const formatBalance = (bal: any) => {
    if (bal == null) return "0";
    if (typeof bal === "bigint" || typeof bal === "number" || typeof bal === "string") return bal.toString();
    if (bal.low !== undefined) return bal.low.toString();
    return "0";
  };
  const displayBalance = formatBalance(balanceData ? (balanceData as any).balance : null);

  const { sendAsync, data: txHash } = useSendTransaction({ calls: [] });

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
      setStatusMessage("Checking network for required contracts...");
      try {
        await provider.getClassHashAt(process.env.NEXT_PUBLIC_STRKBTC_ADDRESS || "0x0");
      } catch (err) {
        throw new Error("strkBTC contract is not deployed on the active network. Please connect to the correct network (e.g. Sepolia) and update your .env.local variables.");
      }
      try {
        await provider.getClassHashAt(GATE_ADAPTER_ADDRESS);
      } catch (err) {
        throw new Error("GateAdapter contract is not deployed on the active network. Please connect to the correct network (e.g. Sepolia) and update your .env.local variables.");
      }

      setStatusMessage("Preparing transaction...");

      const amountStr = proof.amount ?? "1";
      const amount = BigInt(Math.floor(parseFloat(amountStr) * 1e6) || 1n);
      const amountLow = amount & ((1n << 128n) - 1n);
      const amountHigh = amount >> 128n;

      const approveCall = {
        contractAddress: process.env.NEXT_PUBLIC_STRKBTC_ADDRESS || "0x0",
        entrypoint: "approve",
        calldata: [
          GATE_ADAPTER_ADDRESS,
          amountLow.toString(),
          amountHigh.toString(),
        ],
      };

      const depositCall = {
        contractAddress: GATE_ADAPTER_ADDRESS,
        entrypoint: "deposit",
        calldata: [
          proof.proof_id,
          proof.policy_id,
          proof.tier.toString(),
          proof.public_inputs[1], // sig_r
          proof.public_inputs[2], // sig_s
          proof.nullifier,
          proof.expiry_ts.toString(),
          amountLow.toString(),
          amountHigh.toString()
        ],
      };

      const calls = [approveCall, depositCall];

      console.log("=== DEBUG DEPOSIT TRANSACTION ===");
      console.log("1. strkBTC Address from config:", approveCall.contractAddress);
      console.log("2. GateAdapter Address from config:", GATE_ADAPTER_ADDRESS);
      console.log("3. Proof object passed to deposit:", proof);
      console.log("4. Final multicall payload:", JSON.stringify(calls, null, 2));
      console.log("=================================");

      setStatusMessage("Sending transaction to Starknet...");

      const tx = await sendAsync(calls);

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

        {address && (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 flex justify-between items-center">
            <span className="text-slate-400 text-sm">Your strkBTC Deposit Balance</span>
            <span className="text-lg font-mono text-emerald-400">{displayBalance}</span>
          </div>
        )}

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

