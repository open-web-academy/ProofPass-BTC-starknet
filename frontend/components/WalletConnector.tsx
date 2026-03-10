"use client";

import { useEffect, useState, useRef } from "react";
import { useAccount, useConnect, useDisconnect } from "@starknet-react/core";
import { ChevronDown, Power } from "lucide-react";

export function WalletConnector() {
  const { address, status } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!mounted) {
    return (
      <button className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-400 font-medium animate-pulse cursor-not-allowed border border-zinc-700">
        Loading...
      </button>
    );
  }

  const isConnected = status === "connected" && !!address;

  // Cleanup local storage when the user intentionally disconnects
  const handleDisconnect = () => {
    localStorage.removeItem("preferredWallet");
    localStorage.removeItem("lastWallet");
    localStorage.removeItem("starknet_lastConnectedWallet");
    disconnect();
    setIsOpen(false);
  };

  const fixedOrder = ["argentX", "braavos"];
  const sortedConnectors = [...connectors].sort((a, b) => {
    const idxA = fixedOrder.indexOf(a.id);
    const idxB = fixedOrder.indexOf(b.id);
    return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
  });

  return (
    <div className="relative" ref={dropdownRef}>
      {!isConnected ? (
        <>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium hover:opacity-90 transition shadow-lg"
          >
            Connect Wallet
            <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </button>

          {isOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-zinc-900 border border-zinc-700/50 rounded-xl shadow-2xl py-1 z-50 overflow-hidden transform opacity-100 scale-100 transition-all duration-200 origin-top-right">
              {sortedConnectors.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { connect({ connector: c }); setIsOpen(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
                >
                  Connect {c.name || c.id}
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-700 hover:border-indigo-500 text-zinc-200 font-medium transition shadow-lg"
          >
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></span>
              <span className="font-mono">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
            </span>
            <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </button>

          {isOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-zinc-900 border border-zinc-700/50 rounded-xl shadow-2xl py-1 z-50 overflow-hidden transform opacity-100 scale-100 transition-all duration-200 origin-top-right">
              <div className="px-4 py-2.5 text-xs text-zinc-500 uppercase tracking-wider font-semibold border-b border-zinc-800/50">
                Connected
              </div>
              <button
                onClick={handleDisconnect}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-rose-400 hover:bg-rose-500/10 transition-colors"
              >
                <Power className="w-4 h-4" />
                Disconnect Wallet
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

