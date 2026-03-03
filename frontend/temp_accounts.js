const http = require('http');

http.get('http://127.0.0.1:5050/predeployed_accounts', (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        const acc = JSON.parse(data)[2];
        console.log("Account Address:", acc.address);
        console.log("Private Key:", acc.private_key);
    });
});
