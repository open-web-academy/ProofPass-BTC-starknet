// Simple mock ERC20 token for local testing (strkBTC substitute).

%lang starknet

from starkware.cairo.common.cairo_builtins import HashBuiltin
from starkware.cairo.common.uint256 import Uint256, uint256_add, uint256_sub, uint256_le
from starkware.starknet.common.syscalls import get_caller_address

// -------------------------
// Storage
// -------------------------

@storage_var
func balance_of(account : felt) -> (low : felt, high : felt):
end

@storage_var
func allowance(owner : felt, spender : felt) -> (low : felt, high : felt):
end

// -------------------------
// Constructor
// -------------------------

// Mints an initial supply to the deployer for tests.
@constructor
func constructor{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
}(initial_holder : felt, initial_supply : Uint256):
    balance_of.write(initial_holder, initial_supply.low, initial_supply.high)
    return ()
end

// -------------------------
// ERC20 subset
// -------------------------

@view
func balanceOf{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
}(account : felt) -> (balance : Uint256):
    let (low, high) = balance_of.read(account)
    return (Uint256(low=low, high=high))
end

@external
func approve{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
}(spender : felt, amount : Uint256) -> (success : felt):
    let (owner) = get_caller_address()
    allowance.write(owner, spender, amount.low, amount.high)
    return (success=1)
end

@external
func transferFrom{
    syscall_ptr : felt*,
    pedersen_ptr : HashBuiltin*,
    range_check_ptr
}(sender : felt, recipient : felt, amount : Uint256) -> (success : felt):
    alloc_locals

    let (allowed_low, allowed_high) = allowance.read(sender, recipient)
    let allowed = Uint256(low=allowed_low, high=allowed_high)

    let (enough_allowance) = uint256_le(amount, allowed)
    if enough_allowance == 0:
        with_attr error_message("ERC20_INSUFFICIENT_ALLOWANCE"):
            assert 0 = 1
        end
    end

    let (sender_low, sender_high) = balance_of.read(sender)
    let sender_balance = Uint256(low=sender_low, high=sender_high)

    let (enough_balance) = uint256_le(amount, sender_balance)
    if enough_balance == 0:
        with_attr error_message("ERC20_INSUFFICIENT_BALANCE"):
            assert 0 = 1
        end
    end

    let (new_sender_balance) = uint256_sub(sender_balance, amount)
    balance_of.write(sender, new_sender_balance.low, new_sender_balance.high)

    let (recipient_low, recipient_high) = balance_of.read(recipient)
    let recipient_balance = Uint256(low=recipient_low, high=recipient_high)
    // uint256_add returns (res : Uint256, carry : felt) — carry must be captured.
    let (new_recipient_balance, carry) = uint256_add(recipient_balance, amount)
    balance_of.write(recipient, new_recipient_balance.low, new_recipient_balance.high)

    // Decrease allowance.
    let (new_allowance) = uint256_sub(allowed, amount)
    allowance.write(sender, recipient, new_allowance.low, new_allowance.high)

    return (success=1)
end

