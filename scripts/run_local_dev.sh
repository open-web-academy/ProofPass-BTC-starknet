#!/usr/bin/env bash
set -euo pipefail

# Run a local StarkNet devnet and deploy contracts for end-to-end testing.
# Requires starknet-devnet and protostar installed.

DEVNET_URL="http://127.0.0.1:5050"

echo "Starting starknet-devnet in background (if not already running)..."
if ! nc -z 127.0.0.1 5050; then
  starknet-devnet --host 127.0.0.1 --port 5050 --seed 0 &
  DEVNET_PID=$!
  echo "devnet PID: $DEVNET_PID"
  # Give devnet a few seconds to boot
  sleep 5
fi

echo "Compiling contracts..."
protostar build

echo "Deploying mock strkBTC token..."
MOCK_OWNER=0x1
INITIAL_SUPPLY_LOW=1000000000000000000
INITIAL_SUPPLY_HIGH=0
MOCK_STRKBTC_ADDRESS=$(protostar deploy mock_erc20 --network devnet --inputs "$MOCK_OWNER" "$INITIAL_SUPPLY_LOW" "$INITIAL_SUPPLY_HIGH" | awk '/Contract address/ {print $3}')
echo "Mock strkBTC deployed at: $MOCK_STRKBTC_ADDRESS"

echo "Deploying ProofVerifier..."
PROOF_VERIFIER_ADDRESS=$(protostar deploy proof_verifier --network devnet | awk '/Contract address/ {print $3}')
echo "ProofVerifier deployed at: $PROOF_VERIFIER_ADDRESS"

echo "Deploying GateAdapter..."
GATE_ADAPTER_ADDRESS=$(protostar deploy gate_adapter --network devnet --inputs "$MOCK_STRKBTC_ADDRESS" "$PROOF_VERIFIER_ADDRESS" | awk '/Contract address/ {print $3}')
echo "GateAdapter deployed at: $GATE_ADAPTER_ADDRESS"

echo ""
echo "=== Local devnet deployment summary ==="
echo "Mock strkBTC (ERC20): $MOCK_STRKBTC_ADDRESS"
echo "ProofVerifier:        $PROOF_VERIFIER_ADDRESS"
echo "GateAdapter:          $GATE_ADAPTER_ADDRESS"
echo ""
echo "Configure your frontend .env with:"
echo "NEXT_PUBLIC_STARKNET_RPC_URL=$DEVNET_URL"
echo "NEXT_PUBLIC_GATE_ADAPTER_ADDRESS=$GATE_ADAPTER_ADDRESS"
echo "NEXT_PUBLIC_PROOF_VERIFIER_ADDRESS=$PROOF_VERIFIER_ADDRESS"
echo "NEXT_PUBLIC_STRKBTC_ADDRESS=$MOCK_STRKBTC_ADDRESS"

