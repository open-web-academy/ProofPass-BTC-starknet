'use strict';
/**
 * deploy_sepolia_final.js
 *
 * Deploys ProofPass contracts to Starknet Sepolia (0.13.1-compatible).
 * Uses release build artifacts and correct V3 resource bounds.
 *
 * PREREQUISITES:
 *   1. STARKNET_PRIVATE_KEY set as environment variable
 *   2. Account has STRK balance on Sepolia for fees
 *   3. Release artifacts exist: run `scarb build --release` in contracts_v1/
 *
 * USAGE:
 *   cd /path/to/ProofPass-BTC-starknet
 *   npm install                          # install starknet.js if not already done
 *   export STARKNET_PRIVATE_KEY=0x...
 *   node scripts/deploy_sepolia_final.js
 *
 * OPTIONAL ENV VARS:
 *   STARKNET_RPC_URL    — override RPC endpoint (default: Alchemy Sepolia)
 *   ACCOUNT_ADDRESS     — override deployer account (default: starkli_account.json address)
 *   ORACLE_PUBLIC_KEY   — oracle server's public key for ProofVerifier
 */

const { RpcProvider, Account, json, constants, hash } = require('starknet');
const fs   = require('fs');
const path = require('path');

// ─── Configuration ────────────────────────────────────────────────────────────

const RPC_URL = process.env.STARKNET_RPC_URL
  || 'https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/MnGSA2Mjm9SFFPUCuXWdP';

const ACCOUNT_ADDR = process.env.ACCOUNT_ADDRESS
  || '0x054c172905114e7d0fdA1F4697B2D9837fe92C9C49F01ace4A5cA046901B227D';

const PRIVKEY = process.env.STARKNET_PRIVATE_KEY;

// Oracle server public key — must match the backend /api/generate-proof signer.
const ORACLE_PUBLIC_KEY = process.env.ORACLE_PUBLIC_KEY
  || '0x6eb62dc263aa156dd37a146aa1d1021357bfffa47ca23479a4c3844d9282ce6';

// MockERC20 initial supply: 1,000,000 tokens with 18 decimals (10^24)
// u256 is passed as two felt252 values: [low_128, high_128]
const _SUPPLY     = BigInt('1000000') * BigInt('1000000000000000000'); // 10^24
const _MASK128    = (BigInt(1) << BigInt(128)) - BigInt(1);
const SUPPLY_LOW  = '0x' + (_SUPPLY & _MASK128).toString(16);   // < 2^128, fits in low
const SUPPLY_HIGH = '0x' + (_SUPPLY >> BigInt(128)).toString(16); // 0

// Release artifacts directory
const ARTIFACTS_DIR = path.join(__dirname, '..', 'contracts_v1', 'target', 'release');

// Frontend environment file
const ENV_LOCAL = path.join(__dirname, '..', 'frontend', '.env.local');

// ─── Resource bounds for Starknet 0.13.1 V3 transactions ─────────────────────
//
// These values are intentionally generous. Actual fees will be much lower.
// Starknet 0.13.1 requires all three fields; l1_data_gas must NOT be 0x0 amount
// when declaring large contract classes (the node charges data gas for class bytes).
//
//   l1_gas:      execution gas  (5.2M units @ 10 Gfri)
//   l2_gas:      L2 execution   (not used for declare)
//   l1_data_gas: L1 data posts  (512K units @ 20 Gfri — covers ~512KB class data)
//
const RESOURCE_BOUNDS = {
  l1_gas: {
    max_amount:        '0x500000',      // 5,242,880 gas units
    max_price_per_unit:'0x2540be400',   // 10 Gfri/unit
  },
  l2_gas: {
    max_amount:        '0x0',
    max_price_per_unit:'0x0',
  },
  l1_data_gas: {
    max_amount:        '0x80000',       // 524,288 data-gas units
    max_price_per_unit:'0x4a817c800',   // 20 Gfri/unit
  },
};

