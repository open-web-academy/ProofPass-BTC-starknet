const { RpcProvider, Account, json, CallData } = require('starknet');
const fs = require('fs');
const path = require('path');

// Public dRPC endpoint - stable for v5
const RPC = 'https://starknet-sepolia.drpc.org';
const ACCOUNT_ADDR = '0x054c172905114e7d0fdA1F4697B2D9837fe92C9C49F01ace4A5cA046901B227D';
const PRIVKEY = process.env.STARKNET_PRIVATE_KEY || '0x05fba985b63743a18ca48b48efb89662b2cc1c3c5c5e3296e6e6b4d33c709ede';

const targetDir = path.join(process.cwd(), 'contracts_v1/target/dev');
const hashes = JSON.parse(fs.readFileSync('hashes.json', 'utf8'));

async function deployContract(account, name, constructorCalldata = []) {
    const sierraPath = path.join(targetDir, `proofpass_contracts_${name}.contract_class.json`);
    const casmPath = path.join(targetDir, `proofpass_contracts_${name}.compiled_contract_class.json`);

    const sierra = json.parse(fs.readFileSync(sierraPath, 'utf8'));
    const casm = json.parse(fs.readFileSync(casmPath, 'utf8'));

    // We use the pre-computed class hash from v6
    const classHash = hashes[name].classHash;

    console.log(`\n--- Processing ${name} ---`);
    console.log(`  Target Class Hash: ${classHash}`);

    try {
        console.log(`  Declaring...`);
        // v5.24.3: pass { contract, casm }
        // Note: v5 might try to re-compute the hash inside declare()
        // If it computes a different hash (because it doesn't support Sierra 1.8.0), it will fail.
        // But if it's already declared, we can just skip to deploy.
        const d = await account.declare({ contract: sierra, casm: casm });
        console.log(`  Waiting for Declare TX: ${d.transaction_hash}...`);
        await account.waitForTransaction(d.transaction_hash);
        console.log(`  ✅ Declared`);
    } catch (e) {
        if (e.message.includes('already declared') || e.message.includes('Class already declared')) {
            console.log(`  ✅ Already declared (verified)`);
        } else {
            console.warn(`  [Warning] Declare failed but continuing:`, e.message);
            // If declare fails because v5 can't hash Sierra 1.8.0, 
            // we still have the correct classHash from v6, so we can try to deploy!
        }
    }

    const salt = '0x' + Math.floor(Math.random() * 1000000).toString(16) + '00';
    console.log(`  Deploying (salt ${salt})...`);
    // v5 account.deployContract uses classHash directly!
    const { transaction_hash, contract_address } = await account.deployContract({
        classHash,
        constructorCalldata,
        salt
    });

    console.log(`  Waiting for Deploy TX: ${transaction_hash}...`);
    await account.waitForTransaction(transaction_hash);
    // In v5, contract_address is usually a string or an array of one string
    const finalAddress = Array.isArray(contract_address) ? contract_address[0] : contract_address;
    console.log(`  ✅ Deployed at: ${finalAddress}`);

    return finalAddress;
}

async function main() {
    const provider = new RpcProvider({ nodeUrl: RPC });
    const account = new Account(provider, ACCOUNT_ADDR, PRIVKEY);

    console.log('Using account:', ACCOUNT_ADDR);
    const addresses = {};

    try {
        addresses.MockERC20 = await deployContract(account, 'MockERC20', [
            '0x' + Buffer.from('MockSTRK').toString('hex'),
            '0x' + Buffer.from('STRK').toString('hex'),
            ACCOUNT_ADDR
        ]);

        addresses.PolicyRegistry = await deployContract(account, 'PolicyRegistry');
        addresses.ProofVerifier = await deployContract(account, 'ProofVerifier');

        addresses.GateAdapter = await deployContract(account, 'GateAdapter', [
            addresses.PolicyRegistry,
            addresses.ProofVerifier,
            addresses.MockERC20
        ]);

        console.log('\n--- ALL DEPLOYED SUCCESSFULLY (Hybrid Strategy) ---');
        console.log(`NEXT_PUBLIC_GATE_ADAPTER_ADDRESS=${addresses.GateAdapter}`);
        console.log(`NEXT_PUBLIC_PROOF_VERIFIER_ADDRESS=${addresses.ProofVerifier}`);
        console.log(`NEXT_PUBLIC_STRKBTC_ADDRESS=${addresses.MockERC20}`);
        console.log(`NEXT_PUBLIC_POLICY_REGISTRY_ADDRESS=${addresses.PolicyRegistry}`);

    } catch (err) {
        console.error('\n❌ FATAL:', err.message || err);
        if (err.data) console.error('Data:', JSON.stringify(err.data));
        process.exit(1);
    }
}

main();
