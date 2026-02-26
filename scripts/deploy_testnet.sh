#!/usr/bin/env bash
set -euo pipefail

# Placeholder deployment script for StarkNet testnet using Protostar.
# Replace STRKBTC_ADDRESS and OWNER_ADDRESS with real values before running.

NETWORK="alpha-goerli"

echo "Compiling contracts..."
protostar build

echo "Deploying PolicyRegistry..."
POLICY_REGISTRY_ADDRESS=$(protostar deploy policy_registry --network "$NETWORK" --inputs OWNER_ADDRESS | awk '/Contract address/ {print $3}')
echo "PolicyRegistry deployed at: $POLICY_REGISTRY_ADDRESS"

echo "Deploying ProofVerifier..."
PROOF_VERIFIER_ADDRESS=$(protostar deploy proof_verifier --network "$NETWORK" | awk '/Contract address/ {print $3}')
echo "ProofVerifier deployed at: $PROOF_VERIFIER_ADDRESS"

echo "Deploying GateAdapter..."
GATE_ADAPTER_ADDRESS=$(protostar deploy gate_adapter --network "$NETWORK" --inputs STRKBTC_ADDRESS "$PROOF_VERIFIER_ADDRESS" | awk '/Contract address/ {print $3}')
echo "GateAdapter deployed at: $GATE_ADAPTER_ADDRESS"

echo ""
echo "=== Deployment summary ==="
echo "PolicyRegistry:      $POLICY_REGISTRY_ADDRESS"
echo "ProofVerifier:       $PROOF_VERIFIER_ADDRESS"
echo "GateAdapter:         $GATE_ADAPTER_ADDRESS"
echo "STRKBTC token addr:  STRKBTC_ADDRESS (replace in script/.env)"

