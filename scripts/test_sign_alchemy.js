/**
 * Test Starknet V1 Signature on Alchemy with Full Log.
 */
const { RpcProvider, Account, constants } = require("starknet");
const https = require("https");

global.fetch = async (url, options) => {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url.toString());
        let body = options && options.body ? options.body : null;
        if (body) {
            let bodyStr = body.toString();
            console.log("\n[DEBUG] REQ:", bodyStr);
            // Replace 'pending' in any form
            bodyStr = bodyStr.replace(/"pending"/g, '"latest"').replace(/\\"pending\\"/g, '\\"latest\\"');
            console.log("[DEBUG] REQ (FIXED):", bodyStr);
            body = bodyStr;
        }

        const reqOptions = {
            hostname: urlObj.hostname, port: 443, path: urlObj.pathname, method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(options && options.headers ? options.headers : {}) }
        };

        const req = https.request(reqOptions, (res) => {
            let data = ''; res.on('data', c => data += c);
            res.on('end', () => {
                console.log("[DEBUG] RES:", data);
                resolve({
                    ok: res.statusCode < 300, status: res.statusCode,
                    text: async () => data, json: async () => JSON.parse(data),
                    headers: { get: n => res.headers[n.toLowerCase()], getAll: n => [res.headers[n.toLowerCase()]], forEach: cb => { } }
                });
            });
        });
        req.on('error', reject); req.write(body || ""); req.end();
    });
};

const RPC_URL = "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/MnGSA2Mjm9SFFPUCuXWdP";
const ACCOUNT_ADDR = "0x054c172905114e7d0fdA1F4697B2D9837fe92C9C49F01ace4A5cA046901B227D";
const PRIVATE_KEY = "0x05fba985b63743a18ca48b48efb89662b2cc1c3c5c5e3296e6e6b4d33c709ede";

async function main() {
    // PASS BLOCK IDENTIFIER EXPLICITLY TO RPC PROVIDER IF POSSIBLE
    const provider = new RpcProvider({ nodeUrl: RPC_URL });
    const account = new Account(provider, ACCOUNT_ADDR, PRIVATE_KEY);

    console.log("Testing simple transfer (V1) on Alchemy...");
    try {
        const res = await account.execute({
            contractAddress: "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
            entrypoint: "transfer",
            calldata: [ACCOUNT_ADDR, "0x0", "0x0"]
        }, {
            maxFee: "1000000000000000"
        });
        console.log("Success! Hash:", res.transaction_hash);
    } catch (e) {
        console.error("Sign Check Failed:", e.message);
    }
}
main();
