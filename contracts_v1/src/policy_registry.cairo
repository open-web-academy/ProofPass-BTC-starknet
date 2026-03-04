/// ProofPass Policy Registry — Cairo 2 / Starknet

#[starknet::interface]
pub trait IPolicyRegistry<TState> {
    fn register_policy(ref self: TState, policy_id: felt252, commitment: felt252);
    fn get_policy_commitment(self: @TState, policy_id: felt252) -> felt252;
    fn is_policy_active(self: @TState, policy_id: felt252) -> bool;
}

#[starknet::contract]
pub mod PolicyRegistry {
    use starknet::{ContractAddress, get_caller_address};
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess, StorageMapReadAccess,
        StorageMapWriteAccess, Map,
    };

    #[storage]
    struct Storage {
        owner: ContractAddress,
        policies: Map<felt252, felt252>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        PolicyRegistered: PolicyRegistered,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PolicyRegistered {
        pub policy_id: felt252,
        pub commitment: felt252,
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner_address: ContractAddress) {
        self.owner.write(owner_address);
    }

    #[abi(embed_v0)]
    impl PolicyRegistryImpl of super::IPolicyRegistry<ContractState> {
        fn register_policy(ref self: ContractState, policy_id: felt252, commitment: felt252) {
            assert(get_caller_address() == self.owner.read(), 'PolicyRegistry: not owner');
            self.policies.write(policy_id, commitment);
            self.emit(PolicyRegistered { policy_id, commitment });
        }

        fn get_policy_commitment(self: @ContractState, policy_id: felt252) -> felt252 {
            self.policies.read(policy_id)
        }

        fn is_policy_active(self: @ContractState, policy_id: felt252) -> bool {
            self.policies.read(policy_id) != 0
        }
    }
}
