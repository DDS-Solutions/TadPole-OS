import WebSocket from 'ws';

const URL = 'ws://localhost:8000/events';

console.log(`Connecting to ${URL}...`);

const ws = new WebSocket(URL, {
    headers: {
        'Origin': 'http://localhost:5173'
    }
});

ws.on('open', () => {
    console.log('✅ Connected successfully!');
    ws.close();
});

ws.on('error', (err) => {
    console.error('❌ Connection failed:', err.message);
});

ws.on('close', (code, reason) => {
    console.log(`🔌 Closed: ${code} ${reason}`);
});

setTimeout(() => {
    console.log('⌛ Timeout reaching 5s. Exiting.');
    process.exit(0);
}, 5000);
