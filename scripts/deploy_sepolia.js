const fs = require('fs');
const https = require('https');
const { hash, json, num, encode, ec } = require('starknet');

const RPC = 'https://starknet-sepolia.g.alchemy.com/v2/MnGSA2Mjm9SFFPUCuXWdP';
const ACCOUNT = '0x054c172905114e7d0fdA1F4697B2D9837fe92C9C49F01ace4A5cA046901B227D';
const PRIVKEY = '0x05fba985b63743a18ca48b48efb89662b2cc1c3c5c5e3296e6e6b4d33c709ede';
const CHAIN_ID = '0x534e5f5345504f4c4941'; // SN_SEPOLIA

async function rpcCall(method, params) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
        const urlObj = new URL(RPC);
        const req = https.request({
            hostname: urlObj.hostname,
            port: 443,
            path: urlObj.pathname + urlObj.search,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(new Error('Invalid JSON: ' + data)); }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

async function main() {
    console.log('--- Starknet Sepolia Deployment (Bypassing Wallet) ---');

    // 1. Get Nonce
    const nonceResp = await rpcCall('starknet_getNonce', ['latest', ACCOUNT]);
    if (nonceResp.error) throw new Error('Nonce error: ' + JSON.stringify(nonceResp.error));
    let nonce = nonceResp.result;
    console.log('Account:', ACCOUNT);
    console.log('Nonce:', nonce);

    const contracts = [
        'MockERC20',
        'ProofVerifier',
        'GateAdapter',
        'PolicyRegistry'
    ];

    for (const name of contracts) {
        console.log(`\nProcessing ${name}...`);
        const sierraFile = `contracts_v1/target/dev/proofpass_contracts_${name}.contract_class.json`;
        const casmFile = `contracts_v1/target/dev/proofpass_contracts_${name}.compiled_contract_class.json`;

        const sierra = json.parse(fs.readFileSync(sierraFile, 'utf8'));
        const casm = json.parse(fs.readFileSync(casmFile, 'utf8'));

        const classHash = hash.computeSierraContractClassHash(sierra);
        const compiledClassHash = hash.computeCompiledClassHash(casm);

        console.log('  Class Hash:', classHash);
        console.log('  Compiled Class Hash:', compiledClassHash);

        // Check if already declared
        const classResp = await rpcCall('starknet_getClass', ['latest', classHash]);
        if (classResp.result) {
            console.log('  [Notice] Already declared. Skipping declaration.');
        } else {
            console.log('  Delaring...');
            const max_fee = '0x2386f26fc10000'; // 0.01 ETH

            // Compute Transaction Hash for V2 Declare
            // In starknet.js v6, this takes an object
            const txHash = hash.calculateDeclareTransactionHash({
                classHash,
                compiledClassHash,
                senderAddress: ACCOUNT,
                version: 2,
                maxFee: max_fee,
                chainId: CHAIN_ID,
                nonce
            });

            // Signature
            const sig = ec.starkCurve.sign(txHash, PRIVKEY);
            const signature = [sig.r.toString(), sig.s.toString()].map(x => '0x' + BigInt(x).toString(16));

            const declareTx = {
                type: 'DECLARE',
                version: '0x2',
                max_fee,
                signature,
                nonce,
                contract_class: sierra,
                compiled_class_hash: compiledClassHash,
                sender_address: ACCOUNT
            };

            const declareResp = await rpcCall('starknet_addDeclareTransaction', [declareTx]);
            if (declareResp.error) {
                console.error('  [Error] Declaration failed:', JSON.stringify(declareResp.error));
                // If it's a gas issue or something else, we might want to stop.
                continue;
            }

            const txHashResult = declareResp.result.transaction_hash;
            console.log('  Declaration TX:', txHashResult);

            // Wait for confirmation
            console.log('  Waiting for confirmation...');
            let confirmed = false;
            for (let i = 0; i < 20; i++) {
                await new Promise(r => setTimeout(r, 10000));
                const receipt = await rpcCall('starknet_getTransactionReceipt', [txHashResult]);
                if (receipt.result && receipt.result.finality_status && receipt.result.finality_status !== 'RECEIVED') {
                    console.log('  Confirmed!');
                    confirmed = true;
                    break;
                }
                process.stdout.write('.');
            }
            if (!confirmed) console.log('  [Warning] Confirmation taking too long. Check Starkscan.');

            // Update nonce for next declaration
            nonce = '0x' + (BigInt(nonce) + 1n).toString(16);
        }

        // Deployment logic would go here, but let's declare first.
    }
}

main().catch(err => {
    console.error('\n[Fatal Error]:', err.message);
    process.exit(1);
});
