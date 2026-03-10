const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
    // Servir siempre el archivo DEPLOYER_TOOL.html por defecto
    let filePath = path.join(__dirname, req.url === '/' ? 'DEPLOYER_TOOL.html' : req.url);

    // Si el archivo no existe o es una carpeta, intentar servir el HTML principal
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(__dirname, 'DEPLOYER_TOOL.html');
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end("Archivo no encontrado");
            return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log('==================================================');
    console.log(`🚀 Servidor listo en: http://localhost:${PORT}`);
    console.log('==================================================');
    console.log('Acciones:');
    console.log('1. Abre http://localhost:3000 en tu navegador.');
    console.log('2. Conecta tu Wallet y despliega los contratos.');
    console.log('3. Presiona Ctrl+C en esta terminal para cerrar.');
});
