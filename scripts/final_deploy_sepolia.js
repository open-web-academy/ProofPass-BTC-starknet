const { RpcProvider, Account, json, constants, hash } = require('starknet');
const fs = require('fs');
const path = require('path');

// Alchemy v0.10 RPC URL (V3 compliant)
const RPC = 'https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/MnGSA2Mjm9SFFPUCuXWdP';
const ACCOUNT_ADDR = '0x054c172905114e7d0fdA1F4697B2D9837fe92C9C49F01ace4A5cA046901B227D';
const PRIVKEY = process.env.STARKNET_PRIVATE_KEY || '0x05fba985b63743a18ca48b48efb89662b2cc1c3c5c5e3296e6e6b4d33c709ede';

const targetDir = path.join(process.cwd(), 'contracts_v1/target/dev');

function patchProvider(provider) {
    const ch = provider.channel;
    const originalFetch = ch.fetch.bind(ch);

    const patchPending = (obj) => {
        if (typeof obj !== 'object' || obj === null) return obj;
        if (Array.isArray(obj)) return obj.map(patchPending);
        const res = {};
        for (const k in obj) {
            let val = obj[k];
            if (val === 'pending') val = 'latest';
            if (val && typeof val === 'object' && val.block_id === 'pending') val.block_id = 'latest';
            res[k] = patchPending(val);
        }
        return res;
    };

    const injectFields = (obj) => {
        if (typeof obj !== 'object' || obj === null) return;
        if (Array.isArray(obj)) {
            obj.forEach(injectFields);
            return;
        }
        // Bit-shifted versions for queries also handled (starts with 0x1000...)
        const isV3 = (obj.version && (obj.version.toString().endsWith('3') || obj.version === 3));
        if (isV3) {
            if (obj.tip === undefined) obj.tip = '0x0';
            if (!obj.paymaster_data) obj.paymaster_data = [];
            if (!obj.account_deployment_data) obj.account_deployment_data = [];
            if (!obj.nonce_data_availability_mode) obj.nonce_data_availability_mode = 'L1';
            if (!obj.fee_data_availability_mode) obj.fee_data_availability_mode = 'L1';

            const defB = {
                l1_gas: { max_amount: '0x186a0', max_price_per_unit: '0x2540be400' },
                l2_gas: { max_amount: '0x0', max_price_per_unit: '0x0' },
                l1_data_gas: { max_amount: '0x0', max_price_per_unit: '0x0' }
            };

            if (!obj.resource_bounds) {
                obj.resource_bounds = defB;
            } else {
                if (!obj.resource_bounds.l1_gas) obj.resource_bounds.l1_gas = defB.l1_gas;
                if (!obj.resource_bounds.l2_gas) obj.resource_bounds.l2_gas = defB.l2_gas;
                if (!obj.resource_bounds.l1_data_gas) obj.resource_bounds.l1_data_gas = defB.l1_data_gas;
            }
        }
        for (const k in obj) {
            if (obj[k] && typeof obj[k] === 'object') injectFields(obj[k]);
        }
    };

    ch.fetch = async function (method, params, id) {
        let patchedParams = patchPending(params);
        injectFields(patchedParams);
        return originalFetch(method, patchedParams, id);
    };
    console.log('✅ Provider patched ULTRA-AGGRESSIVELY (V3, l1_data_gas, pending -> latest)');
}

async function deployContract(account, name, constructorCalldata = []) {
    const sierraPath = path.join(targetDir, `proofpass_contracts_${name}.contract_class.json`);
    const casmPath = path.join(targetDir, `proofpass_contracts_${name}.compiled_contract_class.json`);

    const sierra = json.parse(fs.readFileSync(sierraPath, 'utf8'));
    const casm = json.parse(fs.readFileSync(casmPath, 'utf8'));

    console.log(`\n--- Processing ${name} ---`);
    const classHash = hash.computeSierraContractClassHash(sierra);
    console.log(`  Class Hash: ${classHash}`);

    try {
        const d = await account.declare({ contract: sierra, casm }, { version: 3 });
        console.log(`  Waiting for Declare TX: ${d.transaction_hash}...`);
        await account.waitForTransaction(d.transaction_hash);
        console.log(`  ✅ Declared`);
    } catch (e) {
        if (e.message.includes('already declared')) console.log(`  ✅ Already declared`);
        else throw e;
    }

    const { transaction_hash, contract_address } = await account.deployContract({
        classHash, constructorCalldata,
        salt: '0x' + Math.floor(Math.random() * 1000000).toString(16) + '00'
    }, { version: 3 });

    console.log(`  Waiting for Deploy TX: ${transaction_hash}...`);
    await account.waitForTransaction(transaction_hash);
    console.log(`  ✅ Deployed at: ${contract_address}`);

    return contract_address;
}

async function main() {
    const provider = new RpcProvider({ nodeUrl: RPC, chainId: constants.StarknetChainId.SN_SEPOLIA });
    patchProvider(provider);
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
            addresses.PolicyRegistry, addresses.ProofVerifier, addresses.MockERC20
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
