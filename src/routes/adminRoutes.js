const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const upload = require('../config/multerConfig'); // Importar la configuración de Multer
const dataManager = require('../services/dataManager'); // Importar el dataManager

const router = express.Router();

// Endpoint para obtener la información de los endpoints
router.get('/endpoints', (req, res) => {
    const port = 8085; // O podrías obtenerlo de una variable de entorno
    const ipPlaceholder = 'YOUR_IP_ADDRESS'; // O podrías intentar obtener la IP local

    const endpoints = {
        streamerbot: [
            `Single Pull: http://${ipPlaceholder}:${port}/pull-single?user=USERNAME`,
            `Multi Pull:  http://${ipPlaceholder}:${port}/pull-multi?user=USERNAME`
        ],
        admin: [
            `Clear All Data: http://${ipPlaceholder}:${port}/admin/clear-all-data?confirm=true`,
            `Admin Panel: http://${ipPlaceholder}:${port}/admin.html`
        ],
        trade: `Trade Page: http://${ipPlaceholder}:${port}/trades.html`
    };

    res.json(endpoints);
});

// --- ADMIN ENDPOINTS ---
router.get('/clear-all-data', async (req, res) => {
    const { confirm } = req.query;

    if (confirm !== 'true') {
        const message = 'Confirmation not provided. Please add ?confirm=true to the URL to proceed with clearing all data.';
        console.log(`[ADMIN] Data clearing aborted. ${message}`);
        return res.status(400).send(message);
    }

    console.log('[ADMIN] Received confirmed request to clear all user data.');
    try {
        dataManager.userData = { pity_counters: {} };
        await fs.writeFile(dataManager.USER_DATA_PATH, JSON.stringify(dataManager.userData, null, 2));
        console.log('[ADMIN] All pity data has been cleared.');

        await fs.writeFile(dataManager.INVENTORY_DATA_PATH, JSON.stringify({}, null, 2));
        console.log('[ADMIN] All inventory data has been cleared.');

        const successMessage = 'All user pity and inventory data has been successfully cleared.';
        console.log(`[ADMIN] ${successMessage}`);
        res.status(200).send(successMessage);
    } catch (error) {
        console.error('[ADMIN] Failed to clear user data:', error);
        res.status(500).send('An error occurred while clearing user data.');
    }
});

// Endpoint para obtener todos los personajes y banners
router.get('/characters', async (req, res) => {
    try {
        await dataManager.loadGachaData(); 
        res.json({
            standard_banner: dataManager.standardBanner,
            seasonal_banner: dataManager.seasonalBanner,
            character_details: dataManager.characterData
        });
    } catch (error) {
        console.error('Error al obtener datos de personajes para admin:', error);
        res.status(500).json({ error: 'Error interno del servidor al cargar personajes.' });
    }
});

