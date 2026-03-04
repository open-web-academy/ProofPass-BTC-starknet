/// ProofPass Gate Adapter — Cairo 2 / Starknet
/// Validates Oracle proof then deposits strkBTC tokens.

#[starknet::interface]
pub trait IERC20Ext<TState> {
    fn balance_of(self: @TState, account: starknet::ContractAddress) -> u256;
    fn allowance(
        self: @TState, owner: starknet::ContractAddress, spender: starknet::ContractAddress,
    ) -> u256;
    fn transfer(ref self: TState, recipient: starknet::ContractAddress, amount: u256) -> bool;
    fn transfer_from(
        ref self: TState,
        sender: starknet::ContractAddress,
        recipient: starknet::ContractAddress,
        amount: u256,
    ) -> bool;
    fn approve(ref self: TState, spender: starknet::ContractAddress, amount: u256) -> bool;
}

#[starknet::interface]
pub trait IProofVerifierExt<TState> {
    fn verify_and_register(
        ref self: TState,
        proof_id: felt252,
        policy_id: felt252,
        tier: felt252,
        sig_r: felt252,
        sig_s: felt252,
        nullifier: felt252,
        expiry_ts: felt252,
        user_address: felt252,
    );
}

#[starknet::interface]
pub trait IGateAdapter<TState> {
    fn deposit(
        ref self: TState,
        proof_id: felt252,
        policy_id: felt252,
        tier: felt252,
        sig_r: felt252,
        sig_s: felt252,
        nullifier: felt252,
        expiry_ts: felt252,
        amount: u256,
    );
    fn get_balance(self: @TState, user: starknet::ContractAddress) -> u256;
    fn get_strk_btc_address(self: @TState) -> starknet::ContractAddress;
    fn get_proof_verifier_address(self: @TState) -> starknet::ContractAddress;
}

#[starknet::contract]
pub mod GateAdapter {
    use starknet::{ContractAddress, get_caller_address, get_contract_address};
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess, StorageMapReadAccess,
        StorageMapWriteAccess, Map,
    };
    use super::{IERC20ExtDispatcher, IERC20ExtDispatcherTrait};
    use super::{IProofVerifierExtDispatcher, IProofVerifierExtDispatcherTrait};

    #[storage]
    struct Storage {
        strk_btc_address: ContractAddress,
        proof_verifier_address: ContractAddress,
        balances: Map<ContractAddress, u256>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        Deposited: Deposited,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Deposited {
        pub user: ContractAddress,
        pub amount: u256,
        pub policy_id: felt252,
        pub tier: felt252,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        strk_btc_address: ContractAddress,
        proof_verifier_address: ContractAddress,
    ) {
        self.strk_btc_address.write(strk_btc_address);
        self.proof_verifier_address.write(proof_verifier_address);
    }

    #[abi(embed_v0)]
    impl GateAdapterImpl of super::IGateAdapter<ContractState> {
        fn deposit(
            ref self: ContractState,
            proof_id: felt252,
            policy_id: felt252,
            tier: felt252,
            sig_r: felt252,
            sig_s: felt252,
            nullifier: felt252,
            expiry_ts: felt252,
            amount: u256,
        ) {
            let caller = get_caller_address();

            // 1. Verify Oracle attestation (panics on failure)
            let verifier = IProofVerifierExtDispatcher {
                contract_address: self.proof_verifier_address.read(),
            };
            verifier.verify_and_register(
                proof_id,
                policy_id,
                tier,
                sig_r,
                sig_s,
                nullifier,
                expiry_ts,
                caller.into(),
            );

            // 2. Pull strkBTC from user (user must have approved this contract first)
            let token = IERC20ExtDispatcher { contract_address: self.strk_btc_address.read() };
            let ok = token.transfer_from(caller, get_contract_address(), amount);
            assert(ok, 'GateAdapter: transfer failed');

            // 3. Update internal balance
            self.balances.write(caller, self.balances.read(caller) + amount);

            self.emit(Deposited { user: caller, amount, policy_id, tier });
        }

        fn get_balance(self: @ContractState, user: ContractAddress) -> u256 {
            self.balances.read(user)
        }

        fn get_strk_btc_address(self: @ContractState) -> ContractAddress {
            self.strk_btc_address.read()
        }

        fn get_proof_verifier_address(self: @ContractState) -> ContractAddress {
            self.proof_verifier_address.read()
        }
    }
}
