const fs = require('fs');
const { RpcProvider, Account, json, constants } = require('starknet');

// Use Alchemy v2 URL (v0.7 RPC)
const RPC = 'https://starknet-sepolia.g.alchemy.com/v2/MnGSA2Mjm9SFFPUCuXWdP';
const ACCOUNT_ADDR = '0x054c172905114e7d0fdA1F4697B2D9837fe92C9C49F01ace4A5cA046901B227D';
const PRIVKEY = '0x05fba985b63743a18ca48b48efb89662b2cc1c3c5c5e3296e6e6b4d33c709ede';

const NAMES = ['MockERC20', 'ProofVerifier', 'GateAdapter', 'PolicyRegistry'];

async function main() {
    const provider = new RpcProvider({ nodeUrl: RPC, chainId: constants.StarknetChainId.SN_SEPOLIA });
    const account = new Account(provider, ACCOUNT_ADDR, PRIVKEY);

    console.log('Account:', ACCOUNT_ADDR);
    const nonce = await provider.getNonceForAddress(ACCOUNT_ADDR);
    console.log('Nonce:', nonce, '\n');

    for (const name of NAMES) {
        const sierraPath = `contracts_v1/target/dev/proofpass_contracts_${name}.contract_class.json`;
        const casmPath = `contracts_v1/target/dev/proofpass_contracts_${name}.compiled_contract_class.json`;

        if (!fs.existsSync(sierraPath)) {
            console.error(`Missing: ${sierraPath}`);
            continue;
        }

        const sierra = json.parse(fs.readFileSync(sierraPath, 'utf8'));
        const casm = json.parse(fs.readFileSync(casmPath, 'utf8'));

        console.log(`▶ ${name}...`);
        try {
            // Version 2 uses maxFee, much more reliable
            const res = await account.declare({ contract: sierra, casm }, {
                version: 2,
                maxFee: '0x2386f26fc10000' // 0.01 ETH
            });
            console.log(`  ✅ TX: ${res.transaction_hash}`);
            process.stdout.write('  Confirmed');
            await provider.waitForTransaction(res.transaction_hash, { retryInterval: 8000 });
            console.log(' ✅');
        } catch (e) {
            const msg = (e.message || '') + JSON.stringify(e.data || '');
            if (msg.toLowerCase().includes('already declared')) {
                console.log('  ✅ Already declared');
            } else {
                console.error(`  ❌ Error: ${msg.slice(0, 800)}`);
            }
        }
    }
    console.log('\n🏁 Declarations complete!');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
