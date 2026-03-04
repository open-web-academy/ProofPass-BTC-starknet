import subprocess
import json
import re
import os

ACCOUNT_ADDR = "0x064b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691"
DEVNET_URL = "http://127.0.0.1:5050"
ORACLE_PUB_KEY = "0x2f945185b4c6e1611cf3c1a6a82071537f44a1f021e1d3e86daaccccdbeee86"
ENV_LOCAL = "/mnt/c/Users/franc/Desktop/CloudMex/ProofPass-BTC-starknet/frontend/.env.local"
CONTRACTS_DIR = "/mnt/c/Users/franc/Desktop/CloudMex/ProofPass-BTC-starknet/contracts_v1"

def run_sncast(args):
    """Run sncast command with JSON output, returning parsed JSON line dicts."""
    cmd = ["sncast", "--json", "--account", "devnet"] + args + ["--url", DEVNET_URL]
    print(f">> {' '.join(cmd)}")
    
    # We must run inside CONTRACTS_DIR (where Scarb.toml is)
    result = subprocess.run(cmd, cwd=CONTRACTS_DIR, capture_output=True, text=True)
    
    parsed = []
    lines = (result.stdout + "\n" + result.stderr).strip().split("\n")
    for line in lines:
        if not line.strip(): continue
        try:
            parsed.append(json.loads(line))
        except BaseException as e:
            pass # Non-JSON output (like compiling messages)
        
    return parsed, result.returncode

def extract_hash(parsed, error_regex=r'hash (0x[0-9a-fA-F]+) is already declared'):
    """Extract class hash from successful return or from already-declared error."""
    for item in parsed:
        if item.get("type") == "error":
            msg = item.get("error", "")
            match = re.search(error_regex, msg)
            if match:
                return match.group(1)
        if item.get("type") == "message" and item.get("command") == "declare":
            # Success object usually has class_hash in "message" body 
            # something like {"command":"declare","message":{"class_hash":"0x..."...}}
            # Let's check format
            msgs = item.get("message", {})
            if isinstance(msgs, dict) and "class_hash" in msgs:
                return msgs["class_hash"]
                
    return None

def extract_address_and_tx(parsed):
    for item in parsed:
        if item.get("command") == "deploy" and "contract_address" in item:
            return item["contract_address"], item.get("transaction_hash")
    return None, None

def main():
    print(f"Working in: {CONTRACTS_DIR}\n")
    
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
    parsed, rc = run_sncast(["deploy", "--class-hash", class_hash_pv, "--constructor-calldata", ORACLE_PUB_KEY])
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
    }

    for k, v in updates.items():
        if not v: raise Exception(f"Missing variable {k}")
        pat = re.compile(rf"^{k}=.*$", re.MULTILINE)
        line = f"{k}={v}"
        env = pat.sub(line, env) if pat.search(env) else env + f"\n{line}"

    with open(ENV_LOCAL, "w") as f:
        f.write(env)

    print("Updated Variables:")
    for k, v in updates.items():
        print(f"  {k}={v}")

    print("\n✅ DEPLOYMENT COMPLETE!")
    print("Restart Next.js: ctrl+c then npm run dev")

if __name__ == "__main__":
    main()
