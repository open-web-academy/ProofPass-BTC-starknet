# Deployment Guide — ProofPass on Starknet Sepolia

This guide lets any developer deploy the full ProofPass contract suite to
Starknet Sepolia from scratch and wire up the Next.js frontend.

---

## Prerequisites

| Requirement | Version / Note |
|---|---|
| Node.js | ≥ 18 |
| Scarb | ≥ 2.6.0 — [install](https://docs.swmansion.com/scarb/download.html) |
| Starknet account | Argent X or Braavos wallet, **deployed on Sepolia** |
| STRK balance (Sepolia) | ~0.1 STRK is enough for 4 contract declarations + deploys |
| Git clone | This repo at any path |

### Get Sepolia STRK
1. Visit the [Starknet Sepolia faucet](https://starknet-faucet.vercel.app/)
2. Paste your wallet address and claim STRK + ETH

---

## Environment Variables

Export these before running the deploy script:

```bash
# Required
export STARKNET_PRIVATE_KEY=0x<your_private_key>

# Optional overrides (defaults shown)
export ACCOUNT_ADDRESS=0x054c172905114e7d0fdA1F4697B2D9837fe92C9C49F01ace4A5cA046901B227D
export STARKNET_RPC_URL=https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/MnGSA2Mjm9SFFPUCuXWdP
export ORACLE_PUBLIC_KEY=0x6eb62dc263aa156dd37a146aa1d1021357bfffa47ca23479a4c3844d9282ce6
```

> **Security**: Never commit `STARKNET_PRIVATE_KEY` to version control.
> The `ACCOUNT_ADDRESS` and `ORACLE_PUBLIC_KEY` are not secrets.

---

## Step 1 — Install Node dependencies (root)

```bash
cd /path/to/ProofPass-BTC-starknet
npm install
```

This installs `starknet@^6.24.1` used by the deploy script.

---

## Step 2 — Build Cairo contracts (release)

```bash
cd contracts_v1
scarb build --release
cd ..
```

The `--release` flag:
- Strips Sierra debug symbols (`sierra-replace-ids = false`)
- Removes statement-level debug info
- Reduces the compiled class size by ~20–30% vs the dev build

Artifacts are written to `contracts_v1/target/release/`:

| File | Description |
|---|---|
| `proofpass_contracts_MockERC20.contract_class.json` | Sierra class |
| `proofpass_contracts_MockERC20.compiled_contract_class.json` | CASM |
| `proofpass_contracts_ProofVerifier.*` | — |
| `proofpass_contracts_PolicyRegistry.*` | — |
| `proofpass_contracts_GateAdapter.*` | — |

---

## Step 3 — Deploy to Sepolia

```bash
node scripts/deploy_sepolia_final.js
```

The script will:

1. **Declare** each contract class on Sepolia (skips if already declared)
2. **Deploy** an instance of each contract in this order:
   - `MockERC20` — mock strkBTC token, mints 1 000 000 tokens to the deployer
   - `PolicyRegistry` — owner = deployer account
   - `ProofVerifier` — seeded with `ORACLE_PUBLIC_KEY`
   - `GateAdapter` — wired to MockERC20 + ProofVerifier
3. **Write** all addresses to `frontend/.env.local` automatically

Expected output (abbreviated):

```
══════════════════════════════════════════════════════════
  ProofPass — Starknet Sepolia Deployment
══════════════════════════════════════════════════════════
  Deployer : 0x054c...
  RPC      : https://starknet-sepolia.g.alchemy.com/.../<API_KEY>
  Artifacts: /path/to/contracts_v1/target/release

[──────────────────────────────────────────────────────]
  Contract    : MockERC20
  Class hash  : 0x...
  Declaring...
  Declare TX  : 0x...
  ✅ Declared
  Deploying...
  Deploy TX   : 0x...
  ✅ Deployed : 0x...

... (repeat for PolicyRegistry, ProofVerifier, GateAdapter)

══════════════════════════════════════════════════════════
  ✅ ALL CONTRACTS DEPLOYED SUCCESSFULLY
══════════════════════════════════════════════════════════
  MockERC20 (strkBTC)  : 0x...
  PolicyRegistry       : 0x...
  ProofVerifier        : 0x...
  GateAdapter          : 0x...
══════════════════════════════════════════════════════════

  ✅ frontend/.env.local updated
```

---

## Step 4 — Verify deployment (optional)

Open [Starkscan Sepolia](https://sepolia.starkscan.co/) and search each
address to confirm the contracts are visible and the class hash matches.

To verify the oracle key is set correctly:

```bash
# Using starkli (optional)
starkli call <PROOF_VERIFIER_ADDRESS> get_oracle_public_key --network sepolia
# Expected: 0x6eb62dc...
```

---

## Step 5 — Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000` with ArgentX or Braavos.

The `frontend/.env.local` was already written by the deploy script.
To inspect it:

```bash
cat frontend/.env.local
```

Expected content:

```env
NEXT_PUBLIC_STARKNET_RPC_URL=https://starknet-sepolia.g.alchemy.com/...
NEXT_PUBLIC_GATE_ADAPTER_ADDRESS=0x...
NEXT_PUBLIC_PROOF_VERIFIER_ADDRESS=0x...
NEXT_PUBLIC_STRKBTC_ADDRESS=0x...
NEXT_PUBLIC_POLICY_REGISTRY_ADDRESS=0x...
```

---

## Step 6 — Seed policies (optional)

To make the `/generate` page show real policies, call `register_policy` on
`PolicyRegistry` from the owner account:

```bash
# Example with starkli (policy_id=1, commitment=0xabc)
starkli invoke \
  <POLICY_REGISTRY_ADDRESS> \
  register_policy 1 0xabc \
  --account ~/.starknet_accounts/starknet_open_zeppelin_accounts.json \
  --network sepolia
```

Or use the frontend's `/dashboard` admin panel if implemented.

---

## Troubleshooting

### `-32603 Internal Error` from Alchemy or dRPC

This error usually means one of:

| Root cause | Fix |
|---|---|
| **Dev artifacts instead of release** | Ensure you ran `scarb build --release` (Step 2) |
| **`l1_data_gas` = 0** | Already fixed in `deploy_sepolia_final.js` (was a bug in older scripts) |
| **Class too large for node** | Use `--release` build; dev builds are 20-30% larger |
| **RPC node lag / transient** | Wait 30 s and retry; rotate to a different RPC endpoint |
| **Wrong constructor calldata** | Already fixed — old scripts passed wrong args to GateAdapter and ProofVerifier |

### `Error: STARKNET_PRIVATE_KEY is not set`

```bash
export STARKNET_PRIVATE_KEY=0x<your_key>
```

### `insufficient account balance` / `max fee too low`

Your account needs STRK on Sepolia. Visit the faucet (see Prerequisites above).

### `already declared` messages

This is not an error. The script detects previously-declared classes and skips
re-declaration, then proceeds to deploy a fresh instance.

### Artifacts not found

```bash
cd contracts_v1
scarb build --release
```

### Using a different RPC (dRPC, Infura, etc.)

```bash
export STARKNET_RPC_URL=https://starknet-sepolia.drpc.org
node scripts/deploy_sepolia_final.js
```

> The `patchProvider` function in the script handles the `pending` block tag
> quirk that affects Alchemy. Other providers typically work without it.

---

## Contract constructor summary

| Contract | Constructor arguments |
|---|---|
| `MockERC20` | `recipient: ContractAddress`, `initial_supply: u256` (passed as `[addr, low, high]`) |
| `PolicyRegistry` | `owner_address: ContractAddress` |
| `ProofVerifier` | `oracle_public_key: felt252` |
| `GateAdapter` | `strk_btc_address: ContractAddress`, `proof_verifier_address: ContractAddress` |

---

## File reference

| File | Purpose |
|---|---|
| `contracts_v1/Scarb.toml` | Cairo 2 build config (release profile added) |
| `contracts_v1/src/*.cairo` | Contract source code |
| `contracts_v1/target/release/` | Compiled artifacts (after `scarb build --release`) |
| `scripts/deploy_sepolia_final.js` | **This deploy script** |
| `frontend/.env.local` | Auto-written by deploy script; read by Next.js |
