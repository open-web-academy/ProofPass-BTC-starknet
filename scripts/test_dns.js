const dns = require('dns').promises;
const resolver = new dns.Resolver();
resolver.setServers(['8.8.8.8']); // Google DNS

async function test() {
    try {
        console.log('Attempting to resolve rpc.starknet.io via 8.8.8.8...');
        const addresses = await resolver.resolve4('rpc.starknet.io');
        console.log('rpc.starknet.io resolved to:', addresses);
        process.exit(0);
    } catch (e) {
        console.error('DNS Resolution failed:', e.message);
        process.exit(1);
    }
}
test();
