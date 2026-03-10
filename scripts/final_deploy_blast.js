const { RpcProvider, Account, json, constants, hash, CallData } = require('starknet');
const fs = require('fs');
const path = require('path');

// BlastAPI v0.7 RPC URL - very standard and legacy-friendly
const RPC = 'https://starknet-sepolia.public.blastapi.io/rpc/v0_7';
const ACCOUNT_ADDR = '0x054c172905114e7d0fdA1F4697B2D9837fe92C9C49F01ace4A5cA046901B227D';
const PRIVKEY = process.env.STARKNET_PRIVATE_KEY || '0x05fba985b63743a18ca48b48efb89662b2cc1c3c5c5e3296e6e6b4d33c709ede';

const targetDir = path.join(process.cwd(), 'contracts_v1/target/dev');

async function deployContract(account, name, constructorCalldata = []) {
    const sierraPath = path.join(targetDir, `proofpass_contracts_${name}.contract_class.json`);
    const casmPath = path.join(targetDir, `proofpass_contracts_${name}.compiled_contract_class.json`);

    const sierra = json.parse(fs.readFileSync(sierraPath, 'utf8'));
    const casm = json.parse(fs.readFileSync(casmPath, 'utf8'));

    console.log(`\n--- Processing ${name} ---`);
    const classHash = hash.computeSierraContractClassHash(sierra);
    console.log(`  Class Hash: ${classHash}`);

    try {
        // v6 declare with version 2
        const d = await account.declare({ contract: sierra, casm }, { version: 2 });
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
    }, { version: 1 });

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
