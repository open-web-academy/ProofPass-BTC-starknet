# Proof-of-Clean-Funds using strkBTC (Starknet)

Minimal repo for a hackathon prototype of **Proof-of-Clean-Funds using strkBTC** on Starknet.

- On-chain Cairo contracts (`contracts/`) for:
  - `PolicyRegistry`
  - `ProofVerifier`
  - `GateAdapter`
  - `MerkleUtils` helper library
  - `external_verifier` stub
  - `mock_erc20` (local strkBTC)
- Protostar tests (`tests/`) and scripts (`scripts/`)
- Next.js + TypeScript dApp (`frontend/`) with:
  - Wallet connect (Argent X / Braavos via `@starknet-react/core`)
  - `/generate` → simulate proof generation
  - `/deposit` → verify & deposit flow
  - `/dashboard` → compliance view (stubbed events)

> NOTE: Contracts are written in legacy StarkNet Cairo (`%lang starknet`) to keep the devnet / Protostar story simple and copy‑paste friendly for hackathon use.

---

## 1. Repo structure

- `contracts/`
  - `policy_registry.cairo`
  - `proof_verifier.cairo`
  - `gate_adapter.cairo`
  - `merkle_utils.cairo`
  - `external_verifier.cairo` (off-chain verifier stub)
  - `mocks/mock_erc20.cairo` (local strkBTC token)
- `tests/`
  - `test_proof_verifier.py`
  - `test_gate_adapter.py`
- `scripts/`
  - `deploy_testnet.sh`
  - `run_local_dev.sh`
- `protostar.toml`
- `frontend/` (Next.js app)

---

## 2. Contracts: overview

### PolicyRegistry

- Storage:
  - `policy_commitment(policy_id: felt) -> felt`
  - `owner() -> felt`
- Functions:
  - `constructor(owner_address: felt)` – sets OWNER_ADDRESS.
  - `register_policy(policy_id: felt, commitment: felt)` – **owner-only**.
  - `get_policy_commitment(policy_id: felt) -> felt`

### ProofVerifier

- Storage:
  - `used_nullifier(nullifier: felt) -> felt` (1 if used)
- Event:
  - `ProofVerified(proof_id: felt, policy_id: felt, tier: felt)`
- External:
  - `verify_and_register(proof_id, policy_id, public_inputs_len, public_inputs_ptr, proof_blob_ptr, nullifier, expiry_ts) -> (ok)`
- Behaviour:
  - Checks expiry: `expiry_ts >= get_block_timestamp()`
  - Checks `used_nullifier(nullifier) == 0`
  - Calls stub `call_external_verifier(proof_blob_ptr, public_inputs_ptr, public_inputs_len)` from `external_verifier.cairo`
  - Marks `used_nullifier(nullifier) = 1`
  - Emits `ProofVerified(proof_id, policy_id, tier)` with `tier = public_inputs_ptr` (first public input / tier).

### GateAdapter

- Storage:
  - `strk_btc_address() -> felt` (ERC20)
  - `proof_verifier_address() -> felt`
  - `balances(user: felt) -> Uint256` (demo balances)
- Interfaces:
  - `IProofVerifier.verify_and_register(...) -> (ok)`
  - `IERC20.transferFrom(sender, recipient, amount: Uint256) -> (success)`
- External:
  - `constructor(strk_btc_addr: felt, proof_verifier_addr: felt)`
  - `deposit(policy_id, proof_id, proof_blob_ptr, public_inputs_ptr, nullifier, expiry_ts, amount: Uint256)`
  - `get_balance(user) -> Uint256`
- Behaviour:
  - Calls `IProofVerifier.verify_and_register` with:
    - `public_inputs_len = 1`
    - `public_inputs_ptr = tier` (first public input)
  - Requires `ok == 1`
  - Calls `IERC20.transferFrom(sender=user, recipient=this, amount)`
  - Updates `balances[user] += amount`

### MerkleUtils

- `%lang starknet` helper lib:
  - `verify_merkle_proof(leaf, proof_ptr, proof_len, root) -> (ok)`
  - Uses `hash2` to iteratively hash leaf with proof siblings.

### External verifier stub

- `%lang cairo` helper:
  - `call_external_verifier(proof_blob_ptr, public_inputs_ptr, public_inputs_len) -> (ok)`
  - Returns `1` **iff** `proof_blob_ptr == 0x1`, else `0`.

---

## 3. Setting up Cairo / Protostar

Install (example):

```bash
pip install protostar==0.9.1
```

Check:

```bash
protostar --version
```

### Compile contracts

From repo root:

```bash
protostar build
```

### Run tests

There are three key tests:

