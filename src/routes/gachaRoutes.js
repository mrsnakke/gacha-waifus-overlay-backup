const express = require('express');
const gachaService = require('../services/gachaService');
const dataManager = require('../services/dataManager');
const { broadcast } = require('../utils/websocket');

const router = express.Router();

router.get('/pull-single', async (req, res) => {
    const redeemer = req.query.user || 'test-user';
    console.log(`[API] Single pull triggered by ${redeemer}`);
    
    const character = await gachaService.performSinglePull(redeemer);
    
    await gachaService.updateInventoryAndPulls(redeemer, [character], 1);
    await gachaService.writeLatestPullInfo(redeemer, [character], dataManager.userData.pity_counters[redeemer]);
    
    broadcast({
        event: 'gacha_wish',
        data: {
            pull_type: 'single',
            redeemer: redeemer,
            character: character
        }
    });

    res.status(200).send(`Single pull for ${redeemer} processed.`);
});

router.get('/pull-multi', async (req, res) => {
    const redeemer = req.query.user || 'test-user';
    console.log(`[API] Multi pull (x5) triggered by ${redeemer}`);
    
    const results = [];
    for (let i = 0; i < 5; i++) {
        const character = await gachaService.performSinglePull(redeemer);
        results.push(character);
    }
    
    await gachaService.updateInventoryAndPulls(redeemer, results, 5);
    await gachaService.writeLatestPullInfo(redeemer, results, dataManager.userData.pity_counters[redeemer]);

    broadcast({
        event: 'gacha_wish',
        data: {
            pull_type: 'multi',
            redeemer: redeemer,
            characters: results
        }
    });

    res.status(200).send(`Multi pull for ${redeemer} processed.`);
});

router.get('/pull-single-x1key', async (req, res) => {
    const redeemer = req.query.user;
    if (!redeemer) {
        return res.status(400).send('El parámetro "user" es requerido.');
    }

    console.log(`[API] Single pull with key triggered by ${redeemer}`);

    try {
        const character = await gachaService.pullSingleWithKey(redeemer);
        
        await gachaService.updateInventoryAndPulls(redeemer, [character], 1);
        await gachaService.writeLatestPullInfo(redeemer, [character], dataManager.userData.pity_counters[redeemer]);

        broadcast({
            event: 'gacha_wish',
            data: {
                pull_type: 'single',
                redeemer: redeemer,
                character: character
            }
        });

        res.status(200).send(`Single pull with key for ${redeemer} processed.`);
    } catch (error) {
        console.error(`[API] Error during single pull with key for ${redeemer}:`, error.message);
        res.status(400).send(error.message);
    }
});

module.exports = router;
