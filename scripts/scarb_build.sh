#!/bin/bash

# Load user environment (optional, but kept from original script)
if [ -f "$HOME/.bashrc" ]; then
  # shellcheck source=/dev/null
  source "$HOME/.bashrc"
fi

# Move to contracts_v1 relative to this script's location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../contracts_v1" || exit 1

scarb build 2>&1
