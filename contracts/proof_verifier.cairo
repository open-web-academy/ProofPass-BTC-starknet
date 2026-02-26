// ProofVerifier contract - tracks used nullifiers and verifies proofs via an external stub.

%lang starknet

from starkware.cairo.common.cairo_builtins import HashBuiltin
from starkware.cairo.common.uint256 import Uint256
from starkware.starknet.common.syscalls import get_block_timestamp

from starkware.starknet.common.storage import Storage
from contracts.external_verifier import call_external_verifier

// Storage: used_nullifier(nullifier) -> felt (1 if used)
@storage_var
func used_nullifier(nullifier : felt) -> (used : felt):
end

// Event emitted when a proof is successfully verified and registered.
@event
func ProofVerified(proof_id : felt, policy_id : felt, tier : felt):
end

// Verifies a proof, checks expiry and nullifier, calls the external verifier stub,
// marks the nullifier as used, and emits ProofVerified with a tier extracted
// from public_inputs (for demo we treat public_inputs_ptr as the tier value).
@external
func verify_and_register{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
}(
    proof_id : felt,
    policy_id : felt,
    public_inputs_len : felt,
    public_inputs_ptr : felt,
    proof_blob_ptr : felt,
    nullifier : felt,
    expiry_ts : felt
) -> (ok : felt):
    alloc_locals

    // 1) Check expiry using current block timestamp.
    let (current_ts) = get_block_timestamp()
    if expiry_ts < current_ts:
        with_attr error_message("PROOF_EXPIRED"):
            assert 0 = 1
        end
    end

    // 2) Check nullifier not used.
    let (already_used) = used_nullifier.read(nullifier)
    if already_used != 0:
        with_attr error_message("NULLIFIER_ALREADY_USED"):
            assert 0 = 1
        end
    end

    // 3) Call external verifier stub.
    let (ok_verifier) = call_external_verifier(proof_blob_ptr, public_inputs_ptr, public_inputs_len)
    if ok_verifier != 1:
        with_attr error_message("INVALID_PROOF"):
            assert 0 = 1
        end
    end

    // 4) Mark nullifier as used.
    used_nullifier.write(nullifier, 1)

    // 5) Tier is taken from the public inputs.
    // For this demo, we interpret public_inputs_ptr as a direct tier value.
    let tier = public_inputs_ptr

    // 6) Emit event.
    ProofVerified.emit(proof_id, policy_id, tier)

    return (ok=1)
end

