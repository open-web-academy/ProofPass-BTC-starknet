const { RpcProvider, Account, json, hash } = require('starknet');
const fs = require('fs');
const path = require('path');

// Public dRPC endpoint
const RPC = 'https://starknet-sepolia.drpc.org';
const ACCOUNT_ADDR = '0x054c172905114e7d0fdA1F4697B2D9837fe92C9C49F01ace4A5cA046901B227D';
const PRIVKEY = process.env.STARKNET_PRIVATE_KEY || '0x05fba985b63743a18ca48b48efb89662b2cc1c3c5c5e3296e6e6b4d33c709ede';

const targetDir = path.join(process.cwd(), 'contracts_v1/target/dev');

async function main() {
    const provider = new RpcProvider({ nodeUrl: RPC });
    const account = new Account(provider, ACCOUNT_ADDR, PRIVKEY);

    console.log('--- DEPLOYMENT V5 (Sepolia) ---');
    console.log('Using account:', ACCOUNT_ADDR);

    const addresses = {};
    const contracts = ['MockERC20', 'PolicyRegistry', 'ProofVerifier', 'GateAdapter'];

    for (const name of contracts) {
        console.log(`\n>>> Processing ${name} <<<`);
        const sierraPath = path.join(targetDir, `proofpass_contracts_${name}.contract_class.json`);
        const casmPath = path.join(targetDir, `proofpass_contracts_${name}.compiled_contract_class.json`);

        const sierra = json.parse(fs.readFileSync(sierraPath, 'utf8'));
        const casm = json.parse(fs.readFileSync(casmPath, 'utf8'));

        const classHash = hash.computeSierraContractClassHash(sierra);
        console.log(`  Class Hash: ${classHash}`);

        // Declare
        try {
            console.log(`  Declaring...`);
            const d = await account.declare({ contract: sierra, casm: casm });
            console.log(`  ✅ Declared in TX: ${d.transaction_hash}`);
            await provider.waitForTransaction(d.transaction_hash);
        } catch (e) {
            if (e.message.includes('already declared')) console.log(`  ✅ Already declared`);
            else throw e;
        }

        // Deploy
        const salt = '0x' + Math.floor(Math.random() * 1000000).toString(16) + '00';
        let calldata = [];
        if (name === 'MockERC20') calldata = [
            '0x' + Buffer.from('MockSTRK').toString('hex'),
            '0x' + Buffer.from('STRK').toString('hex'),
            ACCOUNT_ADDR
        ];
        if (name === 'GateAdapter') calldata = [addresses.PolicyRegistry, addresses.ProofVerifier, addresses.MockERC20];

        try {
            console.log(`  Deploying (salt ${salt})...`);
            const { transaction_hash, contract_address } = await account.deployContract({
                classHash,
                constructorCalldata: calldata,
                salt
            });
            console.log(`  ✅ Deployed at: ${contract_address[0] || contract_address}`);
            await provider.waitForTransaction(transaction_hash);
            addresses[name] = contract_address[0] || contract_address;
        } catch (e) {
            console.error(`  ❌ Deploy failed:`, e.message);
            throw e;
        }
    }

    console.log('\n--- ALL DEPLOYED SUCCESSFULLY ---');
    console.log(`NEXT_PUBLIC_GATE_ADAPTER_ADDRESS=${addresses.GateAdapter}`);
    console.log(`NEXT_PUBLIC_PROOF_VERIFIER_ADDRESS=${addresses.ProofVerifier}`);
    console.log(`NEXT_PUBLIC_STRKBTC_ADDRESS=${addresses.MockERC20}`);
    console.log(`NEXT_PUBLIC_POLICY_REGISTRY_ADDRESS=${addresses.PolicyRegistry}`);
}

main().catch(err => {
    console.error('\n❌ FATAL EXCEPTION:');
    console.error(err);
    process.exit(1);
});
