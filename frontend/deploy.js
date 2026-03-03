/**
 * ProofPass Oracle Contract Deployment — Rust devnet 0.7.x compatible
 * Patches the internal starknet.js fetcher to replace 'pending' -> 'latest'
 */
const fs = require("fs");
const starknet = require("starknet");

const DEVNET_URL = "http://127.0.0.1:5050";
const ACCOUNT_ADDRESS = "0x064b48806902a367c8598f4f95c305e8c1a1acba5f082d294a43793113115691";
const PRIVATE_KEY = "0x0000000000000000000000000000000071d7bb07b9a64f6f78ac4c816aff4da9";
const BUILD_DIR = "../build";

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Intercept node's https/http to rewrite 'pending' -> 'latest' in request bodies
const http = require("http");
const originalRequest = http.request.bind(http);
http.request = function (options, callback) {
    // We need to patch the body - we do this by wrapping the ClientRequest
    const req = originalRequest(options, callback);
    const origWrite = req.write.bind(req);
    req.write = function (chunk, encoding, cb) {
        if (chunk) {
            let str = chunk.toString();
            if (str.includes('"pending"')) {
                str = str.replace(/"pending"/g, '"latest"');
                chunk = Buffer.from(str);
                // Update Content-Length header
                req.setHeader("content-length", chunk.length);
            }
        }
        return origWrite(chunk, encoding, cb);
    };
    return req;
};

async function main() {
    const provider = new starknet.RpcProvider({ nodeUrl: DEVNET_URL });
    const chainId = await provider.getChainId();
    console.log(`✓ Devnet connected. Chain: ${chainId}`);

    const account = new starknet.Account(provider, ACCOUNT_ADDRESS, PRIVATE_KEY, "1");
    console.log("Account:", account.address);

    async function waitForTx(hash) {
        process.stdout.write(`  tx ${hash.slice(0, 14)}...`);
        for (let i = 0; i < 60; i++) {
            try {
                const r = await provider.getTransactionReceipt(hash);
                if (r && r.execution_status) {
                    if (r.execution_status === "REVERTED") throw new Error("Reverted: " + r.revert_reason);
                    process.stdout.write(" ✓\n");
                    return r;
                }
            } catch (e) {
                if (e.message?.includes("everted")) throw e;
            }
            await sleep(1500);
            process.stdout.write(".");
        }
        throw new Error("Timeout: " + hash);
    }

    async function deployContract(name, constructorCalldata) {
        const path = `${BUILD_DIR}/${name}.json`;
        if (!fs.existsSync(path)) throw new Error(`Missing ${path} — run protostar build first`);
        const sierra = JSON.parse(fs.readFileSync(path, "utf8"));

        process.stdout.write(`Declaring ${name}... `);
        const { transaction_hash: dh, class_hash } = await account.declare({ contract: sierra });
        await waitForTx(dh);

        process.stdout.write(`Deploying ${name}... `);
        const payload = { classHash: class_hash };
        if (constructorCalldata) payload.constructorCalldata = constructorCalldata;
        const { transaction_hash: ph, contract_address } = await account.deploy(payload);
        await waitForTx(ph);

        const addr = Array.isArray(contract_address) ? contract_address[0] : contract_address;
        console.log(`  → ${addr}`);
        return addr;
    }

    try {
        const strkBtcAddr = await deployContract("mock_erc20", [account.address, "1000000000000000000", "0"]);
        const pvAddr = await deployContract("proof_verifier");
        const gaAddr = await deployContract("gate_adapter", [strkBtcAddr, pvAddr]);

        // Auto-update .env.local
        const envPath = ".env.local";
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

        console.log("\n=== .env.local UPDATED ===");
        for (const [k, v] of Object.entries(updates)) console.log(`${k}=${v}`);
        console.log("\n✓ Now restart Next.js: Ctrl+C then npm run dev");
    } catch (e) {
        console.error("\nDeploy failed:", e.message || e);
        process.exit(1);
    }
}

main().catch(e => { console.error("Fatal:", e.message || e); process.exit(1); });
