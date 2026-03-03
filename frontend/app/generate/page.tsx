"use client";

import { useEffect, useState } from "react";
import { useAccount } from "@starknet-react/core";
import type { GeneratedProof, ValidityOption } from "../../lib/types";
import { useStoredProof } from "../../hooks/useStoredProof";
import Link from "next/link";

interface Policy {
  id: string;
  name: string;
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
    <main className="max-w-3xl mx-auto py-12 px-4 sm:px-6 min-h-screen">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-white mb-4">Generate Compliance Proof</h1>
        <p className="text-zinc-400 text-lg">
          Select a compliance policy and generate a simulated proof-of-clean-funds.
        </p>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:p-8 shadow-xl relative overflow-hidden">
        {/* Animated background accent */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-emerald-500 to-indigo-500"></div>

        <section className="space-y-6">
          {/* Policy Selector */}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Compliance Policy</label>
            <select
              value={selectedPolicy}
              onChange={(e) => setSelectedPolicy(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-xl px-4 py-3 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            >
              {policies.length === 0 && <option value="">Loading policies...</option>}
              {policies.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.id})
                </option>
              ))}
            </select>
          </div>

          {/* Validity Selector */}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Proof Validity</label>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <label className={`cursor-pointer py-3 px-4 rounded-xl border font-medium transition-all flex items-center gap-2 ${validity === "24h" ? "bg-indigo-600/20 border-indigo-500 text-indigo-400" : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700"}`}>
                <input
                  type="radio"
                  className="hidden"
                  checked={validity === "24h"}
                  onChange={() => setValidity("24h")}
                />
                24 hours
              </label>
              <label className={`cursor-pointer py-3 px-4 rounded-xl border font-medium transition-all flex items-center gap-2 ${validity === "7d" ? "bg-indigo-600/20 border-indigo-500 text-indigo-400" : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700"}`}>
                <input
                  type="radio"
                  className="hidden"
                  checked={validity === "7d"}
                  onChange={() => setValidity("7d")}
                />
                7 days
              </label>
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Amount (optional)</label>
            <input
              type="number"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 0.5"
              className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>

          {/* Error Message */}
          {error && <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm">{error}</div>}

          {/* Submit Button */}
          <button
            onClick={onGenerate}
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-medium py-3.5 px-6 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
          >
            {loading ? "Generating Proof..." : "Request Proof"}
          </button>
        </section>

        {/* Results Section */}
        {generated && (
          <div className="mt-8 pt-6 border-t border-zinc-800 space-y-4">
            <h2 className="text-xl font-semibold text-emerald-400 flex items-center gap-2">
              Proof Generated Successfully
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Proof ID</p>
                <p className="font-mono text-sm text-zinc-300 break-all">{generated.proof_id}</p>
              </div>
              <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Tier</p>
                <p className="font-medium text-indigo-400">{generated.tier}</p>
              </div>
              <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 md:col-span-2">
                <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Nullifier</p>
                <p className="font-mono text-xs text-zinc-400 break-all">{generated.nullifier}</p>
              </div>
            </div>

            <div className="pt-4 space-y-3">
              <button
                onClick={() => save(generated)}
                className="w-full bg-slate-700 hover:bg-slate-600 text-white py-3 px-6 rounded-xl transition-colors font-medium"
              >
                Save Locally for dApp
              </button>
              <p className="text-xs text-center text-zinc-500">
                Then go to <Link href="/deposit" className="text-indigo-400 hover:underline">/deposit</Link> to verify and deposit with this proof.
              </p>
            </div>
          </div>
        )}

        {/* Last Stored Proof */}
        {proof && !generated && (
          <div className="mt-8 p-4 bg-zinc-950/50 border border-zinc-800 rounded-xl space-y-2">
            <h3 className="font-semibold text-sm text-zinc-300">Last Stored Proof</h3>
            <div className="text-xs text-zinc-500 space-y-1">
              <p>Proof ID: <span className="text-zinc-400 font-mono">{proof.proof_id}</span></p>
              <p>Policy ID: <span className="text-zinc-400">{proof.policy_id}</span></p>
              <p>Tier: <span className="text-zinc-400">{proof.tier}</span></p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

