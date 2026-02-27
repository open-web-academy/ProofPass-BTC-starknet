#!/usr/bin/env bash

set -euo pipefail

# ---------------------------------------------------------
# Required Environment Variables Validation
# ---------------------------------------------------------
if [[ -z "${DEPLOYER_ADDRESS:-}" ]]; then
  echo "Error: DEPLOYER_ADDRESS is not set."
  exit 1
fi

if [[ -z "${DEPLOYER_PRIVATE_KEY:-}" ]]; then
  echo "Error: DEPLOYER_PRIVATE_KEY is not set."
  exit 1
fi

if [[ -z "${STARKNET_RPC_URL:-}" ]]; then
  echo "Error: STARKNET_RPC_URL is not set."
  exit 1
fi

export PROTOSTAR_ACCOUNT_PRIVATE_KEY=$DEPLOYER_PRIVATE_KEY
export MAX_FEE="auto"

echo "========================================="
echo "   Compiling Starknet Contracts (Cairo 0)"
echo "========================================="

protostar build

# Check if artifacts are generated
if [ ! -d "build" ]; then
    echo "Error: 'build' directory not found. Compilation failed."
    exit 1
fi

if ! ls build/*.json 1> /dev/null 2>&1; then
    echo "Error: No .json artifacts found in 'build' directory."
    exit 1
fi

echo "✅ Compilation successful. Artifacts verified."
echo ""
echo "========================================="
echo "   Deploying Contracts to Starknet Sepolia"
echo "========================================="

# Función para extraer el output y detener si arroja error
deploy_contract() {
    local contract_name=$1
    shift
    local inputs=("$@")

    echo "Desplegando ${contract_name}..." >&2
    local output
    
    # Protostar uses STARKNET_RPC_URL under the hood if passed as argument.
    if [ ${#inputs[@]} -eq 0 ]; then
        output=$(protostar deploy "$contract_name" --gateway-url "$STARKNET_RPC_URL" --account-address "$DEPLOYER_ADDRESS" --max-fee $MAX_FEE 2>&1)
    else
        output=$(protostar deploy "$contract_name" --gateway-url "$STARKNET_RPC_URL" --account-address "$DEPLOYER_ADDRESS" --max-fee $MAX_FEE --inputs "${inputs[@]}" 2>&1)
    fi

    if [[ "$output" == *"Error"* || "$output" == *"Exception"* ]]; then
        echo "Error al desplegar ${contract_name}:" >&2
        echo "$output" >&2
        exit 1
    fi
    
    local address=$(echo "$output" | grep "Contract address:" | awk '{print $3}')
    if [[ -z "$address" ]]; then
        echo "No se pudo extraer el address para ${contract_name}. Output fue:" >&2
        echo "$output" >&2
        exit 1
    fi

    echo "✅ ${contract_name} despachado exitosamente en: $address" >&2
    echo "$address"
}

# 1. Deploy Mock ERC20 (args: initial_holder, initial_supply_low, initial_supply_high)
# Supply: 1,000,000 STRK/BTC con 18 decimales. (10^24) en hexadecimal o u256. 
# Cairo 0 pide ints como u256: 1000000000000000000000000 -> baja parte superior, 0 superior.
STRKBTC_ADDRESS=$(deploy_contract mock_erc20 "$DEPLOYER_ADDRESS" 1000000000000000000000000 0)
echo "STRKBTC_ADDRESS=$STRKBTC_ADDRESS"

# 2. Deploy PolicyRegistry (args: owner_address)
POLICY_REGISTRY_ADDRESS=$(deploy_contract policy_registry "$DEPLOYER_ADDRESS")

# 3. Deploy ProofVerifier (sin argumentos contructor)
PROOF_VERIFIER_ADDRESS=$(deploy_contract proof_verifier)

# 4. Deploy GateAdapter (args: erc20_address, verifier_address)
GATE_ADAPTER_ADDRESS=$(deploy_contract gate_adapter "$STRKBTC_ADDRESS" "$PROOF_VERIFIER_ADDRESS")

echo ""
echo "========================================="
echo "   Generando de Salidas y Registros"
echo "========================================="

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

cat <<EOF > deploy_output.json
{
  "mock_token": "$STRKBTC_ADDRESS",
  "policy_registry": "$POLICY_REGISTRY_ADDRESS",
  "proof_verifier": "$PROOF_VERIFIER_ADDRESS",
  "gate_adapter": "$GATE_ADAPTER_ADDRESS",
  "network": "$STARKNET_RPC_URL",
  "timestamp": "$TIMESTAMP"
}
EOF

echo "✅ Salida guardada en deploy_output.json"
echo ""
echo "========================================="
echo "   Comandos Export para entorno Frontend "
echo "========================================="
echo ""
echo "export NEXT_PUBLIC_STRKBTC_ADDRESS=$STRKBTC_ADDRESS"
echo "export NEXT_PUBLIC_GATE_ADAPTER_ADDRESS=$GATE_ADAPTER_ADDRESS"
echo "export NEXT_PUBLIC_POLICY_REGISTRY_ADDRESS=$POLICY_REGISTRY_ADDRESS"
echo "export NEXT_PUBLIC_PROOF_VERIFIER_ADDRESS=$PROOF_VERIFIER_ADDRESS"
echo ""
echo "Proceso Terminado de Forma Exitosa!"
