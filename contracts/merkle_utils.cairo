// MerkleUtils library - provides a simple Merkle proof verifier using Pedersen hash.
// Cairo 0 has no loops or mutable variables; iteration is implemented via tail recursion.

%lang starknet

from starkware.cairo.common.cairo_builtins import HashBuiltin
from starkware.cairo.common.hash2 import hash2

// Internal recursive helper: hashes `current` with each sibling in the proof array.
// Returns the computed root after processing all proof elements.
func _hash_proof_path{pedersen_ptr : HashBuiltin*}(
    current : felt,
    proof_ptr : felt*,
    i : felt,
    proof_len : felt
) -> (result : felt):
    // Base case: all siblings processed, return the accumulated hash.
    if i == proof_len:
        return (result=current)
    end

    // Recursive case: hash current value with the next sibling, advance index.
    let sibling = [proof_ptr + i]
    let (new_current) = hash2(current, sibling)
    return _hash_proof_path(new_current, proof_ptr, i + 1, proof_len)
end

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
    let (computed_root) = _hash_proof_path(leaf, proof_ptr, 0, proof_len)
    if computed_root == root:
        return (ok=1)
    else:
        return (ok=0)
    end
end
