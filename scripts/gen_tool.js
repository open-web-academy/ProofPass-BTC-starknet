const fs = require('fs');
const path = require('path');
const { hash, json } = require('starknet');

const baseDir = 'c:/Users/giova/OneDrive/Documentos/Trabajo/ProofPass-BTC-starknet';
const names = ['MockERC20', 'ProofVerifier', 'GateAdapter', 'PolicyRegistry'];

const artifacts = {};
const classHashes = {};

console.log("Reading artifacts and computing class hashes...");
names.forEach(n => {
    const sPath = path.join(baseDir, 'contracts_v1/target/dev', `proofpass_contracts_${n}.contract_class.json`);
    const cPath = path.join(baseDir, 'contracts_v1/target/dev', `proofpass_contracts_${n}.compiled_contract_class.json`);
    const sierra = json.parse(fs.readFileSync(sPath, 'utf8'));
    const casm = json.parse(fs.readFileSync(cPath, 'utf8'));
    artifacts[n] = { sierra, casm };
    classHashes[n] = hash.computeSierraContractClassHash(sierra);
    console.log(`- ${n}: ${classHashes[n]}`);
});

const htmlTemplate = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Starknet Sepolia Auto-Deployer</title>
    <style>
        body { font-family: 'Segoe UI', sans-serif; background: #0f172a; color: white; padding: 2rem; max-width: 900px; margin: auto; }
        .card { background: #1e293b; padding: 1.5rem; border-radius: 0.8rem; margin-bottom: 1.5rem; border: 1px solid #334155; }
        h1 { color: #3b82f6; text-align: center; margin-bottom: 2rem; }
        button { background: #3b82f6; color: white; border: none; padding: 0.8rem 1.5rem; border-radius: 0.4rem; cursor: pointer; font-weight: bold; font-size: 1rem; }
        button:hover { background: #2563eb; }
        button:disabled { background: #64748b; cursor: not-allowed; }
        .success { color: #34d399; margin-top: 0.8rem; border-left: 4px solid #059669; padding: 0.5rem 1rem; background: #064e3b33; }
        .error { color: #f87171; margin-top: 0.8rem; border-left: 4px solid #dc2626; padding: 0.5rem 1rem; background: #450a0a33; }
        .step { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #334155; padding: 1.2rem 0; gap: 2rem; }
        .step:last-child { border-bottom: none; }
        .step-info { flex: 1; }
        .hash { font-family: monospace; background: #020617; padding: 0.2rem 0.4rem; border-radius: 0.3rem; font-size: 0.8rem; color: #94a3b8; word-break: break-all; }
        pre#log { background: #020617; padding: 1rem; border-radius: 0.5rem; border: 1px solid #334155; height: 200px; overflow-y: scroll; font-size: 0.8rem; }
        pre#final { background: #020617; padding: 1rem; border-radius: 0.5rem; border: 1px solid #334155; font-family: monospace; }
        .loader { border: 2px solid #334155; border-top: 2px solid #3b82f6; border-radius: 50%; width: 14px; height: 14px; animation: spin 1s linear infinite; display: inline-block; vertical-align: middle; margin-right: 4px; }
        @keyframes spin { to { transform: rotate(360deg); } }
    </style>
</head>
<body>
    <h1>🚀 ProofPass Sepolia Auto-Deployer</h1>

    <div class="card">
        <h3>1. Conectar Wallet</h3>
        <button id="connectBtn">Conectar Wallet</button>
        <span id="accountStatus" style="margin-left:1rem; font-size: 0.9rem;">No conectado</span>
        <div id="networkError" class="error" style="display:none; margin-top: 0.5rem;">⚠️ Cambia a <b>Starknet Sepolia</b> en tu wallet.</div>
    </div>

    <div class="card">
        <h3>2. Desplegar Contratos (en orden)</h3>
        <div id="steps"></div>
    </div>

    <div class="card">
        <h3>3. Variables para Vercel / .env.local</h3>
        <pre id="final">Esperando despliegues...</pre>
        <button id="copyBtn" disabled style="background: #10b981; margin-top: 0.5rem;">Copiar al Portapapeles</button>
    </div>

    <div class="card">
        <h3>Logs de Actividad</h3>
        <pre id="log">--- Herramienta lista (sin CDN externo) ---\\n</pre>
    </div>

    <script>
    // Pre-computed data - no external libraries needed
    const ARTIFACTS = ARTIFACTS_PLACEHOLDER;
    const CLASS_HASHES = CLASS_HASHES_PLACEHOLDER;

    let account;
    const addresses = {};

    const logEl = document.getElementById('log');
    function log(msg, err = false) {
        const s = document.createElement('span');
        s.style.color = err ? '#f87171' : '#94a3b8';
        s.innerText = '[' + new Date().toLocaleTimeString() + '] ' + msg + '\\n';
        logEl.appendChild(s);
        logEl.scrollTop = logEl.scrollHeight;
    }

    function updateFinal() {
        let txt = '';
        if (addresses.MockERC20) txt += 'NEXT_PUBLIC_STRKBTC_ADDRESS=' + addresses.MockERC20 + '\\n';
        if (addresses.ProofVerifier) txt += 'NEXT_PUBLIC_PROOF_VERIFIER_ADDRESS=' + addresses.ProofVerifier + '\\n';
        if (addresses.GateAdapter) txt += 'NEXT_PUBLIC_GATE_ADAPTER_ADDRESS=' + addresses.GateAdapter + '\\n';
        if (addresses.PolicyRegistry) txt += 'NEXT_PUBLIC_POLICY_REGISTRY_ADDRESS=' + addresses.PolicyRegistry + '\\n';
        document.getElementById('final').innerText = txt || 'Esperando...';
        if (txt) document.getElementById('copyBtn').disabled = false;
    }

    const names = ['MockERC20', 'ProofVerifier', 'GateAdapter', 'PolicyRegistry'];
    names.forEach(name => {
        const div = document.createElement('div');
        div.className = 'step';
        div.innerHTML = '<div class="step-info"><strong>' + name + '</strong><div id="s-' + name + '" style="font-size:0.8rem; color:#64748b;">Esperando...</div></div><button id="b-' + name + '" disabled>Desplegar</button>';
        document.getElementById('steps').appendChild(div);

        document.getElementById('b-' + name).onclick = async () => {
            const btn = document.getElementById('b-' + name);
            const st = document.getElementById('s-' + name);
            btn.disabled = true;

            try {
                const { sierra, casm } = ARTIFACTS[name];
                const classHash = CLASS_HASHES[name];
                log(name + ': classHash=' + classHash);

                st.innerHTML = '<div class="loader"></div>Declarando clase...';
                try {
                    const d = await account.declare({ contract: sierra, casm });
                    log(name + ' declare TX: ' + d.transaction_hash);
                    st.innerHTML = '<div class="loader"></div>Esperando confirmación...';
                    await account.waitForTransaction(d.transaction_hash);
                    log(name + ': clase declarada OK.');
                } catch(e) {
                    if (!e.message.toLowerCase().includes('already declared')) throw e;
                    log(name + ': clase ya existía, continuando.');
                }

                let calldata = [];
                if (name === 'MockERC20') calldata = [account.address, '1000000000', '0'];
                if (name === 'ProofVerifier') calldata = ['0x6eb62dc263aa156dd37a146aa1d1021357bfffa47ca23479a4c3844d9282ce6'];
                if (name === 'GateAdapter') calldata = [addresses.MockERC20, addresses.ProofVerifier];
                if (name === 'PolicyRegistry') calldata = [account.address];

                st.innerHTML = '<div class="loader"></div>Desplegando instancia...';
                const { transaction_hash, contract_address } = await account.deployContract({ classHash, constructorCalldata: calldata });
                log(name + ' deploy TX: ' + transaction_hash);
                st.innerHTML = '<div class="loader"></div>Confirmando deploy...';
                await account.waitForTransaction(transaction_hash);

                addresses[name] = contract_address;
                st.className = 'success';
                st.innerHTML = '✅ <span class="hash">' + contract_address + '</span>';
                log('¡' + name + ' desplegado en ' + contract_address + '!');
                updateFinal();
            } catch(e) {
                log('ERROR ' + name + ': ' + e.message, true);
                st.className = 'error';
                st.innerHTML = 'Error: ' + e.message;
                btn.disabled = false;
            }
        };
    });

    document.getElementById('connectBtn').onclick = async () => {
        log('Buscando wallet...');
        let walletObj = null;
        const skip = new Set(['window','self','top','parent','frames','document','location','history','navigator','screen','performance']);
        for (const key of Object.getOwnPropertyNames(window)) {
            try {
                if (skip.has(key)) continue;
                const val = window[key];
                if (val && typeof val === 'object' && typeof val.enable === 'function' && (val.id || val.name)) {
                    log('Wallet: window.' + key + ' (' + (val.id || val.name) + ')');
                    walletObj = val;
                    break;
                }
            } catch(e) {}
        }
        if (!walletObj) { log('No se detectó wallet. ¿Argent X instalado?', true); return; }

        try {
            await walletObj.enable();
            account = walletObj.account;
            const chainId = await account.getChainId();
            log('Red: ' + chainId);
            if (chainId !== '0x534e5f5345504f4c4941' && !chainId.toLowerCase().includes('sepolia')) {
                document.getElementById('networkError').style.display = 'block';
                log('ERROR: Cambia a Sepolia.', true);
            } else {
                document.getElementById('networkError').style.display = 'none';
                document.getElementById('accountStatus').innerText = '✅ ' + account.address.slice(0,14) + '...';
                document.querySelectorAll('button').forEach(b => { if(b.id !== 'copyBtn') b.disabled = false; });
                log('Wallet lista. ¡Despliega los contratos!');
            }
        } catch(e) { log('Error: ' + e.message, true); }
    };

    document.getElementById('copyBtn').onclick = () => {
        navigator.clipboard.writeText(document.getElementById('final').innerText);
        alert('¡Copiado! Pégalo en Vercel → Environment Variables.');
    };
    </script>
</body>
</html>`;

let html = htmlTemplate
    .replace('ARTIFACTS_PLACEHOLDER', JSON.stringify(artifacts))
    .replace('CLASS_HASHES_PLACEHOLDER', JSON.stringify(classHashes));

const outputPath = path.join(baseDir, 'scripts/DEPLOYER_TOOL.html');
fs.writeFileSync(outputPath, html);
console.log('\n✅ TOOL GENERATED (no external CDN): ' + outputPath);
console.log('\nClass hashes pre-computed:');
Object.entries(classHashes).forEach(([n, h]) => console.log(`  ${n}: ${h}`));
