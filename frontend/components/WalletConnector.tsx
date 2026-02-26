"use client";

import { useAccount, useConnect, useDisconnect } from "@starknet-react/core";

export function WalletConnector() {
  const { address, status } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  const isConnected = status === "connected" && !!address;

  return (
    <div className="flex flex-col gap-2">
      <div className="text-sm text-slate-300">
        {isConnected ? (
          <>
            Connected as{" "}
            <span className="font-mono text-sky-300">
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </span>
          </>
        ) : (
          "Not connected"
        )}
      </div>
      <div className="flex gap-2">
        {!isConnected ? (
          connectors.map((c) => (
            <button
              key={c.id}
              onClick={() => connect({ connector: c })}
              className="px-3 py-1 rounded bg-sky-600 hover:bg-sky-500 text-sm"
            >
              Connect {c.id}
            </button>
          ))
        ) : (
          <button
            onClick={() => disconnect()}
            className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-500 text-sm"
          >
            Disconnect
          </button>
        )}
      </div>
    </div>
  );
}

