/**
 * Test Starknet Signature validity for the account.
 */
const { RpcProvider, Account, constants } = require("starknet");
const https = require("https");

global.fetch = async (url, options) => {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url.toString());
        const req = https.request({
            hostname: urlObj.hostname, port: 443, path: urlObj.pathname, method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
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

const RPC_URL = "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/MnGSA2Mjm9SFFPUCuXWdP";
const ACCOUNT_ADDR = "0x054c172905114e7d0fdA1F4697B2D9837fe92C9C49F01ace4A5cA046901B227D";
const PRIVATE_KEY = "0x05fba985b63743a18ca48b48efb89662b2cc1c3c5c5e3296e6e6b4d33c709ede";

async function main() {
    const provider = new RpcProvider({ nodeUrl: RPC_URL, chainId: constants.StarknetChainId.SN_SEPOLIA });
    // Force latest for all provider calls if possible
    provider.blockIdentifier = "latest";
    const account = new Account(provider, ACCOUNT_ADDR, PRIVATE_KEY);

    console.log("Testing simple transfer (0 ETH to self)...");
    try {
        const res = await account.execute({
            contractAddress: "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
            entrypoint: "transfer",
            calldata: [ACCOUNT_ADDR, "0x0", "0x0"]
        });
        console.log("Success! Hash:", res.transaction_hash);
    } catch (e) {
        console.error("Sign Check Failed:", e.message);
        if (e.data) console.error(JSON.stringify(e.data, null, 2));
    }
}
main();
