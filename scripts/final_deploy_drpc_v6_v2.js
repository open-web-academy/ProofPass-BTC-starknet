const { RpcProvider, Account, json, constants, hash, CallData } = require('starknet');
const fs = require('fs');
const path = require('path');

// Public dRPC endpoint
const RPC = 'https://starknet-sepolia.drpc.org';
const ACCOUNT_ADDR = '0x054c172905114e7d0fdA1F4697B2D9837fe92C9C49F01ace4A5cA046901B227D';
const PRIVKEY = process.env.STARKNET_PRIVATE_KEY || '0x05fba985b63743a18ca48b48efb89662b2cc1c3c5c5e3296e6e6b4d33c709ede';

const targetDir = path.join(process.cwd(), 'contracts_v1/target/dev');

// GLOBAL FETCH PROXY - TOTAL SPEC ALIGNMENT
const originalFetch = global.fetch;
global.fetch = async function (url, options) {
    if (options && options.body && (options.body.includes('starknet_addDeclareTransaction') || options.body.includes('starknet_addInvokeTransaction'))) {
        let body = JSON.parse(options.body);

        const cleanV2 = (obj) => {
            if (typeof obj !== 'object' || obj === null) return obj;
            if (Array.isArray(obj)) return obj.map(cleanV2);

            // If it's a v2 or v1 transaction, strip ALL V3-specific fields that might have bled in
            const version = obj.version || '';
            const isLegacy = version === '0x2' || version === '0x1' || version === '0x0';

            const res = {};
            for (const k in obj) {
                if (isLegacy) {
                    // Strip V3 fields
                    if (k === 'tip' || k === 'paymaster_data' || k === 'account_deployment_data' ||
                        k === 'nonce_data_availability_mode' || k === 'fee_data_availability_mode' ||
                        k === 'resource_bounds' || k === 'type') {
                        continue;
                    }
                }

                let val = obj[k];
                // Force strip query bit from ANY version
                if (k === 'version' && typeof val === 'string' && val.length > 30) {
                    val = '0x' + (BigInt(val) & ((1n << 128n) - 1n)).toString(16);
                }
                res[k] = cleanV2(val);
            }
            return res;
        };

        const cleanedBody = cleanV2(body);
        options.body = JSON.stringify(cleanedBody);
        console.log(`  [Global Fetch Proxy] Enforcing pure V2/V1 spec alignment`);
    }
    return originalFetch(url, options);
};

async function deployContract(account, name, constructorCalldata = []) {
    const sierraPath = path.join(targetDir, `proofpass_contracts_${name}.contract_class.json`);
    const casmPath = path.join(targetDir, `proofpass_contracts_${name}.compiled_contract_class.json`);

    const sierra = json.parse(fs.readFileSync(sierraPath, 'utf8'));
    const casm = json.parse(fs.readFileSync(casmPath, 'utf8'));

    console.log(`\n--- Processing ${name} ---`);
    const classHash = hash.computeSierraContractClassHash(sierra);
    console.log(`  Class Hash: ${classHash}`);

    try {
        const d = await account.declare({ contract: sierra, casm }, { version: 2, maxFee: '0x2386f26fc10000' });
        console.log(`  Waiting for Declare TX: ${d.transaction_hash}...`);
        await account.waitForTransaction(d.transaction_hash);
        console.log(`  ✅ Declared`);
    } catch (e) {
        if (e.message.indexOf('already declared') !== -1) console.log(`  ✅ Already declared`);
        else throw e;
    }

    const salt = '0x' + Math.floor(Math.random() * 1000000).toString(16) + '00';
    const { transaction_hash, contract_address } = await account.deployContract({
        classHash,
        constructorCalldata,
        salt
    }, { version: 1, maxFee: '0x2386f26fc10000' });

    console.log(`  Waiting for Deploy TX: ${transaction_hash}...`);
    await account.waitForTransaction(transaction_hash);
    console.log(`  ✅ Deployed at: ${contract_address}`);

    return contract_address;
}

async function main() {
    const provider = new RpcProvider({ nodeUrl: RPC, chainId: constants.StarknetChainId.SN_SEPOLIA });
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

        console.log('\n--- ALL DEPLOYED SUCCESSFULLY ---');
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
