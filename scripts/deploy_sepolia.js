/**
 * ProofPass Sepolia Deployment Script (DRPC V1 FULL RPC 0.8.1 COMPLIANT)
 * Globally overrides fetch with native node:https to solve Node.js network problems.
 * Injects ALL missing RPC 0.8.1 fields for V1 transactions (dRPC strict requirement).
 * Includes Tip, DAModes, AccountDeploymentData, and PaymasterData.
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

// 1. GLOBAL FETCH OVERRIDE
global.fetch = async (url, options) => {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url.toString());
        let body = options && options.body ? options.body : null;
        if (body) {
            let bodyStr = body.toString();
            // Generic fixes
            if (bodyStr.includes('"pending"')) bodyStr = bodyStr.replace(/"pending"/g, '"latest"');

            // Full RPC 0.8.1 V1 Injection (dRPC)
            if (bodyStr.includes('"starknet_addInvokeTransaction"') && bodyStr.includes('"version":"0x1"') && !bodyStr.includes('"fee_data_availability_mode"')) {
                // Pre-calculate full injection string to be compliant with RPC 0.8.1 spec for V1 Invoke
                const injection = ',"tip":"0x0","fee_data_availability_mode":"L1","nonce_data_availability_mode":"L1","account_deployment_data":[],"paymaster_data":[]';
                // Find signature array and append fields after it
                bodyStr = bodyStr.replace(/"signature":\s*\[[^\]]*\]/, '$&' + injection);
            }
            body = bodyStr;
        }

        const reqOptions = {
            hostname: urlObj.hostname, port: 443, path: urlObj.pathname, method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(options && options.headers ? options.headers : {}) },
            timeout: 240000
        };

        const req = https.request(reqOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                let parsed; try { parsed = JSON.parse(data); } catch (e) { }
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode,
                    headers: {
                        get: (n) => res.headers[n.toLowerCase()],
                        getAll: (n) => res.headers[n.toLowerCase()] ? [res.headers[n.toLowerCase()]] : [],
                        forEach: (cb) => Object.entries(res.headers).forEach(([k, v]) => cb(v, k))
                    },
                    text: async () => data, json: async () => parsed || { error: { message: "Not a JSON response" } }
                });
            });
        });

        req.on('error', (e) => reject(e)); req.on('timeout', () => { req.destroy(); reject(new Error("Timeout")); });
        if (body) req.write(body);
        req.end();
    });
};

const { RpcProvider, Account, json, hash, constants, CallData } = require("starknet");

const RPC_URL = "https://starknet-sepolia.drpc.org";
const ACCOUNT_ADDR = "0x054c172905114e7d0fdA1F4697B2D9837fe92C9C49F01ace4A5cA046901B227D";
const PRIVATE_KEY = "0x05fba985b63743a18ca48b48efb89662b2cc1c3c5c5e3296e6e6b4d33c709ede";
const ORACLE_PUBLIC_KEY = "0x6eb62dc263aa156dd37a146aa1d1021357bfffa47ca23479a4c3844d9282ce6";

async function main() {
    const provider = new RpcProvider({ nodeUrl: RPC_URL, chainId: constants.StarknetChainId.SN_SEPOLIA });
    const account = new Account(provider, ACCOUNT_ADDR, PRIVATE_KEY);

    async function deployContract(name, constructorArgs = []) {
        const artifactsDir = "contracts_v1/target/dev";
        const sierraPath = path.join(artifactsDir, `proofpass_contracts_${name}.contract_class.json`);
        const sierra = json.parse(fs.readFileSync(sierraPath, "utf-8"));
        const classHash = hash.computeSierraContractClassHash(sierra);

        console.log(`\nDeploying ${name} (ClassHash: ${classHash})...`);
        try {
            // Version 1 (ETH) with hardcoded maxFee
            const { transaction_hash, contract_address } = await account.deployContract({
                classHash: classHash,
                constructorCalldata: CallData.compile(constructorArgs)
            }, {
                maxFee: "10000000000000000" // 0.01 ETH
            });
            console.log(`✓ Hash: ${transaction_hash}`);
            console.log(`✓ Address: ${contract_address}`);
            console.log(`Waiting for confirmation...`);
            await provider.waitForTransaction(transaction_hash);
            return contract_address;
        } catch (e) {
            console.error(`X Error deploying ${name}:`, e.message);
            if (e.data) console.error("Error Details:", JSON.stringify(e.data, null, 2));
            throw e;
        }
    }

    try {
        console.log(`Connected to Account (dRPC V1 - Full Spec Injection): ${ACCOUNT_ADDR}\n`);

        const strkBtcAddr = await deployContract("MockERC20", { recipient: ACCOUNT_ADDR, initial_supply: { low: "0x3b9aca00", high: "0x0" } });
        const pvAddr = await deployContract("ProofVerifier", { oracle_public_key: ORACLE_PUBLIC_KEY });
        const gaAddr = await deployContract("GateAdapter", { strk_btc_address: strkBtcAddr, proof_verifier_address: pvAddr });
        const prAddr = await deployContract("PolicyRegistry", { owner_address: ACCOUNT_ADDR });

        console.log("\n🚀 DEPLOYMENT SUCCESSFUL 🚀");
        console.log(`NEXT_PUBLIC_STRKBTC_ADDRESS=${strkBtcAddr}`);
        console.log(`NEXT_PUBLIC_PROOF_VERIFIER_ADDRESS=${pvAddr}`);
        console.log(`NEXT_PUBLIC_GATE_ADAPTER_ADDRESS=${gaAddr}`);
        console.log(`NEXT_PUBLIC_POLICY_REGISTRY_ADDRESS=${prAddr}`);

    } catch (err) {
        console.error("\nDeployment script aborted.");
        process.exit(1);
    }
}
main();
