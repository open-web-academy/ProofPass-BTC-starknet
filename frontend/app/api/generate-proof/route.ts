import { NextRequest, NextResponse } from "next/server";
import type { ValidityOption } from "../../../lib/types";
import { ec, hash } from "starknet";


function computeExpiry(validity: ValidityOption): number {
  const now = Math.floor(Date.now() / 1000);
  if (validity === "7d") {
    return now + 7 * 24 * 60 * 60;
  }
  return now + 24 * 60 * 60;
}

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return (
    "0x" +
    Array.from(arr)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

export async function POST(req: NextRequest) {
  try {
    const { walletAddress, policy_id, validity, amount } = (await req.json()) as {
      walletAddress: string;
      policy_id: string;
      validity: ValidityOption;
      amount?: string;
    };

    if (!walletAddress || !policy_id) {
      return NextResponse.json(
        { error: "walletAddress and policy_id are required" },
        { status: 400 }
      );
    }

    const expiry_ts = computeExpiry(validity ?? "24h");

    // Simple salt for nullifier derivation.
    const nonce = randomHex(4);
    const encoder = new TextEncoder();
    const payloadBuffer = encoder.encode(
      `${walletAddress.toLowerCase()}|${policy_id}|${nonce}`
    );

    const hashBuf = await crypto.subtle.digest("SHA-256", payloadBuffer);
    const hashArr = Array.from(new Uint8Array(hashBuf));
    const nullifierHex =
      "0x" + hashArr.map((b) => b.toString(16).padStart(2, "0")).join("");

    const proof_id = randomHex(8);
    const tier = 1;

    // --- ORACLE ATTESTATION (ECDSA SIGNATURE) ---
    console.log("DEBUG: ORACLE_PRIVATE_KEY length:", process.env.ORACLE_PRIVATE_KEY?.length);
    console.log("DEBUG: ORACLE_PRIVATE_KEY starts with:", process.env.ORACLE_PRIVATE_KEY?.substring(0, 10));
    const privateKey = process.env.ORACLE_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error("ORACLE_PRIVATE_KEY is not configured on the server");
    }

    // Starknet felts must be < 2^252. A 32-byte SHA256 hash can be too large.
    // We mask the highest 4 bits to ensure it fits in 252 bits.
    let nullifierBigInt = BigInt(nullifierHex);
    nullifierBigInt = nullifierBigInt & ((1n << 251n) - 1n);
    const safeNullifierHex = "0x" + nullifierBigInt.toString(16);

    // policy_id might be a long string, let's hash it to a felt to be safe, 
    // or assume it's a short string. To be 100% safe, we parse it or hash it.
    // If it's something like "policy-123", we can just use shortString.encodeShortString
    // But since we can't be sure, we'll hash it and mask it just in case.
    const policyEncoder = new TextEncoder();
    const policyBuf = await crypto.subtle.digest("SHA-256", policyEncoder.encode(policy_id));
    let policyBigInt = BigInt("0x" + Array.from(new Uint8Array(policyBuf)).map(b => b.toString(16).padStart(2, "0")).join(""));
    policyBigInt = policyBigInt & ((1n << 251n) - 1n);
    const safePolicyIdHex = "0x" + policyBigInt.toString(16);

    // We create a hash of the data that the Smart Contract will also verify:
    const payloadHash = hash.computeHashOnElements([
      walletAddress,
      safePolicyIdHex,
      tier,
      safeNullifierHex,
      expiry_ts
    ]);

    // Sign the payload using the Oracle's Private Key
    const signature = ec.starkCurve.sign(payloadHash, privateKey);
    const r = signature.r.toString(16);
    const s = signature.s.toString(16);
    const public_inputs = [tier.toString(), "0x" + r, "0x" + s];

    // proof_blob_hex is no longer used as a mock bypass, but we keep it empty or stubbed 
    // to match the expected interface structure in the frontend.
    const proof_blob_hex = "0x0";

    return NextResponse.json({
      proof_id,
      policy_id: safePolicyIdHex,
      tier,
      proof_blob_hex,
      public_inputs,
      nullifier: safeNullifierHex,
      expiry_ts,
      amount,
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: e?.message ?? "Internal error" },
      { status: 500 }
    );
  }
}

