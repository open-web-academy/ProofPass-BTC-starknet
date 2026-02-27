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
  id: number;
  name: string;
  network: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrls: { default: { http: string[] }; public: { http: string[] } };
  blockExplorers?: { default: { name: string; url: string } };
};

const devnet = (rpc: string): Chain => ({
  id: 1537,
  name: "Local Devnet",
  network: "devnet",
  nativeCurrency: { name: "STRK", symbol: "STRK", decimals: 18 },
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
    <StarknetConfig chains={[devnet(rpcUrl)]} provider={provider} connectors={connectors}>
      {children}
    </StarknetConfig>
  );
}

