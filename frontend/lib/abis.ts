// Minimal ABIs for GateAdapter and ProofVerifier contracts (Starknet).

export const GATE_ADAPTER_ABI = [
  {
    type: "function",
    name: "deposit",
    stateMutability: "external",
    inputs: [
      { name: "policy_id", type: "felt" },
      { name: "proof_id", type: "felt" },
      { name: "proof_blob_ptr", type: "felt" },
      { name: "public_inputs_ptr", type: "felt" },
      { name: "nullifier", type: "felt" },
      { name: "expiry_ts", type: "felt" },
      { name: "amount", type: "Uint256" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "get_balance",
    stateMutability: "view",
    inputs: [{ name: "user", type: "felt" }],
    outputs: [{ name: "balance", type: "Uint256" }]
  }
] as const;

export const PROOF_VERIFIER_ABI = [
  {
    type: "event",
    name: "ProofVerified",
    keys: [],
    data: [
      { name: "proof_id", type: "felt" },
      { name: "policy_id", type: "felt" },
      { name: "tier", type: "felt" }
    ]
  }
] as const;

