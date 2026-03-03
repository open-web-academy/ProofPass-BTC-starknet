const { ec, stark } = require("starknet");

const privateKey = stark.randomAddress();
const publicKey = ec.starkCurve.getStarkKey(privateKey);

console.log("--- Oracle Keys Generated ---");
console.log("ORACLE_PRIVATE_KEY=" + privateKey);
console.log("NEXT_PUBLIC_ORACLE_PUBLIC_KEY=" + publicKey);
console.log("Save these to your .env.local file");
