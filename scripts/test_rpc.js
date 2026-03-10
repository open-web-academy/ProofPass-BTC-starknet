const { RpcProvider } = require("starknet");
console.log("Starknet.js loaded");
const rpcUrl = process.env.SEPOLIA_RPC_URL;
console.log("RPC URL:", rpcUrl);

const provider = new RpcProvider({ nodeUrl: rpcUrl });
provider.getChainId()
    .then(c => console.log("✓ Chain ID:", c))
    .catch(e => console.error("❌ Error:", e.message));
