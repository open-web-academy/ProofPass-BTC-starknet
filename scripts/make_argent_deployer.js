const { ec, hash, CallData, stark } = require('starknet');

// Argent X Account Class Hash (Sepolia)
const ARGENT_X_CLASS_HASH = "0x01a736d6ed154502257f02b1ccdf4d9d1089f80811cdce60b86cb80aafbaebf6";

async function generateArgent() {
    // Generate a new random private key safely
    const privateKey = stark.randomAddress();

    // Get the corresponding public key
    const starkKeyPub = ec.starkCurve.getStarkKey(privateKey);

    // Argent X constructor calldata requires: [owner, guardian]
    // Guardian is 0 for standard accounts
    const constructorCalldata = CallData.compile({
        owner: starkKeyPub,
        guardian: "0"
    });

    // Calculate the expected address on Sepolia
    const address = hash.calculateContractAddressFromHash(
        starkKeyPub, // public key as salt is standard
        ARGENT_X_CLASS_HASH,
        constructorCalldata,
        0
    );

    console.log("=== NEW ARGENT X SEPOLIA ACCOUNT ===");
    console.log("Private Key:", privateKey);
    console.log("Public Key:", starkKeyPub);
    console.log("Address:", address);
    console.log("====================================");
}

generateArgent().catch(console.error);
