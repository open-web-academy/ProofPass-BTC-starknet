import { POST as generateProofHandler } from "../app/api/generate-proof/route";

describe("Generate → Deposit flow (minimal integration stub)", () => {
  it("returns a simulated proof payload from /api/generate-proof", async () => {
    // @ts-expect-error NextRequest is created by Next.js runtime; here we stub the body.
    const req = {
      json: async () => ({
        walletAddress: "0x123",
        policy_id: "1",
        validity: "24h",
      }),
    };

    const res = await generateProofHandler(req as any);
    const json = await (res as any).json();

    expect(json.proof_id).toBeDefined();
    expect(json.policy_id).toBe("1");
    expect(json.proof_blob_hex).toBe("0x1");
    expect(Array.isArray(json.public_inputs)).toBe(true);
    expect(json.nullifier).toMatch(/^0x[0-9a-f]+$/);
  });
});

