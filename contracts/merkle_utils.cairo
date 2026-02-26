// MerkleUtils library - provides a simple Merkle proof verifier using Pedersen hash.

%lang starknet

from starkware.cairo.common.cairo_builtins import HashBuiltin
from starkware.cairo.common.hash2 import hash2

// Verifies a Merkle proof for a given leaf and root.
// The proof is given as a flat array of sibling hashes.
// For simplicity, this implementation always computes:
//   current = hash2(current, sibling)
// for each level (no left/right flags).
@view
func verify_merkle_proof{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
}(
    leaf : felt,
    proof_ptr : felt*,
    proof_len : felt,
    root : felt
) -> (ok : felt):
    alloc_locals
    let mut local current = leaf
    let mut i = 0

    // Iterate over proof elements and hash them with the current value.
    while i < proof_len:
        let sibling = [proof_ptr + i]
        let (new_current) = hash2(current, sibling)
        current = new_current
        i = i + 1
    end

    if current == root:
        return (ok=1)
    end
    return (ok=0)
end

