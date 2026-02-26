import pytest
from starkware.starknet.testing.starknet import Starknet


@pytest.mark.asyncio
async def test_verify_register_ok():
    """
    Simulate a valid proof: verify_and_register should emit ProofVerified
    and mark the nullifier as used.
    """
    starknet = await Starknet.empty()

    verifier = await starknet.deploy(
        source="contracts/proof_verifier.cairo",
    )

    proof_id = 1
    policy_id = 42
    tier = 2  # for demo, tier is passed via public_inputs_ptr
    public_inputs_len = 1
    public_inputs_ptr = tier
    proof_blob_ptr = 0x1  # special value accepted by stub
    nullifier = 123456
    expiry_ts = 10**12  # far in the future relative to testnet timestamp

    tx = await verifier.verify_and_register(
        proof_id=proof_id,
        policy_id=policy_id,
        public_inputs_len=public_inputs_len,
        public_inputs_ptr=public_inputs_ptr,
        proof_blob_ptr=proof_blob_ptr,
        nullifier=nullifier,
        expiry_ts=expiry_ts,
    ).invoke()

    # Check that at least one event was emitted (ProofVerified).
    assert len(tx.main_call_events) == 1

    # Check that nullifier is now marked as used.
    res = await verifier.used_nullifier(nullifier).call()
    assert res.result.used == 1


@pytest.mark.asyncio
async def test_replay_nullifier():
    """
    Reusing the same nullifier should cause verify_and_register to revert.
    """
    starknet = await Starknet.empty()

    verifier = await starknet.deploy(
        source="contracts/proof_verifier.cairo",
    )

    proof_id = 1
    policy_id = 42
    tier = 1
    public_inputs_len = 1
    public_inputs_ptr = tier
    proof_blob_ptr = 0x1
    nullifier = 9999
    expiry_ts = 10**12

    # First call succeeds.
    await verifier.verify_and_register(
        proof_id=proof_id,
        policy_id=policy_id,
        public_inputs_len=public_inputs_len,
        public_inputs_ptr=public_inputs_ptr,
        proof_blob_ptr=proof_blob_ptr,
        nullifier=nullifier,
        expiry_ts=expiry_ts,
    ).invoke()

    # Second call with same nullifier must revert.
    with pytest.raises(Exception):
        await verifier.verify_and_register(
            proof_id=proof_id + 1,
            policy_id=policy_id,
            public_inputs_len=public_inputs_len,
            public_inputs_ptr=public_inputs_ptr,
            proof_blob_ptr=proof_blob_ptr,
            nullifier=nullifier,
            expiry_ts=expiry_ts,
        ).invoke()

