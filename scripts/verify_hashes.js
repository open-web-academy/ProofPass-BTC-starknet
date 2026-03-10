/**
 * Verify Sepolia Class hashes status via RPC.
 */
const { RpcProvider, constants } = require("starknet");
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
const hashes = {
    MockERC20: "0x3ff0ea653d6e89052d99ff854b594ea9b25a468a42250adfd43d1637e8cd451",
    ProofVerifier: "0x1b512698effee953910a0b7ac7bb0f54ab5ec20487e159d070d7ced59a4e45c",
    GateAdapter: "0x1432ac9b910f6f8f09c3f7ffeede8a62af1b729e86c1fab9293f811b12136d1",
    PolicyRegistry: "0x2c8ccbfcd9ddf8e43f286c463b366e87983a07435af329ccfc7949ffd29cbf1"
};

async function main() {
    const provider = new RpcProvider({ nodeUrl: RPC_URL });
    for (const [name, hash] of Object.entries(hashes)) {
        try {
            await provider.getClass(hash, "latest");
            console.log(`✅ ${name}: FOUND on chain`);
        } catch (e) {
            console.log(`❌ ${name}: NOT FOUND (${e.message})`);
        }
    }
}
main();
