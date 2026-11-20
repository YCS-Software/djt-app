const WebSocket = require('ws');

const ws = new WebSocket('ws://3.110.84.196:5000/ocpp/DJT-12-CP1-T6I');

ws.on('open', () => {
    console.log('Connected');
});

ws.on('message', (data) => {
    console.log('Received:', data.toString());
});

ws.on('error', (err) => {
    console.error('Error:', err);
});

ws.on('close', () => {
    console.log('Disconnected');
});