const { loadUserInventory, saveUserInventory, loadTrades, saveTrades } = require('./dataManager');
const { v4: uuidv4 } = require('uuid');

async function createTrade(offeringPlayer, receivingPlayer, characterName) {
    const inventory = await loadUserInventory();
    const trades = await loadTrades();

    // 1. Verificar si el jugador que ofrece tiene el personaje
    if (!inventory[offeringPlayer] || !inventory[offeringPlayer].includes(characterName)) {
        throw new Error(`${offeringPlayer} no tiene el personaje ${characterName}.`);
    }

    // 2. Crear la oferta de tradeo
    const tradeId = uuidv4();
    const newTrade = {
        id: tradeId,
        offeringPlayer,
        receivingPlayer,
        characterName,
        status: 'pending', // pending, accepted, cancelled
        createdAt: new Date().toISOString()
    };

    trades[tradeId] = newTrade;
    await saveTrades(trades);

    return newTrade;
}

async function acceptTrade(tradeId, acceptingPlayer) {
    const trades = await loadTrades();
    const trade = trades[tradeId];

    // 1. Validar el trade
    if (!trade) {
        throw new Error('El trade no existe.');
    }
    if (trade.status !== 'pending') {
        throw new Error('El trade ya no está pendiente.');
    }
    if (trade.receivingPlayer !== acceptingPlayer) {
        throw new Error('No puedes aceptar un trade que no es para ti.');
    }

    // 2. Realizar el intercambio
    const inventory = await loadUserInventory();
    const { offeringPlayer, receivingPlayer, characterName } = trade;

    // Quitar personaje del oferente
    const offeringPlayerInventory = inventory[offeringPlayer] || [];
    const charIndex = offeringPlayerInventory.indexOf(characterName);
    if (charIndex > -1) {
        offeringPlayerInventory.splice(charIndex, 1);
    } else {
        // Si el personaje ya no está, cancelar el trade para evitar inconsistencias
        trade.status = 'cancelled';
        await saveTrades(trades);
        throw new Error(`El personaje ${characterName} ya no está en el inventario de ${offeringPlayer}. Trade cancelado.`);
    }

    // Añadir personaje al receptor
    if (!inventory[receivingPlayer]) {
        inventory[receivingPlayer] = [];
    }
    inventory[receivingPlayer].push(characterName);

    // 3. Actualizar estado y guardar
    trade.status = 'accepted';
    trades[tradeId] = trade;

    await saveUserInventory(inventory);
    await saveTrades(trades);

    return trade;
}

async function cancelTrade(tradeId, cancellingPlayer) {
    const trades = await loadTrades();
    const trade = trades[tradeId];

    // 1. Validar el trade
    if (!trade) {
        throw new Error('El trade no existe.');
    }
    if (trade.status !== 'pending') {
        throw new Error('El trade ya no está pendiente.');
    }
    if (trade.offeringPlayer !== cancellingPlayer && trade.receivingPlayer !== cancellingPlayer) {
        throw new Error('No puedes cancelar un trade en el que no participas.');
    }

    // 2. Actualizar estado y guardar
    trade.status = 'cancelled';
    trades[tradeId] = trade;
    await saveTrades(trades);

    return trade;
}

async function getTradesForPlayer(playerName) {
    const trades = await loadTrades();
    const playerTrades = {
        sent: [],
        received: []
    };

    for (const tradeId in trades) {
        const trade = trades[tradeId];
        if (trade.offeringPlayer === playerName) {
            playerTrades.sent.push(trade);
        }
        if (trade.receivingPlayer === playerName) {
            playerTrades.received.push(trade);
        }
    }

    return playerTrades;
}

module.exports = {
    createTrade,
    acceptTrade,
    cancelTrade,
    getTradesForPlayer
};
