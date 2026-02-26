// GateAdapter contract - integrates ProofVerifier with an ERC20-like strkBTC token for deposits.

%lang starknet

from starkware.cairo.common.cairo_builtins import HashBuiltin
from starkware.cairo.common.uint256 import Uint256, uint256_add
from starkware.starknet.common.syscalls import get_caller_address, get_contract_address
from starkware.starknet.common.storage import Storage

// -------------------------
// Storage
// -------------------------

// Address of the strkBTC token contract (ERC20-compatible).
@storage_var
func strk_btc_address() -> (addr : felt):
end

// Address of the ProofVerifier contract.
@storage_var
func proof_verifier_address() -> (addr : felt):
end

// Simple on-chain balance tracking for demo: user_address -> uint256 balance.
@storage_var
func balances(user : felt) -> (balance_low : felt, balance_high : felt):
end

// -------------------------
// Interfaces
// -------------------------

@contract_interface
namespace IProofVerifier:
    func verify_and_register(
        proof_id : felt,
        policy_id : felt,
        public_inputs_len : felt,
        public_inputs_ptr : felt,
        proof_blob_ptr : felt,
        nullifier : felt,
        expiry_ts : felt
    ) -> (ok : felt):
    end
end

@contract_interface
namespace IERC20:
    func transferFrom(sender : felt, recipient : felt, amount : Uint256) -> (success : felt):
    end
end

// -------------------------
// Constructor
// -------------------------

@constructor
func constructor{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
}(
    strk_btc_addr : felt,
    proof_verifier_addr : felt
):
    strk_btc_address.write(strk_btc_addr)
    proof_verifier_address.write(proof_verifier_addr)
    return ()
end

// -------------------------
// External functions
// -------------------------

// Deposits strkBTC into the adapter after verifying the provided proof through
// the ProofVerifier contract. On success, transfers tokens and updates demo balances.
@external
func deposit{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
}(
    policy_id : felt,
    proof_id : felt,
    proof_blob_ptr : felt,
    public_inputs_ptr : felt,
    nullifier : felt,
    expiry_ts : felt,
    amount : Uint256
):
    alloc_locals

    // 1) Load external contract addresses.
    let (token_addr) = strk_btc_address.read()
    let (verifier_addr) = proof_verifier_address.read()

    // 2) Call ProofVerifier.verify_and_register, requiring ok == 1.
    // For demo, we pass public_inputs_len = 1 and interpret public_inputs_ptr as tier.
    let (ok_verifier) = IProofVerifier.verify_and_register(
        contract_address=verifier_addr,
        proof_id=proof_id,
        policy_id=policy_id,
        public_inputs_len=1,
        public_inputs_ptr=public_inputs_ptr,
        proof_blob_ptr=proof_blob_ptr,
        nullifier=nullifier,
        expiry_ts=expiry_ts
    )
    if ok_verifier != 1:
        with_attr error_message("PROOF_NOT_VALID"):
            assert 0 = 1
        end
    end

    // 3) Transfer strkBTC from user to this contract.
    let (caller) = get_caller_address()
    let (this_addr) = get_contract_address()

    let (success) = IERC20.transferFrom(
        contract_address=token_addr, sender=caller, recipient=this_addr, amount=amount
    )
    if success != 1:
        with_attr error_message("TRANSFER_FAILED"):
            assert 0 = 1
        end
    end

    // 4) Update demo on-chain balance for the caller.
    let (prev_low, prev_high) = balances.read(caller)
    let prev_balance = Uint256(low=prev_low, high=prev_high)
    let (new_balance) = uint256_add(prev_balance, amount)
    balances.write(caller, new_balance.low, new_balance.high)

    return ()
end

// Returns the recorded demo balance of a given user.
@view
func get_balance{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
}(user : felt) -> (balance : Uint256):
    let (low, high) = balances.read(user)
    let bal = Uint256(low=low, high=high)
    return (bal)
end

