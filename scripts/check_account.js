/**
 * Check STRK Balance and Nonce.
 */
const { RpcProvider, constants, hash } = require("starknet");
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
const STRK_TOKEN = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";

async function main() {
    const provider = new RpcProvider({ nodeUrl: RPC_URL });
    try {
        const nonce = await provider.getNonceForAddress(ACCOUNT_ADDR, "latest");
        console.log(`Nonce: ${nonce}`);

        // Check STRK balance using hex selector for balanceOf
        const balance = await provider.callContract({
            contractAddress: STRK_TOKEN,
            entrypoint: "balanceOf",
            calldata: [ACCOUNT_ADDR]
        }, "latest");

        const low = BigInt(balance[0]);
        const high = BigInt(balance[1]);
        const full = (high << 64n) + low;

        console.log(`STRK Balance: ${Number(full) / 1e18} STRK`);
    } catch (e) {
        console.error("Check Failed:", e.message);
    }
}
main();
