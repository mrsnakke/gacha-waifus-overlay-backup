// websocket.js
// --- CÓDIGO CORREGIDO Y LIMPIO ---
// Maneja la conexión WebSocket con Streamer.bot

const WS_PORT = 8085; // Puerto correcto, debe coincidir con el puerto del servidor Node.js
const WS_ADDRESS = `ws://192.168.50.254:${WS_PORT}/`; // Usar la IP de la máquina servidora

let ws;

function connectWebSocket() {
    ws = new WebSocket(WS_ADDRESS);

    ws.onopen = () => {
        console.log('Conectado al servidor WebSocket.');
        document.getElementById('websocket-status-indicator').classList.add('connected');
    };

    ws.onmessage = (event) => {
    console.log("MENSAJE BRUTO RECIBIDO:", event.data);
    try {
        const message = JSON.parse(event.data);

        if (message.event === 'test_message' && message.data) {
            console.log("¡Evento 'test_message' recibido!");
            if (typeof displayTestMessage === 'function') {
                displayTestMessage(message.data.text);
            } else {
                console.error("La función displayTestMessage no existe en script.js");
            }

        } else if (message.event === 'gacha_wish' && message.data) {
            console.log("¡Evento 'gacha_wish' reconocido y válido!");
            if (message.data.pull_type === 'single' && message.data.character) {
                handleSinglePullRequest(message.data.redeemer, message.data.character);
            } else if (message.data.pull_type === 'multi' && message.data.characters) {
                handleMultiPullRequest(message.data.redeemer, message.data.characters);
            }
        } else {
            console.log("Mensaje de conexión recibido.");
        }
    } catch (e) {
        console.error("Error al parsear JSON:", e);
    }
};

    ws.onclose = () => {
        console.log('Desconectado de Streamer.bot WebSocket. Intentando reconectar en 3 segundos...');
        document.getElementById('websocket-status-indicator').classList.remove('connected');
        setTimeout(connectWebSocket, 3000); // Intenta reconectar después de 3 segundos
    };

    ws.onerror = (error) => {
        console.error('Error en WebSocket:', error);
        document.getElementById('websocket-status-indicator').classList.remove('connected');
        ws.close(); // Cierra la conexión para intentar reconectar
    };
}

// Iniciar la conexión cuando la página se cargue
document.addEventListener('DOMContentLoaded', () => {
    connectWebSocket();
});
