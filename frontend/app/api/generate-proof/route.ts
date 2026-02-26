import { NextRequest, NextResponse } from "next/server";
import type { ValidityOption } from "../../../lib/types";

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
    const payload = encoder.encode(
      `${walletAddress.toLowerCase()}|${policy_id}|${nonce}`
    );

    const hashBuf = await crypto.subtle.digest("SHA-256", payload);
    const hashArr = Array.from(new Uint8Array(hashBuf));
    const nullifierHex =
      "0x" + hashArr.map((b) => b.toString(16).padStart(2, "0")).join("");

    const proof_id = randomHex(8);
    const tier = 1;

    const proof_blob_hex = "0x1"; // special value accepted by on-chain stub
    const public_inputs = [tier.toString()];

    return NextResponse.json({
      proof_id,
      policy_id,
      tier,
      proof_blob_hex,
      public_inputs,
      nullifier: nullifierHex,
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

