/**
 * Deploy script using starknet.js v5.x which does NOT use 'pending' block by default
 * Run from: frontend/temp_deploy/deploy_v5.js
 */
const fs = require("fs");
const { Provider, Account, Contract } = require("starknet");

const DEVNET_URL = "http://127.0.0.1:5050";
const ACCOUNT_ADDRESS = "0x064b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691";
const PRIVATE_KEY = "0x0000000000000000000000000000000071d7bb07b9a64f6f78ac4c816aff4da9";
const path = require("path");
const BUILD_DIR = path.resolve(__dirname, "../../build");


async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function waitForTx(provider, hash) {
    process.stdout.write(`  tx ${hash.slice(0, 12)}...`);
    for (let i = 0; i < 60; i++) {
        try {
            const status = await provider.getTransactionStatus(hash);
            const s = status.tx_status;
            if (s === "ACCEPTED_ON_L2" || s === "ACCEPTED_ON_L1") {
                process.stdout.write(" ✓\n");
                return;
            }
            if (s === "REJECTED") throw new Error(`TX rejected: ${hash}`);
        } catch (e) {
            if (e.message?.includes("REVERT") || e.message?.includes("rejected")) throw e;
        }
        await sleep(1500);
        process.stdout.write(".");
    }
    throw new Error("Timeout");
}

async function main() {
    const provider = new Provider({ rpc: { nodeUrl: DEVNET_URL } });
    const chainInfo = await provider.getChainId();
    console.log("✓ Chain:", chainInfo);

    const account = new Account(provider, ACCOUNT_ADDRESS, PRIVATE_KEY);
    console.log("Account:", account.address, "\n");

    async function deployContract(name, constructorCalldata) {
        const sierra = JSON.parse(fs.readFileSync(`${BUILD_DIR}/${name}.json`, "utf8"));
        process.stdout.write(`Declaring ${name}... `);
        const { transaction_hash: dh, class_hash } = await account.declare({ contract: sierra });
        await waitForTx(provider, dh);
        process.stdout.write(`Deploying ${name}... `);
        const payload = { classHash: class_hash };
        if (constructorCalldata) payload.constructorCalldata = constructorCalldata;
        const { transaction_hash: ph, contract_address } = await account.deploy(payload);
        await waitForTx(provider, ph);
        const addr = Array.isArray(contract_address) ? contract_address[0] : contract_address;
        console.log(`  → ${addr}`);
        return addr;
    }

    const strkBtcAddr = await deployContract("mock_erc20", [account.address, "1000000000000000000", "0"]);
    const pvAddr = await deployContract("proof_verifier");
    const gaAddr = await deployContract("gate_adapter", [strkBtcAddr, pvAddr]);

    // Update parent .env.local
    const envPath = "../.env.local";
    let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
    const updates = {
        NEXT_PUBLIC_STRKBTC_ADDRESS: strkBtcAddr,
        NEXT_PUBLIC_PROOF_VERIFIER_ADDRESS: pvAddr,
        NEXT_PUBLIC_GATE_ADAPTER_ADDRESS: gaAddr,
    };
    for (const [k, v] of Object.entries(updates)) {
        const re = new RegExp(`^${k}=.*$`, "m");
        const line = `${k}=${v}`;
        env = re.test(env) ? env.replace(re, line) : env + "\n" + line;
    }
    fs.writeFileSync(envPath, env, "utf8");

    console.log("\n=== DONE — .env.local updated ===");
    for (const [k, v] of Object.entries(updates)) console.log(`${k}=${v}`);
    console.log("\n✓ Restart Next.js: ctrl+c then npm run dev");
}

main().catch(e => { console.error("Fatal:", e.message || e); process.exit(1); });
