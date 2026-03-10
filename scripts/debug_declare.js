const fs = require('fs');
const https = require('https');
const { RpcProvider, Account, json, constants } = require('starknet');

const RPC = 'https://starknet-sepolia.g.alchemy.com/v2/MnGSA2Mjm9SFFPUCuXWdP';
const ACCOUNT_ADDR = '0x054c172905114e7d0fdA1F4697B2D9837fe92C9C49F01ace4A5cA046901B227D';
const PRIVKEY = '0x05fba985b63743a18ca48b48efb89662b2cc1c3c5c5e3296e6e6b4d33c709ede';

async function main() {
    const provider = new RpcProvider({ nodeUrl: RPC, chainId: constants.StarknetChainId.SN_SEPOLIA });

    // Intercept RpcChannel2.fetch to log the request
    const ch = provider.channel;
    const originalFetch = ch.fetch.bind(ch);
    ch.fetch = async function (method, params, id) {
        if (method === 'starknet_addDeclareTransaction') {
            const body = JSON.stringify({ jsonrpc: '2.0', id, method, params }, null, 2);
            console.log('--- RPC REQUEST BODY ---');
            console.log(body);
            console.log('------------------------');
        }
        return originalFetch(method, params, id);
    };

    const account = new Account(provider, ACCOUNT_ADDR, PRIVKEY);

    const name = 'MockERC20';
    const sierra = json.parse(fs.readFileSync(`contracts_v1/target/dev/proofpass_contracts_${name}.contract_class.json`, 'utf8'));
    const casm = json.parse(fs.readFileSync(`contracts_v1/target/dev/proofpass_contracts_${name}.compiled_contract_class.json`, 'utf8'));

    console.log(`▶ Testing ${name} with V2 declare...`);
    try {
        await account.declare({ contract: sierra, casm }, {
            version: 2,
            maxFee: '0x2386f26fc10000'
        });
    } catch (e) {
        console.error('Error:', e.message);
        if (e.data) console.error('Data:', JSON.stringify(e.data));
    }
}

main();
