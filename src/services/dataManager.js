const path = require('path');
const fs = require('fs').promises;

// --- GACHA DATA ---
let gachaConfig = {};
let standardBanner = {};
let seasonalBanner = {};
let seasonalCharactersConfig = {};
let pityData = {};
let userData = {};
let characterData = {};

const GACHA_DATA_PATH = path.join(__dirname, '..', '..', 'GachaWish', 'gacha_data');
const USER_DATA_PATH = path.join(__dirname, '..', '..', 'GachaWish', 'user_data.json');
const INVENTORY_DATA_PATH = path.join(__dirname, '..', '..', 'GachaWish', 'user_inventory.json');
const TRADES_DATA_PATH = path.join(__dirname, '..', '..', 'GachaWish', 'trades.json');
const GACHA_CONFIG_WEB_PATH = path.join(__dirname, '..', '..', 'web', 'gacha_config.json');
const SEASONAL_CHARACTERS_BANNER_PATH = path.join(GACHA_DATA_PATH, 'banners', 'seasonal_characters.json');


async function loadGachaData() {
    try {
        Object.assign(gachaConfig, JSON.parse(await fs.readFile(GACHA_CONFIG_WEB_PATH, 'utf8')));
        Object.assign(standardBanner, JSON.parse(await fs.readFile(path.join(GACHA_DATA_PATH, 'banners', 'standard_banner.json'), 'utf8')));
        Object.assign(seasonalBanner, JSON.parse(await fs.readFile(path.join(GACHA_DATA_PATH, 'banners', 'seasonal_banner.json'), 'utf8')));
        Object.assign(seasonalCharactersConfig, JSON.parse(await fs.readFile(SEASONAL_CHARACTERS_BANNER_PATH, 'utf8')));
        Object.assign(pityData, JSON.parse(await fs.readFile(path.join(__dirname, '..', '..', 'GachaWish', 'pity_data.json'), 'utf8')));

        try {
            Object.assign(userData, JSON.parse(await fs.readFile(USER_DATA_PATH, 'utf8')));
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log('user_data.json not found, creating a new one.');
                Object.assign(userData, { pity_counters: {} });
                await fs.writeFile(USER_DATA_PATH, JSON.stringify(userData, null, 2));
            } else {
                throw error;
            }
        }

        const allCharacterNames = new Set([
            ...(standardBanner['3_star'] || []),
            ...(standardBanner['4_star'] || []),
            ...(standardBanner['5_star'] || []),
            ...(seasonalBanner['4_star'] || []),
            ...(seasonalBanner['5_star'] || []),
            ...(seasonalBanner['6_star'] || []),
            ...(seasonalCharactersConfig.characters ? seasonalCharactersConfig.characters.map(c => c.name) : [])
        ]);

        for (const charName of allCharacterNames) {
            const charPath = path.join(GACHA_DATA_PATH, 'characters', `${charName}.json`);
            try {
                const charDetails = JSON.parse(await fs.readFile(charPath, 'utf8'));
                if (charDetails.image_url && charDetails.image_url.startsWith('public/')) {
                    charDetails.image_url = charDetails.image_url.replace('public/', '');
                }
                if (gachaConfig.character_stocks && gachaConfig.character_stocks[charName] !== undefined) {
                    charDetails.stock = gachaConfig.character_stocks[charName];
                }
                characterData[charName] = charDetails;
            } catch (e) {
                console.warn(`Could not load character data for: ${charName}`);
            }
        }

        console.log('All gacha data loaded successfully.');
    } catch (error) {
        console.error('FATAL: Could not load gacha data. The server cannot function.', error);
        process.exit(1);
    }
}

async function saveGachaConfig() {
    try {
        await fs.writeFile(GACHA_CONFIG_WEB_PATH, JSON.stringify(gachaConfig, null, 2));
        console.log('[Gacha] gacha_config.json updated successfully.');
    } catch (error) {
        console.error('[Gacha] Failed to save gacha_config.json:', error);
    }
}

async function saveSeasonalCharactersConfig() {
    try {
        await fs.writeFile(SEASONAL_CHARACTERS_BANNER_PATH, JSON.stringify(seasonalCharactersConfig, null, 2));
        console.log('[Seasonal Characters] seasonal_characters.json updated successfully.');
    } catch (error) {
        console.error('[Seasonal Characters] Failed to save seasonal_characters.json:', error);
    }
}

async function saveUserData() {
    try {
        await fs.writeFile(USER_DATA_PATH, JSON.stringify(userData, null, 2));
    } catch (writeError) {
        console.error('[DataManager] Error writing to user data file:', writeError);
    }
}

async function loadUserInventory() {
    try {
        const data = await fs.readFile(INVENTORY_DATA_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return {};
        } else {
            console.error('[Inventory] Error reading inventory file:', error);
            throw error;
        }
    }
}

async function saveUserInventory(inventory) {
    try {
        await fs.writeFile(INVENTORY_DATA_PATH, JSON.stringify(inventory, null, 2));
    } catch (writeError) {
        console.error('[Inventory] Error writing to inventory file:', writeError);
    }
}

async function loadTrades() {
    try {
        const data = await fs.readFile(TRADES_DATA_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return {}; // Si no existe, empezamos con un objeto vacío
        } else {
            console.error('[Trades] Error reading trades file:', error);
            throw error;
        }
    }
}

async function saveTrades(trades) {
    try {
        await fs.writeFile(TRADES_DATA_PATH, JSON.stringify(trades, null, 2));
    } catch (writeError) {
        console.error('[Trades] Error writing to trades file:', writeError);
    }
}

module.exports = {
    gachaConfig,
    standardBanner,
    seasonalBanner,
    seasonalCharactersConfig,
    pityData,
    userData,
    characterData,
    GACHA_DATA_PATH,
    USER_DATA_PATH,
    INVENTORY_DATA_PATH,
    GACHA_CONFIG_WEB_PATH,
    SEASONAL_CHARACTERS_BANNER_PATH,
    loadGachaData,
    saveGachaConfig,
    saveSeasonalCharactersConfig,
    saveUserData,
    loadUserInventory,
    saveUserInventory,
    loadTrades,
    saveTrades
};
