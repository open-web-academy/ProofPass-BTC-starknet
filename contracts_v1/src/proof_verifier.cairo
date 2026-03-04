/// ProofPass Proof Verifier — Cairo 2 / Starknet
/// Validates Oracle ECDSA attestations using native Stark curve signature verification.

#[starknet::interface]
pub trait IProofVerifier<TState> {
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
    fn is_nullifier_used(self: @TState, nullifier: felt252) -> bool;
    fn get_oracle_public_key(self: @TState) -> felt252;
}

#[starknet::contract]
pub mod ProofVerifier {
    use starknet::get_block_timestamp;
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess, StorageMapReadAccess,
        StorageMapWriteAccess, Map,
    };
    use core::ecdsa::check_ecdsa_signature;
    use core::pedersen::pedersen;

    #[storage]
    struct Storage {
        oracle_public_key: felt252,
        used_nullifiers: Map<felt252, bool>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        ProofVerified: ProofVerified,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ProofVerified {
        pub user_address: felt252,
        pub policy_id: felt252,
        pub tier: felt252,
        pub nullifier: felt252,
        pub proof_id: felt252,
    }

    #[constructor]
    fn constructor(ref self: ContractState, oracle_public_key: felt252) {
        self.oracle_public_key.write(oracle_public_key);
    }

    /// Reconstruct the Pedersen hash that starknet.js computeHashOnElements produces:
    ///   pedersen(pedersen(pedersen(pedersen(pedersen(pedersen(0, addr), policy), tier), null), expiry), 5)
    fn compute_payload_hash(
        user_address: felt252,
        policy_id: felt252,
        tier: felt252,
        nullifier: felt252,
        expiry_ts: felt252,
    ) -> felt252 {
        let h0: felt252 = 0;
        let h1 = pedersen(h0, user_address);
        let h2 = pedersen(h1, policy_id);
        let h3 = pedersen(h2, tier);
        let h4 = pedersen(h3, nullifier);
        let h5 = pedersen(h4, expiry_ts);
        pedersen(h5, 5) // finalize with array length
    }

    #[abi(embed_v0)]
    impl ProofVerifierImpl of super::IProofVerifier<ContractState> {
        fn verify_and_register(
            ref self: ContractState,
            proof_id: felt252,
            policy_id: felt252,
            tier: felt252,
            sig_r: felt252,
            sig_s: felt252,
            nullifier: felt252,
            expiry_ts: felt252,
            user_address: felt252,
        ) {
            // 1. Check expiry
            let now: u64 = get_block_timestamp();
            let expiry: u64 = expiry_ts.try_into().unwrap();
            assert(now < expiry, 'ProofVerifier: expired');

            // 2. Replay protection — check nullifier not used
            assert(!self.used_nullifiers.read(nullifier), 'ProofVerifier: nullifier used');

            // 3. Compute payload hash (matches starknet.js Oracle server)
            let payload_hash = compute_payload_hash(
                user_address, policy_id, tier, nullifier, expiry_ts,
            );

            // 4. Verify Oracle ECDSA signature (Stark curve)
            let pub_key = self.oracle_public_key.read();
            let valid = check_ecdsa_signature(payload_hash, pub_key, sig_r, sig_s);
            assert(valid, 'ProofVerifier: bad signature');

            // 5. Mark nullifier as consumed
            self.used_nullifiers.write(nullifier, true);

            // 6. Emit on-chain event
            self.emit(ProofVerified { user_address, policy_id, tier, nullifier, proof_id });
        }

        fn is_nullifier_used(self: @ContractState, nullifier: felt252) -> bool {
            self.used_nullifiers.read(nullifier)
        }

        fn get_oracle_public_key(self: @ContractState) -> felt252 {
            self.oracle_public_key.read()
        }
    }
}