// ─── Alchemy compatibility patch ─────────────────────────────────────────────
// Alchemy's Sepolia endpoint does not support the "pending" block tag.
// This patch transparently converts all "pending" references to "latest".
function patchProvider(provider) {
  const ch   = provider.channel;
  const orig = ch.fetch.bind(ch);
  const fix  = (v) => {
    if (v === 'pending') return 'latest';
    if (v && typeof v === 'object' && v.block_id === 'pending') return { ...v, block_id: 'latest' };
    return v;
  };
  ch.fetch = async (method, params, id) => {
    if (Array.isArray(params))          params = params.map(fix);
    else if (params && typeof params === 'object') params = fix(params);
    return orig(method, params, id);
  };
}

// ─── Deploy helper ────────────────────────────────────────────────────────────
async function deployContract(account, contractName, constructorCalldata = []) {
  const sierraPath = path.join(ARTIFACTS_DIR, `proofpass_contracts_${contractName}.contract_class.json`);
  const casmPath   = path.join(ARTIFACTS_DIR, `proofpass_contracts_${contractName}.compiled_contract_class.json`);

  if (!fs.existsSync(sierraPath) || !fs.existsSync(casmPath)) {
    throw new Error(
      `Artifacts for "${contractName}" not found in ${ARTIFACTS_DIR}.\n` +
      `  Expected: proofpass_contracts_${contractName}.contract_class.json\n` +
      `  Run: cd contracts_v1 && scarb build --release`
    );
  }

  const sierra    = json.parse(fs.readFileSync(sierraPath, 'utf8'));
  const casm      = json.parse(fs.readFileSync(casmPath,   'utf8'));
  const classHash = hash.computeSierraContractClassHash(sierra);

  console.log(`\n[${'─'.repeat(50)}]`);
  console.log(`  Contract    : ${contractName}`);
  console.log(`  Class hash  : ${classHash}`);

  // ── Declare ──────────────────────────────────────────────────────────────
  try {
    console.log(`  Declaring...`);
    const { transaction_hash: declTx } = await account.declare(
      { contract: sierra, casm },
      { version: 3, resourceBounds: RESOURCE_BOUNDS }
    );
    console.log(`  Declare TX  : ${declTx}`);
    await account.waitForTransaction(declTx);
    console.log(`  ✅ Declared`);
  } catch (e) {
    if (e.message && e.message.toLowerCase().includes('already declared')) {
      console.log(`  ✅ Already declared — skipping`);
    } else {
      throw e;
    }
  }

  // ── Deploy ───────────────────────────────────────────────────────────────
  const salt = '0x' + Math.floor(Math.random() * 0xFFFFFF).toString(16);
  console.log(`  Deploying...`);
  const { transaction_hash: depTx, contract_address } = await account.deployContract(
    { classHash, constructorCalldata, salt },
    { version: 3, resourceBounds: RESOURCE_BOUNDS }
  );
  console.log(`  Deploy TX   : ${depTx}`);
  await account.waitForTransaction(depTx);
  console.log(`  ✅ Deployed : ${contract_address}`);

  return contract_address;
}

