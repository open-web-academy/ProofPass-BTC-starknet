/**
 * Check ETH Balance.
 */
const { RpcProvider, constants } = require("starknet");
const https = require("https");

global.fetch = async (url, options) => {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url.toString());
        const reqOptions = {
            hostname: urlObj.hostname, port: 443, path: urlObj.pathname, method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
        };
        const req = https.request(reqOptions, (res) => {
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
const ETH_TOKEN = "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7";

async function main() {
    const provider = new RpcProvider({ nodeUrl: RPC_URL });
    try {
        const balance = await provider.callContract({
            contractAddress: ETH_TOKEN,
            entrypoint: "balanceOf",
            calldata: [ACCOUNT_ADDR]
        }, "latest");

        const low = BigInt(balance[0]);
        const high = BigInt(balance[1]);
        const full = (high << 64n) + low;

        console.log(`ETH Balance: ${Number(full) / 1e18} ETH`);
    } catch (e) {
        console.error("Check Failed:", e.message);
    }
}
main();
