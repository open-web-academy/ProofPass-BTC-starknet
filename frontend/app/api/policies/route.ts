import { NextResponse } from "next/server";
import { RpcProvider, Contract } from "starknet";

const RPC_URL =
  process.env.NEXT_PUBLIC_STARKNET_RPC_URL || "http://127.0.0.1:5050/rpc";
const POLICY_REGISTRY_ADDRESS =
  process.env.NEXT_PUBLIC_POLICY_REGISTRY_ADDRESS || "0x0";

// Minimal ABI fragment for PolicyRegistry.get_policy_commitment
const POLICY_REGISTRY_ABI = [
  {
    type: "function",
    name: "get_policy_commitment",
    stateMutability: "view",
    inputs: [{ name: "policy_id", type: "felt" }],
    outputs: [{ name: "commitment", type: "felt" }],
  },
] as const;

export async function GET() {
  try {
    const provider = new RpcProvider({ nodeUrl: RPC_URL });
    const contract = new Contract(
      POLICY_REGISTRY_ABI as any,
      POLICY_REGISTRY_ADDRESS,
      provider
    );

    const policyDefinitions = [
      { id: "1", name: "No sanctions (OFAC Check)" },
      { id: "2", name: "Wallet Age > 1 year" },
      { id: "3", name: "Not linked to Tornado Cash" },
    ];

    const policies = [];
    for (const def of policyDefinitions) {
      try {
        const res = await contract.call(
          "get_policy_commitment",
          [BigInt(def.id)],
          { blockIdentifier: "latest" as any }
        );
        const commitment =
          Array.isArray(res) && res.length > 0
            ? res[0].toString()
            : "0x0";
        policies.push({ id: def.id, name: def.name, commitment });
      } catch {
        policies.push({ id: def.id, name: def.name, commitment: "0x0" });
      }
    }

    return NextResponse.json({ policies });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: e?.message ?? "Failed to load policies" },
      { status: 500 }
    );
  }
}

