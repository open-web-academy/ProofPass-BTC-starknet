const { RpcProvider, Contract } = require('starknet');

// Sepolia ETH Contract Address
const ETH_ADDRESS = "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7";
// Sepolia STRK Contract Address
const STRK_ADDRESS = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";

// The User's Wallet
const userAddress = "0x07766209285ca20d319174e205b4219eff585db15a0a8d53c08e79f00121d6d5";

async function checkBalance() {
    const provider = new RpcProvider({ nodeUrl: "https://starknet-sepolia.public.blastapi.io/rpc/v0_7" });

    const abi = [
        {
            "name": "balanceOf",
            "type": "function",
            "inputs": [
                {
                    "name": "account",
                    "type": "core::starknet::contract_address::ContractAddress"
                }
            ],
            "outputs": [
                {
                    "type": "core::integer::u256"
                }
            ],
            "state_mutability": "view"
        }
    ];

    try {
        const ethContract = new Contract(abi, ETH_ADDRESS, provider);
        const strkContract = new Contract(abi, STRK_ADDRESS, provider);

        const ethBal = await ethContract.balanceOf(userAddress);
        const strkBal = await strkContract.balanceOf(userAddress);

        console.log("=== BALANCES PARA:", userAddress, "===");
        console.log("ETH:", Number(ethBal) / 1e18);
        console.log("STRK:", Number(strkBal) / 1e18);
    } catch (e) {
        console.error("Error fetching balance:", e.message);
    }
}

checkBalance();