// ─── Update frontend/.env.local ───────────────────────────────────────────────
function updateEnvLocal(addresses) {
  let content = fs.existsSync(ENV_LOCAL) ? fs.readFileSync(ENV_LOCAL, 'utf8') : '';

  const vars = {
    NEXT_PUBLIC_STARKNET_RPC_URL         : RPC_URL,
    NEXT_PUBLIC_GATE_ADAPTER_ADDRESS     : addresses.GateAdapter,
    NEXT_PUBLIC_PROOF_VERIFIER_ADDRESS   : addresses.ProofVerifier,
    NEXT_PUBLIC_STRKBTC_ADDRESS          : addresses.MockERC20,
    NEXT_PUBLIC_POLICY_REGISTRY_ADDRESS  : addresses.PolicyRegistry,
  };

  for (const [key, value] of Object.entries(vars)) {
    const re   = new RegExp(`^#?${key}=.*$`, 'm');
    const line = `${key}=${value}`;
    content    = re.test(content) ? content.replace(re, line) : content + `\n${line}`;
  }

  fs.writeFileSync(ENV_LOCAL, content.replace(/^\n+/, ''));
  console.log(`\n  ✅ frontend/.env.local updated`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (!PRIVKEY) {
    console.error('❌ STARKNET_PRIVATE_KEY is not set.\n   export STARKNET_PRIVATE_KEY=0x...');
    process.exit(1);
  }

  if (!fs.existsSync(ARTIFACTS_DIR)) {
    console.error(`❌ Release artifacts directory not found:\n   ${ARTIFACTS_DIR}`);
    console.error('   Run: cd contracts_v1 && scarb build --release');
    process.exit(1);
  }

  const provider = new RpcProvider({
    nodeUrl : RPC_URL,
    chainId : constants.StarknetChainId.SN_SEPOLIA,
  });
  patchProvider(provider);

  const account = new Account(provider, ACCOUNT_ADDR, PRIVKEY);

  const rpcDisplay = RPC_URL.replace(/\/[A-Za-z0-9_-]{20,}$/, '/<API_KEY>');
  console.log('\n' + '═'.repeat(60));
  console.log('  ProofPass — Starknet Sepolia Deployment');
  console.log('═'.repeat(60));
  console.log(`  Deployer : ${ACCOUNT_ADDR}`);
  console.log(`  RPC      : ${rpcDisplay}`);
  console.log(`  Artifacts: ${ARTIFACTS_DIR}`);

  const addresses = {};

  try {
    // 1. MockERC20
    //    constructor(recipient: ContractAddress, initial_supply: u256)
    //    u256 is serialized as [low: felt252, high: felt252]
    addresses.MockERC20 = await deployContract(account, 'MockERC20', [
      ACCOUNT_ADDR,  // recipient (gets the initial supply)
      SUPPLY_LOW,    // initial_supply.low  (10^24 fits in 128 bits → high = 0)
      SUPPLY_HIGH,   // initial_supply.high
    ]);

    // 2. PolicyRegistry
    //    constructor(owner_address: ContractAddress)
    addresses.PolicyRegistry = await deployContract(account, 'PolicyRegistry', [
      ACCOUNT_ADDR,  // owner
    ]);

    // 3. ProofVerifier
    //    constructor(oracle_public_key: felt252)
    addresses.ProofVerifier = await deployContract(account, 'ProofVerifier', [
      ORACLE_PUBLIC_KEY,
    ]);

    // 4. GateAdapter
    //    constructor(strk_btc_address: ContractAddress, proof_verifier_address: ContractAddress)
    //    NOTE: only 2 arguments — token address and verifier address.
    addresses.GateAdapter = await deployContract(account, 'GateAdapter', [
      addresses.MockERC20,     // strk_btc_address
      addresses.ProofVerifier, // proof_verifier_address
    ]);

    // ── Summary ──────────────────────────────────────────────────────────────
    console.log('\n' + '═'.repeat(60));
    console.log('  ✅ ALL CONTRACTS DEPLOYED SUCCESSFULLY');
    console.log('═'.repeat(60));
    console.log(`  MockERC20 (strkBTC)  : ${addresses.MockERC20}`);
    console.log(`  PolicyRegistry       : ${addresses.PolicyRegistry}`);
    console.log(`  ProofVerifier        : ${addresses.ProofVerifier}`);
    console.log(`  GateAdapter          : ${addresses.GateAdapter}`);
    console.log('═'.repeat(60));

    // ── Write frontend/.env.local ─────────────────────────────────────────
    updateEnvLocal(addresses);

    console.log('\n  Next steps:');
    console.log('  1. cd frontend && npm run dev');
    console.log('  2. Open http://localhost:3000 with ArgentX/Braavos');

  } catch (err) {
    console.error('\n❌ Deployment failed:', err.message || err);
    if (err.data) console.error('   Details:', JSON.stringify(err.data, null, 2));
    console.error('\n  Troubleshooting:');
    console.error('  • -32603 Internal Error → see DEPLOY.md § Troubleshooting');
    console.error('  • Insufficient fee      → account needs STRK on Sepolia');
    console.error('  • Artifacts missing     → run: cd contracts_v1 && scarb build --release');
    process.exit(1);
  }
}

main();
