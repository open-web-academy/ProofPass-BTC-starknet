/**
 * Raw Declare Script for Alchemy (V1 + curl + Type Fix)
 */
const fs = require("fs");
const path = require("path");
const { RpcProvider, Account, json, hash, constants } = require("starknet");
const { execSync } = require("child_process");

const RPC_URL = "https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/MnGSA2Mjm9SFFPUCuXWdP";
const ACCOUNT_ADDR = "0x054c172905114e7d0fdA1F4697B2D9837fe92C9C49F01ace4A5cA046901B227D";
const PRIVATE_KEY = "0x05fba985b63743a18ca48b48efb89662b2cc1c3c5c5e3296e6e6b4d33c709ede";

async function main() {
    const provider = new RpcProvider({ nodeUrl: RPC_URL });
    const account = new Account(provider, ACCOUNT_ADDR, PRIVATE_KEY);

    async function declareRaw(name) {
        console.log(`\n> Preparing raw declaration for ${name}...`);
        const p = `contracts_v1/target/dev/proofpass_contracts_${name}.contract_class.json`;
        const cp = `contracts_v1/target/dev/proofpass_contracts_${name}.compiled_contract_class.json`;
        const sierra = json.parse(fs.readFileSync(p, "utf-8"));
        const casm = json.parse(fs.readFileSync(cp, "utf-8"));

        const sierraClassHash = hash.computeSierraContractClassHash(sierra);
        const compiledClassHash = hash.computeCompiledClassHash(casm);

        // Get nonce via direct call to bypass pending
        const nonceResp = execSync(`curl.exe -s -X POST ${RPC_URL} -H "Content-Type: application/json" -d "{\\\"jsonrpc\\\":\\\"2.0\\\",\\\"id\\\":1,\\\"method\\\":\\\"starknet_getNonceForAddress\\\",\\\"params\\\":[\\\"latest\\\",\\\"${ACCOUNT_ADDR}\\\"]}"`).toString();
        const nonce = JSON.parse(nonceResp).result;
        console.log(`  Nonce: ${nonce}`);

        // Sign locally (V1) - ENSURE ALL ARE STRINGS FOR CONSISTENCY
        const declareTx = {
            classHash: sierraClassHash,
            compiledClassHash: compiledClassHash,
            senderAddress: ACCOUNT_ADDR,
            nonce: nonce,
            maxFee: "10000000000000000",
            version: "0x1"
        };

        // Account.signer expects specific types, use helper
        const signature = await account.signer.signDeclareTransaction({
            classHash: declareTx.classHash,
            compiledClassHash: declareTx.compiledClassHash,
            senderAddress: declareTx.senderAddress,
            nonce: BigInt(declareTx.nonce),
            maxFee: BigInt(declareTx.maxFee),
            version: BigInt(declareTx.version),
            chainId: constants.StarknetChainId.SN_SEPOLIA
        });

        // Construct JSON-RPC body with array params
        const body = {
            jsonrpc: "2.0",
            id: 1,
            method: "starknet_addDeclareTransaction",
            params: [
                {
                    type: "DECLARE",
                    version: "0x1",
                    max_fee: declareTx.maxFee,
                    signature: signature,
                    nonce: nonce,
                    compiled_class_hash: compiledClassHash,
                    sender_address: ACCOUNT_ADDR,
                    contract_class: {
                        sierra_program: sierra.sierra_program,
                        entry_points_by_type: sierra.entry_points_by_type,
                        abi: JSON.stringify(sierra.abi),
                        sierra_version: "1.5.0"
                    }
                }
            ]
        };

        const jsonPath = path.resolve("./declare_tmp.json");
        const bodyStr = JSON.stringify(body, (key, value) =>
            typeof value === 'bigint' ? '0x' + value.toString(16) : value
        );
        fs.writeFileSync(jsonPath, bodyStr);

        console.log(`  Sending via curl...`);
        try {
            const out = execSync(`curl.exe -s -X POST ${RPC_URL} -H "Content-Type: application/json" -d "@${jsonPath}"`).toString();
            console.log(`  Result: ${out}`);
            const resp = JSON.parse(out);
            if (resp.error) {
                if (resp.error.message.includes("already declared")) {
                    console.log("! Already declared.");
                } else {
                    throw new Error(resp.error.message);
                }
            } else {
                console.log(`✅ Success! Hash: ${resp.result.transaction_hash}`);
                // Wait small bit for nonce increment on network
                await new Promise(r => setTimeout(r, 2000));
            }
        } catch (e) {
            console.error(`X Failed: ${e.message}`);
        }
    }

    try {
        await declareRaw("MockERC20");
        await declareRaw("ProofVerifier");
        await declareRaw("GateAdapter");
        await declareRaw("PolicyRegistry");
    } catch (err) { console.error(err); }
}
main();
