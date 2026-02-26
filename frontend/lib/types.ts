export type ValidityOption = "24h" | "7d";

export interface GeneratedProof {
  proof_id: string;
  policy_id: string;
  tier: number;
  proof_blob_hex: string;
  public_inputs: string[];
  nullifier: string;
  expiry_ts: number;
  amount?: string;
}

