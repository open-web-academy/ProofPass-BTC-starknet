"use client";

import type { ReactNode } from "react";
import {
  StarknetConfig,
  jsonRpcProvider,
  argent,
  braavos,
  useInjectedConnectors,
} from "@starknet-react/core";
import { sepolia } from "@starknet-react/chains";

const rpcUrl = process.env.NEXT_PUBLIC_STARKNET_RPC_URL || "https://starknet-sepolia.public.blastapi.io/rpc/v0_7";

const provider = jsonRpcProvider({
  rpc: () => ({
    nodeUrl: rpcUrl,
  }),
});

export function StarknetProvider({ children }: { children: ReactNode }) {
  const { connectors } = useInjectedConnectors({
    recommended: [argent(), braavos()],
    includeRecommended: "onlyIfNoConnectors",
  });

  return (
    <StarknetConfig autoConnect chains={[sepolia]} provider={provider} connectors={connectors}>
      {children}
    </StarknetConfig>
  );
}

