/**
 * Dora RPC Declare Test (TLS Bypass)
 */
const fs = require("fs");
const { RpcProvider, Account, json, hash, constants } = require("starknet");
const https = require("https");

global.fetch = async (url, options) => {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url.toString());
        const req = https.request({
            hostname: urlObj.hostname, port: 443, path: urlObj.pathname, method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
            agent: new https.Agent({ rejectUnauthorized: false })
        }, (res) => {
            let data = ''; res.on('data', c => data += c);
            res.on('end', () => resolve({
                ok: res.statusCode < 300, status: res.statusCode,
                text: async () => data, json: async () => JSON.parse(data),
                headers: { get: n => res.headers[n.toLowerCase()], getAll: n => [res.headers[n.toLowerCase()]], forEach: cb => { } }
            }));
        });
        req.on('error', reject); req.write(options.body || ""); req.end();
    });
};

const RPC_URL = "https://rpc.starknet-sepolia.dora.network/rpc/v0_7";
const ACCOUNT_ADDR = "0x054c172905114e7d0fdA1F4697B2D9837fe92C9C49F01ace4A5cA046901B227D";
const PRIVATE_KEY = "0x05fba985b63743a18ca48b48efb89662b2cc1c3c5c5e3296e6e6b4d33c709ede";

async function main() {
    const provider = new RpcProvider({ nodeUrl: RPC_URL });
    const account = new Account(provider, ACCOUNT_ADDR, PRIVATE_KEY);

    try {
        const spec = await provider.getSpecVersion();
        console.log(`Dora Spec: ${spec}`);

        const p = `contracts_v1/target/dev/proofpass_contracts_MockERC20.contract_class.json`;
        const cp = `contracts_v1/target/dev/proofpass_contracts_MockERC20.compiled_contract_class.json`;
        const sierra = json.parse(fs.readFileSync(p, "utf-8"));
        const casm = json.parse(fs.readFileSync(cp, "utf-8"));

        console.log("Attempting V1 declaration on Dora...");
        const res = await account.declare({ contract: sierra, casm: casm }, { maxFee: "10000000000000000" });
        console.log("Success! Hash:", res.transaction_hash);
    } catch (e) {
        console.error("Dora Failed:", e.message);
    }
}
main();
