const { hash, json, ec, CallData } = require('starknet');
const fs = require('fs');
const https = require('https');
const path = require('path');

// Public dRPC endpoint
const RPC = 'https://starknet-sepolia.drpc.org';
const ACCOUNT_ADDR = '0x054c172905114e7d0fdA1F4697B2D9837fe92C9C49F01ace4A5cA046901B227D';
const PRIVKEY = process.env.STARKNET_PRIVATE_KEY || '0x05fba985b63743a18ca48b48efb89662b2cc1c3c5c5e3296e6e6b4d33c709ede';
const CHAIN_ID = '0x534e5f5345504f4c4941'; // SN_SEPOLIA
const UDC_ADDR = '0x041a78e741e5af2fec34b695679bc6891742439f7afb8484ecd7766661ad02bf';

async function rpc(method, params = {}) {
    console.log(`  [RPC] Call: ${method}`);
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
        const urlObj = new URL(RPC);
        const req = https.request({
            hostname: urlObj.hostname, port: 443, path: urlObj.pathname + urlObj.search,
            method: 'POST', headers: { 'Content-Type': 'application/json' }
        }, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.error) console.log(`  [RPC Error]: ${JSON.stringify(parsed.error)}`);
                    resolve(parsed);
                } catch (e) { resolve({ error: { message: 'Failed to parse JSON' } }); }
            });
        });
        req.on('error', (e) => resolve({ error: { message: e.message } }));
        req.write(body); req.end();
    });
}

async function waitForTx(txHash) {
    process.stdout.write(`  Waiting for TX: ${txHash.slice(0, 10)}...`);
    for (let i = 0; i < 80; i++) {
        await new Promise(r => setTimeout(r, 10000));
        const res = await rpc('starknet_getTransactionReceipt', { transaction_hash: txHash });
        if (res.result && res.result.finality_status && res.result.finality_status !== 'RECEIVED') {
            console.log('\n  ✅ TX Confirmed');
            return res.result;
        }
        process.stdout.write('.');
    }
    throw new Error('TX timeout');
}

async function main() {
    console.log('--- RAW STARKNET PURE V2/V1 DEPLOYMENT ---\n');
    const targetDir = path.join(process.cwd(), 'contracts_v1/target/dev');

    // 0. Nonce
    const nonceResp = await rpc('starknet_getNonce', { block_id: 'latest', contract_address: ACCOUNT_ADDR });
    if (nonceResp.error) throw new Error('Nonce fetch failed: ' + JSON.stringify(nonceResp.error));
    let nonceValue = BigInt(nonceResp.result);
    console.log('Account:', ACCOUNT_ADDR);
    console.log('Nonce:', '0x' + nonceValue.toString(16));

    const contracts = ['MockERC20', 'PolicyRegistry', 'ProofVerifier', 'GateAdapter'];
    const addresses = {};

    for (const name of contracts) {
        console.log(`\n>>> ${name} <<<`);
        const sierraPath = path.join(targetDir, `proofpass_contracts_${name}.contract_class.json`);
        const casmPath = path.join(targetDir, `proofpass_contracts_${name}.compiled_contract_class.json`);

        const sierra = json.parse(fs.readFileSync(sierraPath, 'utf8'));
        const casm = json.parse(fs.readFileSync(casmPath, 'utf8'));

        const classHash = hash.computeSierraContractClassHash(sierra);
        const compiledClassHash = hash.computeCompiledClassHash(casm);
        console.log('  Class Hash:', classHash);

        // 1. Declare V2
        console.log('  Checking Declaration Status...');
        const classCheck = await rpc('starknet_getClass', { block_id: 'latest', class_hash: classHash });

        if (classCheck.result) {
            console.log('  ✅ Already declared');
        } else if (classCheck.error && (classCheck.error.code === 28 || classCheck.error.message.toLowerCase().includes('not found'))) {
            console.log(`  Declaring (version 2, nonce 0x${nonceValue.toString(16)})...`);
            const max_fee = '0x2386f26fc10000'; // 0.01 ETH 
            const txHashValue = hash.calculateDeclareTransactionHash({
                classHash,
                compiledClassHash,
                senderAddress: ACCOUNT_ADDR,
                version: 2,
                maxFee: max_fee,
                chainId: CHAIN_ID,
                nonce: '0x' + nonceValue.toString(16)
            });
            const sig = ec.starkCurve.sign(txHashValue, PRIVKEY);
            const signature = [sig.r.toString(), sig.s.toString()].map(it => '0x' + BigInt(it).toString(16));

            // NO 'type' field in the broadcasted tx object (some nodes reject it)
            const declareTx = {
                version: '0x2', max_fee, signature,
                nonce: '0x' + nonceValue.toString(16), contract_class: sierra,
                compiled_class_hash: compiledClassHash, sender_address: ACCOUNT_ADDR
            };

            const res = await rpc('starknet_addDeclareTransaction', { declare_transaction: declareTx });
            if (res.error) throw new Error('Declare failed: ' + JSON.stringify(res.error));
            await waitForTx(res.result.transaction_hash);
            nonceValue++;
        } else {
            throw new Error('getClass unexpected error: ' + JSON.stringify(classCheck.error));
        }

        // 2. Invoke V1 (UDC Deploy)
        console.log(`  Deploying (version 1, nonce 0x${nonceValue.toString(16)})...`);
        const salt = '0x' + Math.floor(Math.random() * 1000000).toString(16) + '00';
        let calldata_raw = [];
        if (name === 'MockERC20') calldata_raw = [
            '0x' + Buffer.from('MockSTRK').toString('hex'),
            '0x' + Buffer.from('STRK').toString('hex'),
            ACCOUNT_ADDR
        ];
        if (name === 'GateAdapter') calldata_raw = [addresses.PolicyRegistry, addresses.ProofVerifier, addresses.MockERC20];

        const compiledCalldata = CallData.compile(calldata_raw);
        const udcCalldata = CallData.compile([classHash, salt, 0, compiledCalldata.length, ...compiledCalldata]);

        const executeCalldata = [
            '0x1',
            UDC_ADDR,
            hash.getSelectorFromName('deployContract'),
            '0x' + udcCalldata.length.toString(16),
            ...udcCalldata
        ];

        const max_fee_invoke = '0x2386f26fc10000';
        const invokeTxHashValue = hash.calculateInvokeTransactionHash({
            senderAddress: ACCOUNT_ADDR,
            chainId: CHAIN_ID,
            nonce: '0x' + nonceValue.toString(16),
            version: 1,
            maxFee: max_fee_invoke,
            calldata: executeCalldata
        });

        const sigInvoke = ec.starkCurve.sign(invokeTxHashValue, PRIVKEY);
        const signatureInvoke = [sigInvoke.r.toString(), sigInvoke.s.toString()].map(it => '0x' + BigInt(it).toString(16));

        // NO 'type' field
        const invokeTx = {
            version: '0x1', max_fee: max_fee_invoke,
            signature: signatureInvoke, nonce: '0x' + nonceValue.toString(16),
            sender_address: ACCOUNT_ADDR, calldata: executeCalldata
        };

        const resInvoke = await rpc('starknet_addInvokeTransaction', { invoke_transaction: invokeTx });
        if (resInvoke.error) throw new Error('Invoke failed: ' + JSON.stringify(resInvoke.error));
        const receipt = await waitForTx(resInvoke.result.transaction_hash);

        const event = receipt.events.find(it => it.from_address.toLowerCase() === UDC_ADDR.toLowerCase());
        addresses[name] = event.data[0];
        console.log(`  ✅ Deployed ${name}: ${addresses[name]}`);
        nonceValue++;
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
