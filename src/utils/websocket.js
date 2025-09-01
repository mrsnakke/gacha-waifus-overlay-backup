const { WebSocketServer } = require('ws');

let wss;

function initializeWebSocketServer(server) {
    wss = new WebSocketServer({ server });

    wss.on('connection', (ws) => {
        console.log('Client connected to overlay server');
        ws.on('close', () => console.log('Client disconnected'));
    });
}

function broadcast(data) {
    if (!wss) {
        console.error('WebSocketServer not initialized.');
        return;
    }
    wss.clients.forEach((client) => {
        if (client.readyState === client.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

module.exports = {
    initializeWebSocketServer,
    broadcast
};
