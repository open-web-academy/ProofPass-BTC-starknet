// External verifier stub - to be replaced by a real ZK verifier off-chain/on-chain.
// For tests and demo, this stub accepts a special proof_blob_ptr value (0x1) as valid.
// NOTE: No %lang directive here — this is a library file imported by %lang starknet contracts.

from starkware.cairo.common.cairo_builtins import HashBuiltin

// Stub function used by ProofVerifier to validate proofs.
// In production this would call into a real verifier or use syscalls.
func call_external_verifier{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
}(
    proof_blob_ptr : felt,
    public_inputs_ptr : felt,
    public_inputs_len : felt
) -> (ok : felt):
    // For demo: accept only if proof_blob_ptr is the special marker 0x1.
    if proof_blob_ptr == 0x1:
        return (ok=1)
    else:
        return (ok=0)
    end
end

