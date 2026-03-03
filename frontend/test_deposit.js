const { hash, ec, RpcProvider, Account, Contract } = require('starknet');
const fs = require('fs');

async function main() {
    const provider = new RpcProvider({ nodeUrl: 'http://127.0.0.1:5050' });
    const address = '0x064b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691';
    const privateKey = '0x0000000000000000000000000000000071d7bb07b9a64f6f78ac4c816aff4da9';
    const account = new Account(provider, address, privateKey, "1");

    const env = fs.readFileSync('.env.local', 'utf8');
    const getEnv = (key) => env.split('\n').find(l => l.startsWith(key))?.split('=')[1].trim();

    const STRKBTC_ADDRESS = getEnv('NEXT_PUBLIC_STRKBTC_ADDRESS');
    const GATE_ADAPTER_ADDRESS = getEnv('NEXT_PUBLIC_GATE_ADAPTER_ADDRESS');
    const ORACLE_PRIVATE_KEY = getEnv('ORACLE_PRIVATE_KEY');

    // Exact data from original console.log (except we sign for 'address')
    const proof_id = '0xc945400ba381c06d';
    const policy_id = '0x386b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b';
    const tier = '1';
    const nullifier = '0x6a11cf0e526c4fae82c3a1c30ca694f4bf5f3bb1cf399dea47c3f326654fd89';
    const expiry_ts = '1772661150';

    // 1. Generate new oracle signature for the MASTER ACCOUNT
    const payloadHash = hash.computeHashOnElements([
        address, policy_id, tier, nullifier, expiry_ts
    ]);
    const signature = ec.starkCurve.sign(payloadHash, ORACLE_PRIVATE_KEY);
    const sig_r = "0x" + signature.r.toString(16);
    const sig_s = "0x" + signature.s.toString(16);

    console.log("Newly generated oracle signature for master account:");
    console.log("R:", sig_r, "S:", sig_s);

    // 2. Perform deposit transaction
    const calls = [
        {
            contractAddress: STRKBTC_ADDRESS,
            entrypoint: "approve",
            calldata: [GATE_ADAPTER_ADDRESS, "1", "0"]
        },
        {
            contractAddress: GATE_ADAPTER_ADDRESS,
            entrypoint: "deposit",
            calldata: [proof_id, policy_id, tier, sig_r, sig_s, nullifier, expiry_ts, "1", "0"]
        }
    ];

    console.log('Sending deposit transaction...');
    try {
        const tx = await account.execute(calls);
        console.log('Tx Hash:', tx.transaction_hash);

        console.log('Waiting 5 seconds for execution...');
        await new Promise(r => setTimeout(r, 5000));

        // 3. Verify balance
        const abi = [{ type: 'function', name: 'get_balance', inputs: [{ name: 'user', type: 'core::starknet::contract_address::ContractAddress' }], outputs: [{ type: 'core::integer::u256' }], state_mutability: 'view' }];
        const ga = new Contract(abi, GATE_ADAPTER_ADDRESS, provider);
        const bal = await ga.get_balance(address);
        console.log('SUCCESS! strkBTC Balance on GateAdapter:', bal.toString());
    } catch (error) {
        if (error.message && error.message.includes('pending')) {
            console.log('Transaction may have succeeded but starknet.js failed to read pending block.');
        } else {
            console.log('Error:', JSON.stringify(error, null, 2));
        }
    }
}
main();
