const { ec, hash, CallData, stark } = require('starknet');

const ARGENT_X_CLASS_HASH = "0x01a736d6ed154502257f02b1ccdf4d9d1089f80811cdce60b86cb80aafbaebf6";

async function generateArgent() {
    const privateKey = stark.randomAddress();
    const starkKeyPub = ec.starkCurve.getStarkKey(privateKey);

    const constructorCalldata = CallData.compile({
        owner: starkKeyPub,
        guardian: "0"
    });

    const address = hash.calculateContractAddressFromHash(
        starkKeyPub,
        ARGENT_X_CLASS_HASH,
        constructorCalldata,
        0
    );

    console.log("=== NEW ARGENT X SEPOLIA ACCOUNT ===");
    console.log("Private Key:", privateKey);
    console.log("Address:", address);
    console.log("====================================");
}

generateArgent().catch(console.error);
