/**
 * ProofPass Sepolia Final Declaration Script
 * Robust fetch override for Alchemy v0.10.0 + Starknet.js v6.
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

global.fetch = async (url, options) => {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url.toString());
        let body = options && options.body ? options.body : null;
        if (body) {
            let bodyStr = body.toString();
            // Full replacement of pending -> latest
            bodyStr = bodyStr.split('"pending"').join('"latest"').split('\\"pending\\"').join('\\"latest\\"');

            // Inject l1_data_gas for Alchemy V3
            if (bodyStr.includes('"resource_bounds"') && bodyStr.includes('"l1_gas"') && !bodyStr.includes('"l1_data_gas"')) {
                bodyStr = bodyStr.replace(/"l1_gas":\s*({[^}]+})/, '"l1_gas":$1,"l1_data_gas":$1');
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

const { RpcProvider, Account, json, hash, constants } = require("starknet");

const RPC_URL = "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/MnGSA2Mjm9SFFPUCuXWdP";
const ACCOUNT_ADDR = "0x054c172905114e7d0fdA1F4697B2D9837fe92C9C49F01ace4A5cA046901B227D";
const PRIVATE_KEY = "0x05fba985b63743a18ca48b48efb89662b2cc1c3c5c5e3296e6e6b4d33c709ede";

async function main() {
    const provider = new RpcProvider({ nodeUrl: RPC_URL, chainId: constants.StarknetChainId.SN_SEPOLIA });
    const account = new Account(provider, ACCOUNT_ADDR, PRIVATE_KEY);

    async function declareContract(name) {
        const p = `contracts_v1/target/dev/proofpass_contracts_${name}.contract_class.json`;
        const cp = `contracts_v1/target/dev/proofpass_contracts_${name}.compiled_contract_class.json`;
        const sierra = json.parse(fs.readFileSync(p, "utf-8"));
        const casm = json.parse(fs.readFileSync(cp, "utf-8"));
        const ch = hash.computeSierraContractClassHash(sierra);

        console.log(`\n> Declaring ${name} (${ch})...`);
        try {
            const res = await account.declare({ contract: sierra, casm: casm }, {
                version: 3,
                feeData: {
                    fee_token: "STRK",
                    l1_resource_bounds: {
                        max_amount: "0x7a120", // 500k gas
                        max_price_per_unit: "0x3b9aca000" // 16 gwei
                    }
                }
            });
            console.log(`✓ Hash: ${res.transaction_hash}`);
            console.log(`Waiting for confirmation...`);
            await provider.waitForTransaction(res.transaction_hash);
            console.log(`✅ Success!`);
        } catch (e) {
            if (e.message.toLowerCase().includes("already declared")) {
                console.log("! Already declared.");
            } else {
                console.error("X Error:", e.message);
                if (e.data) console.error("Details:", JSON.stringify(e.data));
                throw e;
            }
        }
    }

    try {
        console.log(`Account (Final V3): ${ACCOUNT_ADDR}`);
        await declareContract("MockERC20");
        await declareContract("ProofVerifier");
        await declareContract("GateAdapter");
        await declareContract("PolicyRegistry");
        console.log("\n🚀 ALL CLASSES DECLARED SUCCESS 🚀");
    } catch (err) {
        console.error("\nAborted.");
        process.exit(1);
    }
}
main();
