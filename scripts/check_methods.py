"""
ProofPass Oracle Deployment - starknet-py 0.28.x, Cairo 0 contracts
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
    from starknet_py.cairo.felt import decode_shortstring
    from starknet_py.hash.class_hash import compute_class_hash
    from starknet_py.serialization.data_serializers.cairo_data_serializer import CairoDataSerializer

    try:
        from starknet_py.cairo.contract_class.compiled_class import CompiledContract
    except ImportError:
        CompiledContract = None

    try:
        from starknet_py.net.schemas.common import ContractClassSchema
    except ImportError:
        ContractClassSchema = None

    try:    
        from starknet_py.net.models.contract import ContractClass
    except ImportError:
        ContractClass = None

    print("Imports OK. Checking compute_class_hash signature:")
    import inspect
    print(inspect.signature(compute_class_hash))

    client = FullNodeClient(node_url=DEVNET_URL)
    chain = await client.get_chain_id()
    print(f"Chain: {chain}")

    account = Account(
        client=client,
        address=int(ADDR, 16),
        key_pair=KeyPair.from_private_key(int(PRIVKEY, 16)),
        chain=chain,
    )
    print(f"Nonce: {await account.get_nonce()}\n")

    path = os.path.join(BUILD_DIR, "mock_erc20.json")
    with open(path) as f:
        artifact = json.load(f)

    # Try to construct a proper ContractClass object
    if ContractClass:
        cc = ContractClass.loads(json.dumps(artifact))
    elif ContractClassSchema:
        cc = ContractClassSchema().load(artifact)
    else:
        cc = artifact

    print("ContractClass type:", type(cc))
    h = compute_class_hash(contract_class=cc)
    print("class_hash:", hex(h))


asyncio.run(main())