// Endpoint para obtener detalles de un personaje específico
router.get('/character-details/:name', async (req, res) => {
    const charName = req.params.name;
    try {
        await dataManager.loadGachaData(); 
        const charDetails = dataManager.characterData[charName];
        if (charDetails) {
            let banner = '';
            for (const bKey of ['standard_banner', 'seasonal_banner']) {
                const currentBanner = (bKey === 'standard_banner') ? dataManager.standardBanner : dataManager.seasonalBanner;
                for (const rarityKey in currentBanner) {
                    if (currentBanner[rarityKey].includes(charName)) {
                        banner = bKey;
                        break;
                    }
                }
                if (banner) break;
            }
            res.json({ ...charDetails, rarity: charDetails.rarity, banner: banner });
        } else {
            res.status(404).json({ error: 'Personaje no encontrado.' });
        }
    } catch (error) {
        console.error(`Error al obtener detalles del personaje ${charName}:`, error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// Endpoint para añadir un nuevo personaje
router.post('/character', upload.single('image'), async (req, res) => {
    const { name, rarity, banner, stock } = req.body;
    const imageFile = req.file;

    if (!name || !rarity || !banner) {
        return res.status(400).json({ error: 'Faltan campos obligatorios: nombre, rareza o banner.' });
    }

    const safeName = name.replace(/[\\/:*?"<>|]/g, '');
    const charFileName = `${safeName}.json`;
    const charFilePath = path.join(dataManager.GACHA_DATA_PATH, 'characters', charFileName);

    if (await fs.access(charFilePath).then(() => true).catch(() => false)) {
        return res.status(409).json({ error: `El personaje '${name}' ya existe.` });
    }

    let imageUrl = '';
    if (imageFile) {
        imageUrl = path.join('img', 'characters', rarity, imageFile.filename).replace(/\\/g, '/');
    }

    const newCharacter = {
        name: name,
        rarity: rarity,
        image_url: imageUrl,
        description: `Un nuevo personaje de ${rarity.replace('_star', ' estrellas')}.`,
        stock: (rarity === '5_star' || rarity === '6_star') && banner === 'seasonal_banner' ? parseInt(stock) : undefined
    };

    try {
        await fs.writeFile(charFilePath, JSON.stringify(newCharacter, null, 2));

        const targetBanner = (banner === 'standard_banner') ? dataManager.standardBanner : dataManager.seasonalBanner;
        if (!targetBanner[rarity]) {
            targetBanner[rarity] = [];
        }
        targetBanner[rarity].push(name);

        await fs.writeFile(path.join(dataManager.GACHA_DATA_PATH, 'banners', `${banner}.json`), JSON.stringify(targetBanner, null, 2));

        dataManager.characterData[name] = newCharacter;
        if (banner === 'standard_banner') dataManager.standardBanner = targetBanner;
        else dataManager.seasonalBanner = targetBanner;

        if (newCharacter.stock !== undefined) {
            if (!dataManager.gachaConfig.character_stocks) {
                dataManager.gachaConfig.character_stocks = {};
            }
            dataManager.gachaConfig.character_stocks[name] = newCharacter.stock;
            await dataManager.saveGachaConfig();
        }

        res.status(201).json({ message: `Personaje '${name}' añadido exitosamente.`, character: newCharacter });
    } catch (error) {
        console.error('Error al añadir personaje:', error);
        res.status(500).json({ error: 'Error interno del servidor al añadir personaje.' });
    }
});

// Endpoint para editar un personaje existente
router.put('/character/:oldName', upload.single('image'), async (req, res) => {
    const oldName = req.params.oldName;
    const { name, rarity, banner, stock } = req.body;
    const imageFile = req.file;

    if (!name || !rarity || !banner) {
        return res.status(400).json({ error: 'Faltan campos obligatorios: nombre, rareza o banner.' });
    }

    const safeOldName = oldName.replace(/[\\/:*?"<>|]/g, '');
    const safeNewName = name.replace(/[\\/:*?"<>|]/g, '');

    const oldCharFilePath = path.join(dataManager.GACHA_DATA_PATH, 'characters', `${safeOldName}.json`);
    const newCharFileName = `${safeNewName}.json`;
    const newCharFilePath = path.join(dataManager.GACHA_DATA_PATH, 'characters', newCharFileName);

    try {
        let existingCharDetails = dataManager.characterData[oldName];
        if (!existingCharDetails) {
            return res.status(404).json({ error: 'Personaje original no encontrado para editar.' });
        }

        if (oldName !== name) {
            if (await fs.access(newCharFilePath).then(() => true).catch(() => false)) {
                return res.status(409).json({ error: `Ya existe un personaje con el nombre '${name}'.` });
            }
            await fs.rename(oldCharFilePath, newCharFilePath);
            delete dataManager.characterData[oldName];
        }

        let imageUrl = existingCharDetails.image_url;
        if (imageFile) {
            if (existingCharDetails.image_url) {
                const oldImagePath = path.join(__dirname, '..', '..', 'web', existingCharDetails.image_url);
                if (await fs.access(oldImagePath).then(() => true).catch(() => false)) {
                    await fs.unlink(oldImagePath);
                }
            }
            imageUrl = path.join('img', 'characters', rarity, imageFile.filename).replace(/\\/g, '/');
        } else if (existingCharDetails.rarity !== rarity && existingCharDetails.image_url) {
            const oldImagePath = path.join(__dirname, '..', '..', 'web', existingCharDetails.image_url);
            const newImageDir = path.join(__dirname, '..', '..', 'web', 'img', 'characters', rarity);
            await fs.mkdir(newImageDir, { recursive: true });
            const newImagePath = path.join(newImageDir, path.basename(existingCharDetails.image_url));
            await fs.rename(oldImagePath, newImagePath);
            imageUrl = path.join('img', 'characters', rarity, path.basename(existingCharDetails.image_url)).replace(/\\/g, '/');
        }

        const updatedCharacter = {
            ...existingCharDetails,
            name: name,
            rarity: rarity,
            image_url: imageUrl,
            stock: (rarity === '5_star' || rarity === '6_star') && banner === 'seasonal_banner' ? parseInt(stock) : undefined
        };

        await fs.writeFile(newCharFilePath, JSON.stringify(updatedCharacter, null, 2));

        const oldRarity = existingCharDetails.rarity;
        const oldBannerKey = existingCharDetails.banner;
        
        if (oldBannerKey) {
            const oldBanner = (oldBannerKey === 'standard_banner') ? dataManager.standardBanner : dataManager.seasonalBanner;
            if (oldBanner[oldRarity]) {
                oldBanner[oldRarity] = oldBanner[oldRarity].filter(char => char !== oldName);
                await fs.writeFile(path.join(dataManager.GACHA_DATA_PATH, 'banners', `${oldBannerKey}.json`), JSON.stringify(oldBanner, null, 2));
            }
        }

        const targetBanner = (banner === 'standard_banner') ? dataManager.standardBanner : dataManager.seasonalBanner;
        if (!targetBanner[rarity]) {
            targetBanner[rarity] = [];
        }
        if (!targetBanner[rarity].includes(name)) {
            targetBanner[rarity].push(name);
        }
        await fs.writeFile(path.join(dataManager.GACHA_DATA_PATH, 'banners', `${banner}.json`), JSON.stringify(targetBanner, null, 2));

        dataManager.characterData[name] = updatedCharacter;
        if (banner === 'standard_banner') dataManager.standardBanner = targetBanner;
        else dataManager.seasonalBanner = targetBanner;

        if (updatedCharacter.stock !== undefined) {
            if (!dataManager.gachaConfig.character_stocks) {
                dataManager.gachaConfig.character_stocks = {};
            }
            dataManager.gachaConfig.character_stocks[name] = updatedCharacter.stock;
        } else if (dataManager.gachaConfig.character_stocks && dataManager.gachaConfig.character_stocks[name] !== undefined) {
            delete dataManager.gachaConfig.character_stocks[name];
        }
        await dataManager.saveGachaConfig();

        const seasonalCharIndex = dataManager.seasonalCharactersConfig.characters.findIndex(c => c.name === name);
        if (seasonalCharIndex !== -1) {
            dataManager.seasonalCharactersConfig.characters[seasonalCharIndex].stock = updatedCharacter.stock;
            await dataManager.saveSeasonalCharactersConfig();
        }

        res.status(200).json({ message: `Personaje '${name}' actualizado exitosamente.`, character: updatedCharacter });
    } catch (error) {
        console.error('Error al editar personaje:', error);
        res.status(500).json({ error: 'Error interno del servidor al editar personaje.' });
    }
});

// Endpoint para eliminar un personaje
router.delete('/character/:name', async (req, res) => {
    const charName = req.params.name;
    const safeCharName = charName.replace(/[\\/:*?"<>|]/g, '');
    const charFileName = `${safeCharName}.json`;
    const charFilePath = path.join(dataManager.GACHA_DATA_PATH, 'characters', charFileName);

    try {
        const charDetails = dataManager.characterData[charName];
        if (!charDetails) {
            return res.status(404).json({ error: 'Personaje no encontrado para eliminar.' });
        }

        if (await fs.access(charFilePath).then(() => true).catch(() => false)) {
            await fs.unlink(charFilePath);
        }

        if (charDetails.image_url) {
            const imagePath = path.join(__dirname, '..', '..', 'web', charDetails.image_url);
            if (await fs.access(imagePath).then(() => true).catch(() => false)) {
                await fs.unlink(imagePath);
            }
        }

        for (const rarityKey in dataManager.standardBanner) {
            dataManager.standardBanner[rarityKey] = dataManager.standardBanner[rarityKey].filter(name => name !== charName);
        }
        await fs.writeFile(path.join(dataManager.GACHA_DATA_PATH, 'banners', 'standard_banner.json'), JSON.stringify(dataManager.standardBanner, null, 2));

        for (const rarityKey in dataManager.seasonalBanner) {
            dataManager.seasonalBanner[rarityKey] = dataManager.seasonalBanner[rarityKey].filter(name => name !== charName);
        }
        await fs.writeFile(path.join(dataManager.GACHA_DATA_PATH, 'banners', 'seasonal_banner.json'), JSON.stringify(dataManager.seasonalBanner, null, 2));

        delete dataManager.characterData[charName];

        if (dataManager.gachaConfig.character_stocks && dataManager.gachaConfig.character_stocks[charName] !== undefined) {
            delete dataManager.gachaConfig.character_stocks[charName];
            await dataManager.saveGachaConfig();
        }

        const seasonalCharIndex = dataManager.seasonalCharactersConfig.characters.findIndex(c => c.name === charName);
        if (seasonalCharIndex !== -1) {
            dataManager.seasonalCharactersConfig.characters.splice(seasonalCharIndex, 1);
            await dataManager.saveSeasonalCharactersConfig();
        }

        res.status(200).json({ message: `Personaje '${charName}' eliminado exitosamente.` });
    } catch (error) {
        console.error('Error al eliminar personaje:', error);
        res.status(500).json({ error: 'Error interno del servidor al eliminar personaje.' });
    }
});

// Endpoint para obtener la configuración completa del gacha
router.get('/gacha-config', async (req, res) => {
    try {
        await dataManager.loadGachaData();
        res.json(dataManager.gachaConfig);
    } catch (error) {
        console.error('Error al obtener la configuración de gacha:', error);
        res.status(500).json({ error: 'Error interno del servidor al cargar la configuración de gacha.' });
    }
});

// Endpoint para actualizar las probabilidades de rareza
router.put('/gacha-config/rarity-probabilities', async (req, res) => {
    const newProbabilities = req.body;
    if (!newProbabilities || typeof newProbabilities !== 'object') {
        return res.status(400).json({ error: 'Datos de probabilidades inválidos.' });
    }

    const sum = Object.values(newProbabilities).reduce((acc, val) => acc + val, 0);
    if (Math.abs(sum - 1) > 0.0001) {
        return res.status(400).json({ error: 'La suma de las probabilidades de rareza debe ser 1.' });
    }

    try {
        dataManager.gachaConfig.gacha_rules.rarity_probabilities = newProbabilities;
        await dataManager.saveGachaConfig();
        res.status(200).json({ message: 'Probabilidades de rareza actualizadas exitosamente.' });
    } catch (error) {
        console.error('Error al actualizar probabilidades de rareza:', error);
        res.status(500).json({ error: 'Error interno del servidor al actualizar probabilidades de rareza.' });
    }
});

// Endpoint para actualizar las probabilidades de banner
router.put('/gacha-config/banner-probabilities', async (req, res) => {
    const newProbabilities = req.body;
    if (!newProbabilities || typeof newProbabilities !== 'object') {
        return res.status(400).json({ error: 'Datos de probabilidades de banner inválidos.' });
    }

    const sum = Object.values(newProbabilities).reduce((acc, val) => acc + val, 0);
    if (Math.abs(sum - 1) > 0.0001) {
        return res.status(400).json({ error: 'La suma de las probabilidades de banner debe ser 1.' });
    }

    try {
        dataManager.gachaConfig.gacha_rules.banner_selection_probabilities['4_star_and_above'] = newProbabilities;
        await dataManager.saveGachaConfig();
        res.status(200).json({ message: 'Probabilidades de banner actualizadas exitosamente.' });
    } catch (error) {
        console.error('Error al actualizar probabilidades de banner:', error);
        res.status(500).json({ error: 'Error interno del servidor al actualizar probabilidades de banner.' });
    }
});

// Endpoint para actualizar los stocks de personajes
router.put('/gacha-config/character-stocks', async (req, res) => {
    const updatedStocks = req.body;
    if (!updatedStocks || typeof updatedStocks !== 'object') {
        return res.status(400).json({ error: 'Datos de stocks de personajes inválidos.' });
    }

    try {
        dataManager.gachaConfig.character_stocks = updatedStocks;
        await dataManager.saveGachaConfig();
        for (const charName in updatedStocks) {
            if (dataManager.characterData[charName]) {
                dataManager.characterData[charName].stock = updatedStocks[charName];
            }
        }
        res.status(200).json({ message: 'Stocks de personajes actualizados exitosamente.' });
    } catch (error) {
        console.error('Error al actualizar stocks de personajes:', error);
        res.status(500).json({ error: 'Error interno del servidor al actualizar stocks de personajes.' });
    }
});

// --- ENDPOINTS PARA PERSONAJES DE TEMPORADA ---

// Obtener la configuración de personajes de temporada
router.get('/seasonal-characters-config', async (req, res) => {
    try {
        await dataManager.loadGachaData();
        const charactersWithDetails = dataManager.seasonalCharactersConfig.characters.map(char => {
            const details = dataManager.characterData[char.name] || {};
            const currentStock = dataManager.gachaConfig.character_stocks && dataManager.gachaConfig.character_stocks[char.name] !== undefined
                                 ? dataManager.gachaConfig.character_stocks[char.name]
                                 : char.stock;
            return {
                name: char.name,
                stock: currentStock,
                image_url: details.image_url || ''
            };
        });
        res.json({
            season_duration: dataManager.seasonalCharactersConfig.season_duration,
            characters: charactersWithDetails
        });
    } catch (error) {
        console.error('Error al obtener la configuración de personajes de temporada:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// Actualizar la duración de la temporada
router.put('/seasonal-characters-config/duration', async (req, res) => {
    const { season_duration } = req.body;
    if (typeof season_duration !== 'string') {
        return res.status(400).json({ error: 'La duración de la temporada debe ser un texto.' });
    }
    dataManager.seasonalCharactersConfig.season_duration = season_duration;
    await dataManager.saveSeasonalCharactersConfig();
    res.status(200).json({ message: 'Duración de la temporada actualizada.' });
});

// Añadir un personaje a la temporada
router.post('/seasonal-characters-config/add-character', async (req, res) => {
    const { name, stock } = req.body;
    if (!name || stock === undefined || !dataManager.characterData[name]) {
        return res.status(400).json({ error: 'Datos de personaje inválidos o personaje no existe.' });
    }

    const initialStock = dataManager.gachaConfig.character_stocks && dataManager.gachaConfig.character_stocks[name] !== undefined
                         ? dataManager.gachaConfig.character_stocks[name]
                         : parseInt(stock);

    const existingChar = dataManager.seasonalCharactersConfig.characters.find(c => c.name === name);
    if (existingChar) {
        return res.status(409).json({ error: 'El personaje ya está en la lista de temporada.' });
    }

    dataManager.seasonalCharactersConfig.characters.push({ name, stock: initialStock });
    await dataManager.saveSeasonalCharactersConfig();
    res.status(201).json({ message: `Personaje '${name}' añadido a la temporada.` });
});

// Eliminar un personaje de la temporada
router.delete('/seasonal-characters-config/remove-character/:name', async (req, res) => {
    const { name } = req.params;
    const initialLength = dataManager.seasonalCharactersConfig.characters.length;
    dataManager.seasonalCharactersConfig.characters = dataManager.seasonalCharactersConfig.characters.filter(c => c.name !== name);

    if (dataManager.seasonalCharactersConfig.characters.length === initialLength) {
        return res.status(404).json({ error: 'Personaje no encontrado en la lista de temporada.' });
    }

    await dataManager.saveSeasonalCharactersConfig();
    res.status(200).json({ message: `Personaje '${name}' eliminado de la temporada.` });
});

module.exports = router;
