const { RpcProvider, Account, json, constants, hash } = require('starknet');
const fs = require('fs');
const path = require('path');

// Alchemy v0.10 RPC URL (Starknet 0.13.1+)
const RPC = 'https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/MnGSA2Mjm9SFFPUCuXWdP';
const ACCOUNT_ADDR = '0x054c172905114e7d0fdA1F4697B2D9837fe92C9C49F01ace4A5cA046901B227D';
const PRIVKEY = process.env.STARKNET_PRIVATE_KEY || '0x05fba985b63743a18ca48b48efb89662b2cc1c3c5c5e3296e6e6b4d33c709ede';

const targetDir = path.join(process.cwd(), 'contracts_v1/target/dev');

// GLOBAL FETCH PROXY - ULTRA-ROBUST V3 (0.13.1)
const originalFetch = global.fetch;
global.fetch = async function (url, options) {
    if (options && options.body && (options.body.includes('starknet_addDeclareTransaction') || options.body.includes('starknet_addInvokeTransaction'))) {
        let body = JSON.parse(options.body);

        // Recursive 0.13.1 field injector
        const inject0131 = (obj) => {
            if (typeof obj !== 'object' || obj === null) return obj;
            if (Array.isArray(obj)) return obj.map(inject0131);

            const res = {};
            for (const k in obj) {
                let val = obj[k];
                // 1. Force 'latest' for any block id
                if (val === 'pending') val = 'latest';
                if (val && typeof val === 'object' && val.block_id === 'pending') val.block_id = 'latest';

                // 2. Inject l1_data_gas into resource_bounds if version is 3
                if (k === 'resource_bounds' && obj.version === '0x3') {
                    if (!val.l1_data_gas) {
                        val.l1_data_gas = { max_amount: '0x0', max_price_per_unit: '0x0' };
                        console.log(`  [Proxy] Injected l1_data_gas into V3 payload`);
                    }
                }

                // 3. Ensure DA modes are present for V3
                if (obj.version === '0x3') {
                    if (!obj.nonce_data_availability_mode) res.nonce_data_availability_mode = '0x0';
                    if (!obj.fee_data_availability_mode) res.fee_data_availability_mode = '0x0';
                }

                res[k] = inject0131(val);
            }
            return res;
        };

        const cleanedBody = inject0131(body);
        options.body = JSON.stringify(cleanedBody);
        // console.log(`  [Proxy] Sending:`, JSON.stringify(cleanedBody, null, 2));
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

    // Resource bounds that library supports (l1_data_gas injected by proxy)
    const resourceBounds = {
        l1_gas: { max_amount: '0x30d40', max_price_per_unit: '0x4a817c800' }, // 200k @ 20 Gwei
        l2_gas: { max_amount: '0x0', max_price_per_unit: '0x0' }
    };

    try {
        console.log(`  Declaring (V3)...`);
        const d = await account.declare({ contract: sierra, casm: casm }, {
            version: 3,
            resourceBounds,
            tip: '0x0',
            paymasterData: [],
            accountDeploymentData: []
        });
        console.log(`  Waiting for Declare TX: ${d.transaction_hash}...`);
        await account.waitForTransaction(d.transaction_hash);
        console.log(`  ✅ Declared`);
    } catch (e) {
        if (e.message.includes('already declared')) console.log(`  ✅ Already declared`);
        else throw e;
    }

    const salt = '0x' + Math.floor(Math.random() * 1000000).toString(16) + '00';
    console.log(`  Deploying (V3)...`);
    const { transaction_hash, contract_address } = await account.deployContract({
        classHash,
        constructorCalldata,
        salt
    }, {
        version: 3,
        resourceBounds
    });

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
