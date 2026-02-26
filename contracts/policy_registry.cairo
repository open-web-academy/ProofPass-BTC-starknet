// PolicyRegistry contract - Cairo v1 / Starknet
// Stores policy commitments and allows an owner to register new policies.

%lang starknet

from starkware.cairo.common.cairo_builtins import HashBuiltin

from starkware.starknet.common.syscalls import get_caller_address
from starkware.starknet.common.storage import Storage

@storage_var
func policy_commitment(policy_id : felt) -> (commitment : felt):
end

@storage_var
func owner() -> (address : felt):
end

@constructor
func constructor{syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr}(
    owner_address : felt
):
    owner.write(owner_address)
    return ()
end

// Internal helper: ensures that the caller is the contract owner.
func assert_only_owner{syscall_ptr : felt*, pedersen_ptr : HashBuiltin*, range_check_ptr}():
    let (caller) = get_caller_address()
    let (stored_owner) = owner.read()
    assert caller = stored_owner
    return ()
end

// Registers or updates a policy commitment (owner-only).
@external
func register_policy{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
}(policy_id : felt, commitment : felt):
    assert_only_owner()
    policy_commitment.write(policy_id, commitment)
    return ()
end

// Returns the stored commitment for a given policy id.
@view
func get_policy_commitment{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
}(policy_id : felt) -> (commitment : felt):
    let (commitment) = policy_commitment.read(policy_id)
    return (commitment)
end

