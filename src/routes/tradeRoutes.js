const express = require('express');
const router = express.Router();
const tradeService = require('../services/tradeService');

// Crear una oferta de tradeo
router.post('/trade', async (req, res) => {
    const { offeringPlayer, receivingPlayer, characterName } = req.body;
    if (!offeringPlayer || !receivingPlayer || !characterName) {
        return res.status(400).json({ message: 'Faltan datos para crear el trade.' });
    }

    try {
        const newTrade = await tradeService.createTrade(offeringPlayer, receivingPlayer, characterName);
        res.status(201).json(newTrade);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Aceptar una oferta de tradeo
router.post('/trade/:id/accept', async (req, res) => {
    const { id } = req.params;
    const { acceptingPlayer } = req.body;

    if (!acceptingPlayer) {
        return res.status(400).json({ message: 'Falta el nombre del jugador que acepta el trade.' });
    }

    try {
        const updatedTrade = await tradeService.acceptTrade(id, acceptingPlayer);
        res.status(200).json(updatedTrade);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Cancelar una oferta de tradeo
router.post('/trade/:id/cancel', async (req, res) => {
    const { id } = req.params;
    const { cancellingPlayer } = req.body;

    if (!cancellingPlayer) {
        return res.status(400).json({ message: 'Falta el nombre del jugador que cancela el trade.' });
    }

    try {
        const updatedTrade = await tradeService.cancelTrade(id, cancellingPlayer);
        res.status(200).json(updatedTrade);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Obtener trades de un jugador
router.get('/trades/:playerName', async (req, res) => {
    const { playerName } = req.params;
    try {
        const trades = await tradeService.getTradesForPlayer(playerName);
        res.status(200).json(trades);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener los trades del jugador.' });
    }
});

module.exports = router;
