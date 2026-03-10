/**
 * Vanilla Starknet Test on dRPC.
 */
const { RpcProvider, Account, constants } = require("starknet");

const RPC_URL = "https://starknet-sepolia.drpc.org";
const ACCOUNT_ADDR = "0x054c172905114e7d0fdA1F4697B2D9837fe92C9C49F01ace4A5cA046901B227D";
const PRIVATE_KEY = "0x05fba985b63743a18ca48b48efb89662b2cc1c3c5c5e3296e6e6b4d33c709ede";

async function main() {
    const provider = new RpcProvider({ nodeUrl: RPC_URL });
    const account = new Account(provider, ACCOUNT_ADDR, PRIVATE_KEY);

    console.log("Testing Vanilla V1 Transfer on dRPC...");
    try {
        const res = await account.execute({
            contractAddress: "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
            entrypoint: "transfer",
            calldata: [ACCOUNT_ADDR, "0x0", "0x0"]
        });
        console.log("Success! Hash:", res.transaction_hash);
    } catch (e) {
        console.error("Failed:", e.message);
    }
}
main();
