import Link from "next/link";
import { ShieldCheck, ArrowRight, Zap, Lock } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 sm:px-6 lg:px-8">

      {/* Hero Section */}
      <div className="text-center max-w-3xl mx-auto mb-16 mt-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-medium mb-8">
          <ShieldCheck className="w-4 h-4" />
          <span>Proof of Clean Funds Demo</span>
        </div>

        <h1 className="text-5xl sm:text-6xl font-extrabold text-white tracking-tight mb-8 leading-tight">
          Compliance Gated <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-400">
            DeFi Deposits
          </span>
        </h1>

        <p className="text-xl text-zinc-400 leading-relaxed max-w-2xl mx-auto mb-10">
          A seamless flow demonstrating how users can generate zero-knowledge proofs of compliance off-chain and use them to gate smart contract interactions on Starknet.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/generate" className="w-full sm:w-auto px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 group">
            Start Demo Flow
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <a href="https://github.com/CloudMex/skarnet" target="_blank" rel="noreferrer" className="w-full sm:w-auto px-8 py-3.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl font-medium transition-all border border-zinc-800 flex items-center justify-center">
            View Source
          </a>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto w-full mt-10">
        <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-6 hover:bg-zinc-900 transition-colors">
          <div className="bg-emerald-500/10 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-emerald-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">1. Generate Proof</h3>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Select a compliance policy. The demo API (simulating an off-chain verifier) generates a cryptographic proof indicating your wallet meets the criteria.
          </p>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-6 hover:bg-zinc-900 transition-colors">
          <div className="bg-blue-500/10 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
            <Zap className="w-6 h-6 text-blue-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">2. Verify & Deposit</h3>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Submit the proof along with your transaction. The Starknet smart contract verifies the proof before allowing the token deposit.
          </p>
        </div>
      </div>

    </div>
  );
}

