import subprocess
import json
import re
import os

# Root of the git repo (this file lives in scripts/)
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTRACTS_DIR = os.path.join(REPO_ROOT, "contracts_v1")
ENV_LOCAL = os.path.join(REPO_ROOT, "frontend", ".env.local")

# Account that will deploy on Starknet (must exist in sncast as alias "devnet")
ACCOUNT_ADDR = "0x064b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691"

# Network RPC URL; falls back to local devnet if STARKNET_RPC_URL is not set
DEVNET_URL = os.getenv("STARKNET_RPC_URL", "http://127.0.0.1:5050")

# Public key of the Oracle that signs proofs (must match ORACLE_PRIVATE_KEY used by the backend)
ORACLE_PUBLIC_KEY= "0x6eb62dc263aa156dd37a146aa1d1021357bfffa47ca23479a4c3844d9282ce6"

def run_sncast(args):
    """
    Run sncast command with JSON output, returning parsed JSON objects.
    NOTE: Newer sncast emits a JSON ARRAY on stdout, but also may emit line-JSON logs.
    We support both.
    """
    cmd = ["sncast", "--json", "--account", "devnet"] + args + ["--url", DEVNET_URL]
    print(f">> {' '.join(cmd)}")

    # We must run inside CONTRACTS_DIR (where Scarb.toml is)
    result = subprocess.run(cmd, cwd=CONTRACTS_DIR, capture_output=True, text=True)

    out = (result.stdout or "").strip()
    err = (result.stderr or "").strip()

    parsed = []

    # 1) First try: whole stdout is a JSON value (often a LIST)
    if out:
        try:
            obj = json.loads(out)
            if isinstance(obj, list):
                parsed.extend([x for x in obj if isinstance(x, dict)])
            elif isinstance(obj, dict):
                parsed.append(obj)
        except Exception:
            pass

    # 2) Second try: parse line-by-line from stdout + stderr (older behavior / mixed logs)
    lines = (out + "\n" + err).strip().split("\n")
    for line in lines:
        line = line.strip()
        if not line:
            continue
        try:
            item = json.loads(line)
            if isinstance(item, dict):
                parsed.append(item)
            elif isinstance(item, list):
                parsed.extend([x for x in item if isinstance(x, dict)])
        except Exception:
            # Non-JSON output (like compiling messages)
            pass

    return parsed, result.returncode


def extract_hash(parsed, error_regex=r'hash (0x[0-9a-fA-F]+) is already declared'):
    """
    Extract class hash from:
      - New sncast output: {"type":"response","command":"declare","class_hash":"0x..."}
      - Older output: {"command":"declare","message":{"class_hash":"0x..."}}
      - Already-declared error message, if it appears in an "error" object.
    """
    for item in parsed:
        if not isinstance(item, dict):
            continue

        # Already declared (some versions return an "error" object)
        if item.get("type") == "error":
            msg = item.get("error", "") or item.get("message", "")
            match = re.search(error_regex, msg)
            if match:
                return match.group(1)

        # New sncast output: response contains class_hash directly
        if item.get("type") == "response" and item.get("command") == "declare":
            if "class_hash" in item:
                return item["class_hash"]

        # Older format fallback: message dict contains class_hash
        if item.get("command") == "declare":
            msgs = item.get("message", {})
            if isinstance(msgs, dict) and "class_hash" in msgs:
                return msgs["class_hash"]

    return None


def extract_address_and_tx(parsed):
    """
    Extract deployed contract address + tx hash from:
      - New sncast output: {"type":"response","command":"deploy","contract_address":"0x...","transaction_hash":"0x..."}
      - Some variants use "address" instead of "contract_address".
      - Older format line logs.
    """
    for item in parsed:
        if not isinstance(item, dict):
            continue

        # New sncast output (preferred)
        if item.get("type") == "response" and item.get("command") == "deploy":
            addr = item.get("contract_address") or item.get("address")
            if addr:
                return addr, item.get("transaction_hash")

        # Fallback
        if item.get("command") == "deploy":
            addr = item.get("contract_address") or item.get("address")
            if addr:
                return addr, item.get("transaction_hash")

    return None, None


