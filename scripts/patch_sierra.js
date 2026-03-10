const fs = require('fs');
const path = require('path');
const artifactsDir = 'contracts_v1/target/dev';
const contracts = ['MockERC20', 'ProofVerifier', 'GateAdapter', 'PolicyRegistry'];

contracts.forEach(name => {
    const p = path.join(artifactsDir, `proofpass_contracts_${name}.contract_class.json`);
    if (fs.existsSync(p)) {
        const d = JSON.parse(fs.readFileSync(p, 'utf8'));
        // Patch from Sierra 1.8.0 to 1.7.0 for dRPC compatibility
        if (d.sierra_program && d.sierra_program[0] === '0x1' && d.sierra_program[1] === '0x8') {
            console.log(`Patching ${name}: 1.8.0 -> 1.7.0`);
            d.sierra_program[1] = '0x7';
            fs.writeFileSync(p, JSON.stringify(d));
        } else {
            console.log(`Skipping ${name} (Version: ${d.sierra_program[0]}.${d.sierra_program[1]}.${d.sierra_program[2]})`);
        }
    }
});
