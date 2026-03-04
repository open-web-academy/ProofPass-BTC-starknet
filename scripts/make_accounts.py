import json, os

data = {
    "alpha-sepolia": {
        "devnet": {
            "address": "0x064b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691",
            "class_hash": "0x05b4b537eaa2399e3aa99c4e2e0208ebd6c71bc1467938cd52c798c601e43564",
            "deployed": True,
            "legacy": False,
            "private_key": "0x0000000000000000000000000000000071d7bb07b9a64f6f78ac4c816aff4da9",
            "public_key": "0x039d9e6ce352ad4530a0ef5d5a18fd3303c3606a7fa6ac5b620020ad681cc33b",
            "salt": "0x0",
            "type": "open_zeppelin"
        }
    }
}

path = os.path.expanduser("~/.starknet_accounts/starknet_open_zeppelin_accounts.json")
os.makedirs(os.path.dirname(path), exist_ok=True)
with open(path, "w") as f:
    json.dump(data, f, indent=2)

print(f"Written to: {path}")