def main():
    print(f"Working in: {CONTRACTS_DIR}")
    print(f"Using RPC URL: {DEVNET_URL}\n")

    # --- 1. mock_erc20 ---
    print("=== Declaring MockERC20 ===")
    parsed, rc = run_sncast(["declare", "-c", "MockERC20"])
    class_hash_erc20 = extract_hash(parsed)
    if not class_hash_erc20:
        print("Failed to get MockERC20 class hash. Output:")
        print(json.dumps(parsed, indent=2))
        return
    print(f"MockERC20 Class Hash: {class_hash_erc20}\n")

    print("=== Deploying MockERC20 ===")
    calldata = [ACCOUNT_ADDR, "1000000000000000000000000", "0"]
    parsed, rc = run_sncast(["deploy", "--class-hash", class_hash_erc20, "--constructor-calldata"] + calldata)
    addr_erc20, tx_erc20 = extract_address_and_tx(parsed)
    if not addr_erc20:
        print("Failed to get MockERC20 address. Output:")
        print(json.dumps(parsed, indent=2))
        raise Exception("Failed MockERC20 addr")
    print(f"strkBTC Address: {addr_erc20}")
    print(f"Tx: {tx_erc20}\n")

    # --- 2. proof_verifier ---
    print("=== Declaring ProofVerifier ===")
    parsed, rc = run_sncast(["declare", "-c", "ProofVerifier"])
    class_hash_pv = extract_hash(parsed)
    if not class_hash_pv:
        print("Failed to get ProofVerifier class hash. Output:")
        print(json.dumps(parsed, indent=2))
        return
    print(f"ProofVerifier Class Hash: {class_hash_pv}\n")

    print("=== Deploying ProofVerifier ===")
    parsed, rc = run_sncast(["deploy", "--class-hash", class_hash_pv, "--constructor-calldata", ORACLE_PUBLIC_KEY])
    addr_pv, tx_pv = extract_address_and_tx(parsed)
    if not addr_pv:
        print("Failed to get ProofVerifier address. Output:")
        print(json.dumps(parsed, indent=2))
        raise Exception("Failed ProofVerifier addr")
    print(f"ProofVerifier Address: {addr_pv}")
    print(f"Tx: {tx_pv}\n")

    # --- 3. gate_adapter ---
    print("=== Declaring GateAdapter ===")
    parsed, rc = run_sncast(["declare", "-c", "GateAdapter"])
    class_hash_ga = extract_hash(parsed)
    if not class_hash_ga:
        print("Failed to get GateAdapter class hash. Output:")
        print(json.dumps(parsed, indent=2))
        return
    print(f"GateAdapter Class Hash: {class_hash_ga}\n")

    print("=== Deploying GateAdapter ===")
    parsed, rc = run_sncast(["deploy", "--class-hash", class_hash_ga, "--constructor-calldata", addr_erc20, addr_pv])
    addr_ga, tx_ga = extract_address_and_tx(parsed)
    if not addr_ga:
        print("Failed to get GateAdapter address. Output:")
        print(json.dumps(parsed, indent=2))
        raise Exception("Failed GateAdapter addr")
    print(f"GateAdapter Address: {addr_ga}")
    print(f"Tx: {tx_ga}\n")

    # --- 4. policy_registry ---
    print("=== Declaring PolicyRegistry ===")
    parsed, rc = run_sncast(["declare", "-c", "PolicyRegistry"])
    class_hash_pr = extract_hash(parsed)
    if not class_hash_pr:
        print("Failed to get PolicyRegistry class hash. Output:")
        print(json.dumps(parsed, indent=2))
        return
    print(f"PolicyRegistry Class Hash: {class_hash_pr}\n")

    print("=== Deploying PolicyRegistry ===")
    # Constructor takes owner_address; we use ACCOUNT_ADDR as owner
    parsed, rc = run_sncast([
        "deploy",
        "--class-hash", class_hash_pr,
        "--constructor-calldata", ACCOUNT_ADDR
    ])
    addr_pr, tx_pr = extract_address_and_tx(parsed)
    if not addr_pr:
        print("Failed to get PolicyRegistry address. Output:")
        print(json.dumps(parsed, indent=2))
        raise Exception("Failed PolicyRegistry addr")
    print(f"PolicyRegistry Address: {addr_pr}")
    print(f"Tx: {tx_pr}\n")

    # --- Update .env.local ---
    print("=== Updating .env.local ===")
    env = ""
    if os.path.exists(ENV_LOCAL):
        with open(ENV_LOCAL) as f:
            env = f.read()

    updates = {
        "NEXT_PUBLIC_STRKBTC_ADDRESS": addr_erc20,
        "NEXT_PUBLIC_PROOF_VERIFIER_ADDRESS": addr_pv,
        "NEXT_PUBLIC_GATE_ADAPTER_ADDRESS": addr_ga,
        "NEXT_PUBLIC_POLICY_REGISTRY_ADDRESS": addr_pr,
    }

    for k, v in updates.items():
        if not v:
            raise Exception(f"Missing variable {k}")
        pat = re.compile(rf"^{k}=.*$", re.MULTILINE)
        line = f"{k}={v}"
        env = pat.sub(line, env) if pat.search(env) else env + f"\n{line}"

    with open(ENV_LOCAL, "w") as f:
        f.write(env)

    print("Updated Variables in .env.local:")
    for k, v in updates.items():
        print(f"  {k}={v}")

    print("\n✅ DEPLOYMENT COMPLETE!")
    print("Restart Next.js: ctrl+c then npm run dev")


if __name__ == "__main__":
    main()
