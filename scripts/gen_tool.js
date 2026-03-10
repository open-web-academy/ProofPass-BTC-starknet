const fs = require('fs');
const path = require('path');

const baseDir = 'c:/Users/giova/OneDrive/Documentos/Trabajo/ProofPass-BTC-starknet';
const names = ['MockERC20', 'ProofVerifier', 'GateAdapter', 'PolicyRegistry'];
const artifacts = {};

console.log("Reading artifacts...");
names.forEach(n => {
    const sPath = path.join(baseDir, 'contracts_v1/target/dev', `proofpass_contracts_${n}.contract_class.json`);
    const cPath = path.join(baseDir, 'contracts_v1/target/dev', `proofpass_contracts_${n}.compiled_contract_class.json`);

    if (fs.existsSync(sPath) && fs.existsSync(cPath)) {
        artifacts[n] = {
            sierra: JSON.parse(fs.readFileSync(sPath, 'utf8')),
            casm: JSON.parse(fs.readFileSync(cPath, 'utf8'))
        };
        console.log(`- Loaded ${n}`);
    } else {
        console.error(`- Missing files for ${n}`);
        process.exit(1);
    }
});

console.log("Generating tool from template...");
const templatePath = path.join(baseDir, 'scripts/template.html');
const outputPath = path.join(baseDir, 'scripts/DEPLOYER_TOOL.html');

let html = fs.readFileSync(templatePath, 'utf8');
html = html.replace('__ARTIFACTS_JSON__', JSON.stringify(artifacts));

fs.writeFileSync(outputPath, html);
console.log("✅ TOOL GENERATED: " + outputPath);
