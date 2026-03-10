const { RpcProvider, uint256 } = require("starknet");

const rpcUrl = "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/MnGSA2Mjm9SFFPUCuXWdP";
const accountAddr = "0x054c172905114e7d0fdA1F4697B2D9837fe92C9C49F01ace4A5cA046901B227D";

const provider = new RpcProvider({ nodeUrl: rpcUrl, blockIdentifier: 'latest' });

const ETH_ADDR = "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7";
const STRK_ADDR = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";

async function getBalance(tokenAddr, name) {
    try {
        const res = await provider.callContract({
            contractAddress: tokenAddr,
            entrypoint: "balanceOf",
            calldata: [accountAddr]
        });

        // In starknet.js v6, callContract result can be a raw array
        const data = Array.isArray(res) ? res : (res.result || []);

        if (data.length >= 2) {
            const low = data[0];
            const high = data[1];
            const amount = uint256.uint256ToBN({ low, high });
            console.log(`✓ ${name} Balance: ${amount.toString()} (raw)`);
            console.log(`✓ ${name} Balance: ${Number(amount) / 1e18} ${name}`);
            return amount;
        } else {
            console.log(`! ${name} returned unexpected format:`, res);
        }
    } catch (e) {
        console.error(`❌ Error fetching ${name}:`, e.message);
    }
    return 0n;
}

async function run() {
    console.log("--- DIAGNOSTICS ---");
    console.log("Account:", accountAddr);

    try {
        const nonce = await provider.getNonceForAddress(accountAddr);
        console.log("✓ Nonce:", nonce);
    } catch (e) {
        console.log("❌ Nonce failed:", e.message);
    }

    await getBalance(ETH_ADDR, "ETH");
    await getBalance(STRK_ADDR, "STRK");
    console.log("-------------------");
}

run();
