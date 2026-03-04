#!/bin/bash
set -e
source ~/.bashrc

ACCOUNT_ADDR="0x064b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691"
DEVNET_URL="http://127.0.0.1:5050"
ORACLE_PUB_KEY="0x2db4a1af205ecbfba55c48ed43924eabd6a3de76657def20626abdb3af242d5"
ENV_LOCAL="/mnt/c/Users/franc/Desktop/CloudMex/ProofPass-BTC-starknet/frontend/.env.local"
CONTRACTS_DIR="/mnt/c/Users/franc/Desktop/CloudMex/ProofPass-BTC-starknet/contracts_v1"

cd "$CONTRACTS_DIR"
SNCAST_CMD="sncast --account devnet"

function declare_contract() {
    local name=$1
    echo "=== Declaring $name ==="
    # Run declare without failing bash if it returns non-zero
    out=$($SNCAST_CMD declare --contract-name $name --url $DEVNET_URL 2>&1) || true
    echo "$out"
    
    # Try to extract "class_hash: 0x..." (success case)
    h=$(echo "$out" | grep -oP 'class_hash: \K0x[0-9a-fA-F]+' | head -1)
    if [ -z "$h" ]; then
        # Try to extract "Class with hash 0x... is already declared" (error case)
        h=$(echo "$out" | grep -oP 'hash 0x[0-9a-fA-F]+ is already declared' | grep -oP '0x[0-9a-fA-F]+' | head -1)
    fi
    if [ -z "$h" ]; then
        echo "Failed to extract class hash for $name"
        exit 1
    fi
    echo "-> Class hash: $h"
    # return string via stdout trick doesn't work well with set -e, so we'll just set a global var
    export DECLARE_RES="$h"
}

declare_contract "MockERC20"
ERC20_CLASS=$DECLARE_RES

echo ""
echo "=== Deploying MockERC20 ==="
DEPLOY_OUT=$($SNCAST_CMD deploy --class-hash "$ERC20_CLASS" --constructor-calldata "$ACCOUNT_ADDR 1000000000000000000000000 0" --url $DEVNET_URL 2>&1) || true
echo "$DEPLOY_OUT"
ERC20_ADDR=$(echo "$DEPLOY_OUT" | grep -oP 'contract_address: \K0x[0-9a-fA-F]+' | head -1)
echo "strkBTC address: $ERC20_ADDR"

# ── 2. proof_verifier ──────────────────────────────────────────────────────
echo ""
declare_contract "ProofVerifier"
PV_CLASS=$DECLARE_RES

echo ""
echo "=== Deploying ProofVerifier ==="
DEPLOY_OUT=$($SNCAST_CMD deploy --class-hash "$PV_CLASS" --constructor-calldata "$ORACLE_PUB_KEY" --url $DEVNET_URL 2>&1) || true
echo "$DEPLOY_OUT"
PV_ADDR=$(echo "$DEPLOY_OUT" | grep -oP 'contract_address: \K0x[0-9a-fA-F]+' | head -1)
echo "ProofVerifier address: $PV_ADDR"

# ── 3. gate_adapter ────────────────────────────────────────────────────────
echo ""
declare_contract "GateAdapter"
GA_CLASS=$DECLARE_RES

echo ""
echo "=== Deploying GateAdapter ==="
DEPLOY_OUT=$($SNCAST_CMD deploy --class-hash "$GA_CLASS" --constructor-calldata "$ERC20_ADDR $PV_ADDR" --url $DEVNET_URL 2>&1) || true
echo "$DEPLOY_OUT"
GA_ADDR=$(echo "$DEPLOY_OUT" | grep -oP 'contract_address: \K0x[0-9a-fA-F]+' | head -1)
echo "GateAdapter address: $GA_ADDR"

# ── Update .env.local ──────────────────────────────────────────────────────
echo ""
echo "=== Updating .env.local ==="
python3 - << PYEOF
import re, os
env_path = "$ENV_LOCAL"
if os.path.exists(env_path):
    with open(env_path) as f:
        env = f.read()
else:
    env = ""

updates = {
    "NEXT_PUBLIC_STRKBTC_ADDRESS": "$ERC20_ADDR",
    "NEXT_PUBLIC_PROOF_VERIFIER_ADDRESS": "$PV_ADDR",
    "NEXT_PUBLIC_GATE_ADAPTER_ADDRESS": "$GA_ADDR",
}

for k, v in updates.items():
    if not v:
        continue
    pat = re.compile(rf"^{k}=.*$", re.MULTILINE)
    line = f"{k}={v}"
    env = pat.sub(line, env) if pat.search(env) else env + f"\n{line}"

with open(env_path, "w") as f:
    f.write(env)

print("Updated:")
for k, v in updates.items():
    print(f"  {k}={v}")
PYEOF

echo ""
echo "✅ DEPLOYMENT COMPLETE!"
