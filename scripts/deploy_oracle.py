"""
Deploy Cairo 0 contracts to Rust devnet using low-level starknet-py signing
Bypasses the high-level Contract API that requires Sierra/Cairo 1 compilation.
"""
import asyncio, json, os, re

BUILD_DIR = "/mnt/c/Users/franc/Desktop/CloudMex/ProofPass-BTC-starknet/build"
ENV_LOCAL  = "/mnt/c/Users/franc/Desktop/CloudMex/ProofPass-BTC-starknet/frontend/.env.local"
DEVNET_URL = "http://127.0.0.1:5050"
ADDR       = "0x064b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691"
PRIVKEY    = "0x0000000000000000000000000000000071d7bb07b9a64f6f78ac4c816aff4da9"


async def main():
    from starknet_py.net.full_node_client import FullNodeClient
    from starknet_py.net.account.account import Account
    from starknet_py.net.signer.stark_curve_signer import KeyPair
    from starknet_py.hash.class_hash import compute_class_hash

    client = FullNodeClient(node_url=DEVNET_URL)
    chain = await client.get_chain_id()
    print(f"Chain: {chain}")

    key_pair = KeyPair.from_private_key(int(PRIVKEY, 16))
    account = Account(
        client=client,
        address=int(ADDR, 16),
        key_pair=key_pair,
        chain=chain,
    )
    
    # Get nonce before starting
    nonce = await account.get_nonce()
    print(f"Nonce: {nonce}\n")

    results = {}

    for name in ["mock_erc20", "proof_verifier", "gate_adapter"]:
        path = os.path.join(BUILD_DIR, f"{name}.json")
        with open(path) as f:
            artifact_dict = json.load(f)

        print(f"--- {name} ---")

        # Compute class hash for Cairo 0 artifact
        try:
            class_hash = compute_class_hash(contract_class=artifact_dict)
            print(f"  Class hash: {hex(class_hash)}")
        except Exception as e:
            print(f"  compute_class_hash error: {e}")
            raise

        # Declare via low-level sign_declare
        print("  Declaring...", end="", flush=True)
        try:
            from starknet_py.net.models import StarknetChainId
            from starknet_py.transactions.declare import make_declare_tx_v1
            
            declare_tx = make_declare_tx_v1(
                contract_class=artifact_dict,
                sender_address=int(ADDR, 16),
                chain_id=chain,
                nonce=nonce,
                max_fee=int(1e16),
            )
            # Sign it
            signature = key_pair.sign(declare_tx.hash)
            declare_tx = declare_tx.to_signed(signature)
            resp = await client.declare(declare_tx)
            await client.wait_for_tx(resp.transaction_hash)
            print(f" ✓")
            nonce += 1
        except Exception as e:
            if "already" in str(e).lower() or "ClassAlreadyDeclared" in str(e):
                print(f" already declared")
            else:
                print(f" ERROR: {e}")
                raise

        # Deploy
        print("  Deploying...", end="", flush=True)
        ctor_args = []
        if name == "mock_erc20":
            ctor_args = [int(ADDR, 16), 10**18, 0]
        elif name == "gate_adapter":
            ctor_args = [int(results["mock_erc20"], 16), int(results["proof_verifier"], 16)]

        from starknet_py.transactions.deploy import make_deploy_tx
        deploy_tx = make_deploy_tx(
            class_hash=class_hash,
            constructor_calldata=ctor_args,
            salt=hash(name) % (2**251),
        )
        resp = await client.deploy(deploy_tx)
        await client.wait_for_tx(resp.transaction_hash)
        addr = hex(resp.contract_address)
        print(f" -> {addr}")
        results[name] = addr

    # Update .env.local
    with open(ENV_LOCAL) as f:
        env = f.read()

    mapping = {
        "NEXT_PUBLIC_STRKBTC_ADDRESS": results["mock_erc20"],
        "NEXT_PUBLIC_PROOF_VERIFIER_ADDRESS": results["proof_verifier"],
        "NEXT_PUBLIC_GATE_ADAPTER_ADDRESS": results["gate_adapter"],
    }
    for k, v in mapping.items():
        pat = re.compile(rf"^{k}=.*$", re.MULTILINE)
        env = pat.sub(f"{k}={v}", env) if pat.search(env) else env + f"\n{k}={v}"
    with open(ENV_LOCAL, "w") as f:
        f.write(env)

    print("\n=== .env.local UPDATED ===")
    for k, v in mapping.items():
        print(f"  {k}={v}")
    print("\nRestart Next.js: ctrl+c then npm run dev")


asyncio.run(main())