- `test_verify_register_ok`
- `test_replay_nullifier`
- `test_deposit_flow`

Run them all:

```bash
protostar test
```

---

## 4. Local devnet deployment (mock strkBTC)

This uses `starknet-devnet` + Protostar.

### 4.1 Start devnet and deploy contracts

From repo root:

```bash
chmod +x scripts/run_local_dev.sh
./scripts/run_local_dev.sh
```

The script will:

- Start `starknet-devnet` on `http://127.0.0.1:5050` (if not running)
- Compile contracts
- Deploy:
  - `mock_erc20` (mock strkBTC) → `MOCK_STRKBTC_ADDRESS`
  - `proof_verifier` → `PROOF_VERIFIER_ADDRESS`
  - `gate_adapter` wired with the above → `GATE_ADAPTER_ADDRESS`

At the end it prints addresses and copy‑paste lines to configure the frontend `.env`.

> **Variables to fill (contracts side)**  
> - `STRKBTC_ADDRESS`: use the real strkBTC on testnet or `MOCK_STRKBTC_ADDRESS` from devnet  
> - `OWNER_ADDRESS`: passed to `PolicyRegistry.constructor` when deploying

### 4.2 Deploy to testnet (placeholder)

For alpha-goerli or other testnet, adjust the network name and inputs in:

- `scripts/deploy_testnet.sh`

Then:

```bash
chmod +x scripts/deploy_testnet.sh
./scripts/deploy_testnet.sh
```

Replace:

- `STRKBTC_ADDRESS` with the real token address
- `OWNER_ADDRESS` with your compliance owner account

---

## 5. Frontend (Next.js dApp)

The Next.js app lives in `frontend/`.

### 5.1 Install dependencies

```bash
cd frontend
npm install
```

### 5.2 Configure environment (.env)

Copy the example:

```bash
cd frontend
cp .env.example .env.local
```

Edit `.env.local`:

```bash
NEXT_PUBLIC_STARKNET_RPC_URL=http://127.0.0.1:5050      # or your devnet/testnet RPC
NEXT_PUBLIC_GATE_ADAPTER_ADDRESS=0xGATE_ADAPTER_ADDRESS
NEXT_PUBLIC_PROOF_VERIFIER_ADDRESS=0xPROOF_VERIFIER_ADDRESS
NEXT_PUBLIC_STRKBTC_ADDRESS=0xSTRKBTC_ADDRESS
NEXT_PUBLIC_POLICY_REGISTRY_ADDRESS=0xPOLICY_REGISTRY_ADDRESS
```

Use the addresses printed by `run_local_dev.sh` or `deploy_testnet.sh`.

### 5.3 Run the app

From `frontend/`:

```bash
npm run dev
```

Open `http://localhost:3000` in a browser with **Argent X** or **Braavos** installed.

Scripts:

- `npm run dev` – start dev server
- `npm run build` – production build
- `npm run start` – run production server
- `npm run test` – run minimal Jest test for `/api/generate-proof`

---

## 6. Frontend pages & flows

### `/` (Home)

- Connect / disconnect wallet (Argent X / Braavos via `@starknet-react/core`)
- Shows connected address
- Links to:
  - `/generate`
  - `/deposit`
  - `/dashboard`

### `/generate`

- Form:
  - **Policy selector** – loads from `PolicyRegistry` via `/api/policies`
  - **Validity** – `24h` or `7d`
  - **Amount** (optional, used only for demo / UI)
- On **Generate Proof**:
  - Calls `POST /api/generate-proof` with `{ walletAddress, policy_id, validity, amount }`
  - Endpoint returns:
    ```json
    {
      "proof_id": "...",
      "policy_id": "...",
      "tier": 1,
      "proof_blob_hex": "0x1",
      "public_inputs": ["1"],
      "nullifier": "0x...",
      "expiry_ts": 1234567890,
      "amount": "..."
    }
    ```
  - Uses:
    - `proof_blob_hex = "0x1"` → activates stub `call_external_verifier`
    - `tier = public_inputs[0]`
    - `nullifier = keccak-like SHA-256(wallet || policy || nonce)`
- UI:
  - Shows proof details (ID, policy, tier, expiry, nullifier, amount)
  - Button **Use in dApp** → stores proof in `localStorage` for `/deposit`

### `/deposit`

- Auto-populates from stored proof (if present)
- Button **Verify & Deposit**:
  1. Builds a `deposit` call to `GateAdapter` with:
     - `policy_id` from proof
     - `proof_id` from proof
     - `proof_blob_ptr = 0x1` (stub accepted value)
     - `public_inputs_ptr = tier` (first public input)
     - `nullifier` from proof
     - `expiry_ts` from proof
     - `amount` as simple Uint256 (derived from proof amount or default)
  2. Sends tx via `@starknet-react/core` / `useSendTransaction`
  3. Shows tx hash / status message (Metamask-style error if something fails)

