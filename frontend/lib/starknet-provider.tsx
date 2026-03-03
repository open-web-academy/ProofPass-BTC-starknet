"use client";

import type { ReactNode } from "react";
import {
  StarknetConfig,
  jsonRpcProvider,
  argent,
  braavos,
  useInjectedConnectors,
} from "@starknet-react/core";

const rpcUrl = process.env.NEXT_PUBLIC_STARKNET_RPC_URL || "http://127.0.0.1:5050";

/** Minimal chain shape expected by StarknetConfig (no @starknet-react/chains dependency). */
type Chain = {
  id: bigint;
  name: string;
  network: string;
  nativeCurrency: { name: string; symbol: string; decimals: number; address: `0x${string}` };
  rpcUrls: { default: { http: string[] }; public: { http: string[] } };
  blockExplorers?: { default: { name: string; url: string } };
};

const devnet = (rpc: string): Chain => ({
  id: BigInt("0x534e5f5345504f4c4941"), // SN_SEPOLIA
  name: "Local Devnet",
  network: "devnet",
  nativeCurrency: { name: "STRK", symbol: "STRK", decimals: 18, address: "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d" },
  rpcUrls: {
    default: { http: [rpc] },
    public: { http: [rpc] },
  },
  blockExplorers: {
    default: { name: "Local", url: rpc },
  },
});

const provider = jsonRpcProvider({
  rpc: () => ({
    nodeUrl: rpcUrl,
  }),
});

export function StarknetProvider({ children }: { children: ReactNode }) {
  const { connectors } = useInjectedConnectors({
    recommended: [argent(), braavos()],
    includeRecommended: "onlyIfNoConnectors",
    order: "random",
  });

  return (
    <StarknetConfig autoConnect chains={[devnet(rpcUrl)]} provider={provider} connectors={connectors}>
      {children}
    </StarknetConfig>
  );
}

