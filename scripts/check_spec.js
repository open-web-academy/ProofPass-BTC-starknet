const https = require("https");
const RPC_URL = "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/MnGSA2Mjm9SFFPUCuXWdP";

async function main() {
    const urlObj = new URL(RPC_URL);
    const body = JSON.stringify({
        jsonrpc: "2.0",
        method: "starknet_specVersion",
        params: [],
        id: 1
    });

    const options = {
        hostname: urlObj.hostname,
        port: 443,
        path: urlObj.pathname,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    };

    const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
            console.log('Spec Version Response:', data);
        });
    });

    req.on('error', (e) => console.error(e));
    req.write(body);
    req.end();
}
main();
