import json, os, secrets

# 1. Generate random private key in valid range
private_key_int = secrets.randbelow(3618502788666131213697322783095070105526743751716087489154079457884512865583 - 1) + 1
private_key = hex(private_key_int)

# Use dummy values for remaining OpenZeppelin account fields since sncast deploy account will compute the actual address.
# We just need sncast to be able to read the PK and Public Key from the keystore.
# To keep it simple, we use a placeholder public key and address until the CLI computes it.

data = {
    "alpha-sepolia": {
        "sepolia-deployer": {
            "address": "0x0", # Will be computed upon deployment
            "class_hash": "0x00e1cc938f32ac91aa795f70bb7fe1cc97d26bb4dc8ce015847e3a1bcde41b99", # OZ v0.9.0 class hash roughly
            "deployed": False,
            "legacy": False,
            "private_key": private_key,
            "public_key": "0x0", # sncast doesn't strictly need us to precompute it here for 'account create' bypass
            "salt": "0x0",
            "type": "open_zeppelin"
        }
    }
}

path = os.path.expanduser("~/.starknet_accounts/starknet_open_zeppelin_accounts.json")
# Read existing if available
if os.path.exists(path):
    with open(path, "r") as f:
        existing = json.load(f)
        if "alpha-sepolia" not in existing:
            existing["alpha-sepolia"] = {}
        existing["alpha-sepolia"]["sepolia-deployer"] = data["alpha-sepolia"]["sepolia-deployer"]
        data = existing

os.makedirs(os.path.dirname(path), exist_ok=True)
with open(path, "w") as f:
    json.dump(data, f, indent=2)

print(f"Deployer Private Key (Keep Secret!): {private_key}")
print(f"Written to: {path}")
