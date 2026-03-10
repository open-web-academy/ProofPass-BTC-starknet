const { RpcProvider, Account } = require("starknet");

const rpcUrl = "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/MnGSA2Mjm9SFFPUCuXWdP";
const accountAddr = "0x054c172905114e7d0fdA1F4697B2D9837fe92C9C49F01ace4A5cA046901B227D";
const privateKey = "0x05fba985b63743a18ca48b48efb89662b2cc1c3c5c5e3296e6e6b4d33c709ede";

const provider = new RpcProvider({ nodeUrl: rpcUrl, blockIdentifier: 'latest' });
const account = new Account(provider, accountAddr, privateKey);

async function run() {
    try {
        console.log("Testing simple call...");
        const chainId = await provider.getChainId();
        console.log("✓ ChainID:", chainId);

        console.log("Testing nonce...");
        const nonce = await account.getNonce();
        console.log("✓ Nonce:", nonce);

        console.log("Testing fee estimation for a dummy transfer...");
        // Transfer 1 token to self
        const res = await account.estimateFee({
            contractAddress: "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
            entrypoint: "transfer",
            calldata: [accountAddr, "1", "0"]
        });
        console.log("✓ Fee Estimation:", res);

    } catch (e) {
        console.error("❌ Test failed:", e.message);
        if (e.data) console.error("❌ Error Data:", JSON.stringify(e.data, null, 2));
    }
}
run();
