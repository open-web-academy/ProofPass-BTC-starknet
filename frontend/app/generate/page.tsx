"use client";

import { useEffect, useState } from "react";
import { useAccount } from "@starknet-react/core";
import type { GeneratedProof, ValidityOption } from "../../lib/types";
import { useStoredProof } from "../../hooks/useStoredProof";
import Link from "next/link";

interface Policy {
  id: string;
  commitment: string;
}

export default function GeneratePage() {
  const { address } = useAccount();
  const { proof, save } = useStoredProof();

  const [policies, setPolicies] = useState<Policy[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState<string>("");
  const [validity, setValidity] = useState<ValidityOption>("24h");
  const [amount, setAmount] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<GeneratedProof | null>(null);

  useEffect(() => {
    const loadPolicies = async () => {
      try {
        const res = await fetch("/api/policies");
        const data = await res.json();
        setPolicies(data.policies ?? []);
        if (data.policies?.length && !selectedPolicy) {
          setSelectedPolicy(data.policies[0].id);
        }
      } catch (e) {
        console.error(e);
      }
    };
    loadPolicies();
  }, [selectedPolicy]);

  const onGenerate = async () => {
    if (!address) {
      setError("Connect your Starknet wallet first.");
      return;
    }
    if (!selectedPolicy) {
      setError("Select a policy.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: address,
          policy_id: selectedPolicy,
          validity,
          amount,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to generate proof");
      }
      const data: GeneratedProof = await res.json();
      setGenerated(data);
      save(data);
    } catch (e: any) {
      console.error(e);
      setError(e.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen px-4 py-8 flex flex-col items-center">
      <div className="w-full max-w-xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold">Generate Proof</h1>
          <p className="text-sm text-slate-300">
            Select a compliance policy and generate a simulated proof-of-clean-funds.
          </p>
        </header>

        <section className="space-y-3 bg-slate-900/60 border border-slate-800 rounded p-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-200">Policy</span>
            <select
              value={selectedPolicy}
              onChange={(e) => setSelectedPolicy(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded px-2 py-1"
            >
              {policies.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} ({p.commitment.slice(0, 8)}...)
                </option>
              ))}
            </select>
          </label>

          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={validity === "24h"}
                onChange={() => setValidity("24h")}
              />
              24 hours
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={validity === "7d"}
                onChange={() => setValidity("7d")}
              />
              7 days
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-200">Amount (optional)</span>
            <input
              type="number"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 0.5"
              className="bg-slate-950 border border-slate-700 rounded px-2 py-1"
            />
          </label>

          {error && <div className="text-sm text-rose-400">{error}</div>}

          <button
            onClick={onGenerate}
            disabled={loading}
            className="mt-2 px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-sm"
          >
            {loading ? "Generating..." : "Generate Proof"}
          </button>
        </section>

        {generated && (
          <section className="space-y-2 bg-slate-900/60 border border-slate-800 rounded p-4 text-sm">
            <h2 className="font-semibold text-slate-100">Generated Proof</h2>
            <div>Proof ID: {generated.proof_id}</div>
            <div>Policy ID: {generated.policy_id}</div>
            <div>Tier: {generated.tier}</div>
            <div>Expiry (unix): {generated.expiry_ts}</div>
            <div>Nullifier: {generated.nullifier}</div>
            <div>Amount: {generated.amount ?? "-"}</div>
            <button
              onClick={() => save(generated)}
              className="mt-2 px-3 py-1 rounded bg-sky-600 hover:bg-sky-500"
            >
              Use in dApp (save locally)
            </button>
            <div className="text-xs text-slate-400">
              Then go to{" "}
              <Link href="/deposit" className="underline">
                /deposit
              </Link>{" "}
              to verify and deposit with this proof.
            </div>
          </section>
        )}

        {proof && !generated && (
          <section className="space-y-2 bg-slate-900/40 border border-slate-800 rounded p-4 text-xs text-slate-300">
            <div className="font-semibold text-slate-100">Last stored proof</div>
            <div>Proof ID: {proof.proof_id}</div>
            <div>Policy ID: {proof.policy_id}</div>
            <div>Tier: {proof.tier}</div>
            <div>Expiry: {proof.expiry_ts}</div>
          </section>
        )}
      </div>
    </main>
  );
}

