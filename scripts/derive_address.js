const { ec, hash, CallData } = require('starknet');

// The OpenZeppelin v0.9.0 class hash for Starknet (commonly used for new accounts)
const OZ_CLASS_HASH = "0x00e1cc938f32ac91aa795f70bb7fe1cc97d26bb4dc8ce015847e3a1bcde41b99";

const privateKey = "0x4ccfd8ce9e9f6048d3db09ec3ca151e39a5caeff35fb1456573c9e6c271887e";

const starkKeyPub = ec.starkCurve.getStarkKey(privateKey);

// Constructor calldata for an OZ account is just the public key
const constructorCalldata = CallData.compile([starkKeyPub]);

const address = hash.calculateContractAddressFromHash(
    starkKeyPub, // using public key as salt
    OZ_CLASS_HASH,
    constructorCalldata,
    0
);

console.log("Account Details:");
console.log("Private Key:", privateKey);
console.log("Public Key:", starkKeyPub);
console.log("Starknet Address:", address);