> **On-chain behaviour**: `GateAdapter.deposit` always calls `ProofVerifier.verify_and_register` first and reverts if `ok != 1`.

### `/dashboard`

- Shows simple stats:
  - `verified_count` (number of events, currently stubbed)
  - `blocked_count` (simulated)
- Table of `ProofVerified` events is currently a stub; replace `fetcher` in
  `app/dashboard/page.tsx` with a `getEvents` RPC call for real dashboards.

---

## 7. Next.js API routes

### `/api/generate-proof` (POST)

- Input JSON:

```json
{
  "walletAddress": "0x...",
  "policy_id": "1",
  "validity": "24h | 7d",
  "amount": "optional string"
}
```

- Behaviour:
  - Computes `expiry_ts` based on validity
  - Generates random `proof_id`
  - Derives `nullifier = keccak(wallet || policy || nonce)` using SHA-256 for demo
  - Returns:
    - `proof_id`
    - `policy_id`
    - `tier` (fixed `1` for demo)
    - `proof_blob_hex = "0x1"` (accepted by stub)
    - `public_inputs = ["1"]`
    - `nullifier`
    - `expiry_ts`
    - `amount`

### `/api/policies` (GET)

- Reads policies via RPC from `PolicyRegistry`:
  - Uses a small ABI for `get_policy_commitment`
  - Queries a fixed set of policy IDs: `["1", "2", "3"]`
  - Returns:

```json
{
  "policies": [
    { "id": "1", "commitment": "0x..." },
    { "id": "2", "commitment": "0x..." },
    { "id": "3", "commitment": "0x..." }
  ]
}
```

---

## 8. Demo script (3 minutos)

Assuming:

- `starknet-devnet` running (`./scripts/run_local_dev.sh`)
- Contracts deployed (addresses wired into `frontend/.env.local`)
- `npm run dev` running in `frontend/`

### Paso 1 – Conectar Wallet

1. Abrir `http://localhost:3000`
2. En la Home:
   - Click en **Connect ArgentX** o **Connect Braavos**
   - Ver la dirección conectada en la UI

### Paso 2 – Generar Proof

1. Ir a `/generate`
2. Seleccionar política, por ejemplo `policy_id = "1"` (standard)
3. Elegir **Validity: 24h**
4. (Opcional) Especificar `Amount`, por ejemplo `0.5`
5. Click en **Generate Proof**
6. Ver en la UI:
   - `Proof ID`
   - `Policy ID`
   - `Tier` (1)
   - `Expiry`
   - `Nullifier`
7. Click en **Use in dApp (save locally)** para guardar la prueba en `localStorage`

### Paso 3 – Verify & Deposit

1. Ir a `/deposit`
2. Confirmar que el `Proof ID` aparece auto-completado y los demás datos se ven en la tarjeta.
3. Asegurarse que el usuario tiene strkBTC mock y que el `GateAdapter` está aprobado
   (en un entorno real harías `approve` desde el wallet/token UI; en este prototipo
   el approve se hace desde el test y desde un flujo separado si se desea extender).
4. Click en **Verify & Deposit**
5. Firmar la transacción en ArgentX / Braavos
6. Ver en la UI el hash de la transacción (`txid`) y, opcionalmente, abrir el explorador
   (agregar el link de explorer adecuado según la red)
7. En la cadena:
   - El contrato `ProofVerifier` emite `ProofVerified`
   - El `GateAdapter` aumenta el balance interno del usuario (`get_balance`)

### Paso 4 – Dashboard

1. Ir a `/dashboard`
2. Ver:
   - `Verified proofs` incrementado (simulado / a conectar con eventos reales)
   - `Blocked attempts` (simulado)
3. Contar la historia de compliance: cada depósito está ligado a un `ProofVerified`
   con `policy_id` y `tier`, sin revelar el historial completo del usuario.

---

## 9. Notas finales

- **STRKBTC_ADDRESS**:
  - En devnet: usar el `MOCK_STRKBTC_ADDRESS` del script `run_local_dev.sh`
  - En testnet: remplazar por el address real de strkBTC
- **OWNER_ADDRESS**:
  - Address del account que controla `PolicyRegistry.register_policy`
- El stub `external_verifier.cairo` permite activar/verificar cualquier prueba con
  `proof_blob_ptr == 0x1`, lo que simplifica la demo sin un ZK verifier real.

