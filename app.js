const express = require('express');
const http = require('http');
const path = require('path');

const dataManager = require('./src/services/dataManager');
const websocket = require('./src/utils/websocket');
const gachaRoutes = require('./src/routes/gachaRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const tradeRoutes = require('./src/routes/tradeRoutes');

const app = express();
const server = http.createServer(app);

const PORT = 8085;

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'web')));

// Inicializar WebSocket Server
websocket.initializeWebSocketServer(server);

// Rutas
app.use('/', gachaRoutes); // Las rutas de gacha están en la raíz
app.use('/admin', adminRoutes); // Las rutas de administración están bajo /admin
app.use('/api', tradeRoutes); // Las rutas de tradeo

// Iniciar el servidor
dataManager.loadGachaData().then(() => {
    server.listen(PORT, '0.0.0.0', () => {
        const url = `http://localhost:${PORT}/admin.html`;
        console.log(`Servidor GachaWish iniciado en el puerto ${PORT}.`);
        console.log(`Panel de administración disponible en: ${url}`);
        // Usar import dinámico para la librería 'open'
        import('open').then(openModule => {
            openModule.default(url);
        }).catch(err => {
            console.error("Error al intentar abrir el navegador:", err);
        });
    });
}).catch(error => {
    console.error("No se pudo iniciar el servidor debido a un error al cargar los datos.", error);
});
