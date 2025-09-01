const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs').promises;
const { WebSocketServer } = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = 8085;

// --- GACHA DATA ---
let gachaConfig = {};
let standardBanner = {};
let seasonalBanner = {};
let pityData = {};
let userData = {};
let characterData = {};

const GACHA_DATA_PATH = path.join(__dirname, 'GachaWish', 'gacha_data');
const USER_DATA_PATH = path.join(__dirname, 'GachaWish', 'user_data.json');

// --- LOAD ALL GACHA DATA ON STARTUP ---
async function loadGachaData() {
    try {
        // Load config and banners
        gachaConfig = JSON.parse(await fs.readFile(path.join(__dirname, 'web', 'gacha_config.json'), 'utf8'));
        standardBanner = JSON.parse(await fs.readFile(path.join(GACHA_DATA_PATH, 'banners', 'standard_banner.json'), 'utf8'));
        seasonalBanner = JSON.parse(await fs.readFile(path.join(GACHA_DATA_PATH, 'banners', 'seasonal_banner.json'), 'utf8'));
        pityData = JSON.parse(await fs.readFile(path.join(__dirname, 'GachaWish', 'pity_data.json'), 'utf8'));

        // Load user data, create if it doesn't exist
        try {
            userData = JSON.parse(await fs.readFile(USER_DATA_PATH, 'utf8'));
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log('user_data.json not found, creating a new one.');
                userData = { pity_counters: {} };
                await fs.writeFile(USER_DATA_PATH, JSON.stringify(userData, null, 2));
            } else {
                throw error;
            }
        }

        // Preload all character details
        const allCharacterNames = new Set([
            ...(standardBanner['3_star'] || []),
            ...(standardBanner['4_star'] || []),
            ...(standardBanner['5_star'] || []),
            ...(seasonalBanner['4_star'] || []),
            ...(seasonalBanner['5_star'] || []),
            ...(seasonalBanner['6_star'] || [])
        ]);

        for (const charName of allCharacterNames) {
            const charPath = path.join(GACHA_DATA_PATH, 'characters', `${charName}.json`);
            try {
                const charDetails = JSON.parse(await fs.readFile(charPath, 'utf8'));
                // Apply stock from gachaConfig if available
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
        process.exit(1); // Exit if essential data is missing
    }
}

// --- GACHA LOGIC (MOVED FROM FRONTEND) ---

function selectRarity(userPity) {
    if (userPity['5_star'] >= pityData.pity_thresholds['5_star'].hard_pity) return '5_star';
    if (userPity['4_star'] >= pityData.pity_thresholds['4_star'].hard_pity) return '4_star';

    const rand = Math.random();
    let cumulative = 0;
    const probabilities = { ...gachaConfig.gacha_rules.rarity_probabilities };

    if (userPity['5_star'] >= pityData.pity_thresholds['5_star'].soft_pity) {
        probabilities['5_star'] += 0.1;
    }
    if (userPity['4_star'] >= pityData.pity_thresholds['4_star'].soft_pity) {
        probabilities['4_star'] += 0.1;
    }

    if (probabilities['6_star'] && rand < (cumulative += probabilities['6_star'])) return '6_star';
    if (rand < (cumulative += probabilities['5_star'])) return '5_star';
    if (rand < (cumulative += probabilities['4_star'])) return '4_star';
    return '3_star';
}

function selectCharacter(rarity, userPity) {
    let characterList;
    let bannerSource = 'standard'; // Default source

    if (rarity === '3_star') {
        characterList = standardBanner['3_star'];
        bannerSource = 'standard';
    } else if (rarity === '6_star') {
        characterList = seasonalBanner['6_star'];
        bannerSource = 'seasonal';
    } else if (rarity === '4_star') {
        // 4-star has a 40% chance of being from the seasonal banner.
        if (Math.random() < 0.4) { // 40% chance for seasonal
            characterList = seasonalBanner['4_star'];
            bannerSource = 'seasonal';
            console.log('[Gacha] 4-star 40/60 result: seasonal.');
        } else { // 60% chance for standard
            characterList = standardBanner['4_star'];
            bannerSource = 'standard';
            console.log('[Gacha] 4-star 40/60 result: standard.');
        }
    } else if (rarity === '5_star') {
        const isGuaranteed = userPity.guaranteed_seasonal_5_star;
        if (isGuaranteed) {
            characterList = seasonalBanner['5_star'];
            userPity.guaranteed_seasonal_5_star = false;
            bannerSource = 'seasonal';
            console.log('[Gacha] 5-star pull is guaranteed seasonal.');
        } else {
            if (Math.random() < 0.5) { // 50% chance for seasonal
                characterList = seasonalBanner['5_star'];
                bannerSource = 'seasonal';
                console.log('[Gacha] 5-star 50/50 won, got seasonal.');
            } else { // 50% chance for standard
                characterList = standardBanner['5_star'];
                userPity.guaranteed_seasonal_5_star = true;
                bannerSource = 'standard';
                console.log('[Gacha] 5-star 50/50 lost, got standard. Next is guaranteed.');
            }
        }
    }

    // Fallback if a list is empty for some reason
    if (!characterList || characterList.length === 0) {
        console.warn(`No characters in chosen banner (${bannerSource}) for rarity ${rarity}. Falling back to standard banner.`);
        characterList = standardBanner[rarity];
        // If even standard is empty, it's a critical issue
        if (!characterList || characterList.length === 0) {
             console.error(`CRITICAL: No characters found for rarity ${rarity} in any banner. Returning a default character.`);
             return characterData['qtip'];
        }
    }

    // If still no characters, this is a critical data issue.
    if (!characterList || characterList.length === 0) {
        console.error(`CRITICAL: No characters found for rarity ${rarity} in any banner. Returning a default character.`);
        return characterData['qtip']; // Return a known, safe default
    }

    let availableCharacters = characterList.filter(charName => {
        const char = characterData[charName];
        // Only include characters that are loaded and either don't have a stock or have stock > 0
        return char && (char.stock === undefined || char.stock > 0);
    });

    if (availableCharacters.length === 0) {
        console.warn(`No available characters for rarity ${rarity} in chosen banner. Falling back to standard banner.`);
        // Fallback to standard banner if no seasonal characters are available
        if (bannerSource === 'seasonal') {
            characterList = standardBanner[rarity];
            availableCharacters = characterList.filter(charName => {
                const char = characterData[charName];
                return char && (char.stock === undefined || char.stock > 0);
            });
        }
        if (availableCharacters.length === 0) {
            console.error(`CRITICAL: No characters found for rarity ${rarity} in any banner with available stock. Returning a default character.`);
            return characterData['qtip'];
        }
    }

    let selectedCharacter = undefined;
    let attempts = 0;
    const maxAttempts = availableCharacters.length * 2; // Give it a reasonable number of tries

    while (!selectedCharacter && attempts < maxAttempts) {
        const charName = availableCharacters[Math.floor(Math.random() * availableCharacters.length)];
        selectedCharacter = characterData[charName]; // This will be undefined if data failed to load
        
        if (!selectedCharacter) {
            console.warn(`Attempted to select unloaded character '${charName}'. Re-rolling...`);
        }
        attempts++;
    }

    // If after many attempts we still don't have a character, find the first available one of that rarity.
    if (!selectedCharacter) {
        console.error(`Could not select a loaded character for rarity ${rarity} after ${attempts} attempts. Finding a fallback.`);
        for (const charName of characterList) {
            if (characterData[charName]) {
                return characterData[charName];
            }
        }
        // If all else fails, return the absolute default
        return characterData['qtip'];
    }

    return selectedCharacter;
}

async function updateInventoryAndPulls(redeemer, characters, pullCount) {
    const INVENTORY_DATA_PATH = path.join(__dirname, 'GachaWish', 'user_inventory.json');
    
    let userInventory = {};
    try {
        const data = await fs.readFile(INVENTORY_DATA_PATH, 'utf8');
        userInventory = JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            userInventory = {};
        } else {
            console.error('[Inventory] Error reading inventory file:', error);
            return;
        }
    }

    // Ensure the user exists in the inventory
    if (!userInventory[redeemer]) {
        userInventory[redeemer] = {
            "4_star": [],
            "5_star": [],
            "6_star": [],
            "total_pulls": 0
        };
    }

    // Add new characters
    characters.forEach(character => {
        const { rarity, name: characterName } = character;
        // Only track 4, 5, and 6-star characters
        if (['4_star', '5_star', '6_star'].includes(rarity)) {
            const userCharacters = userInventory[redeemer];
            if (userCharacters[rarity] && !userCharacters[rarity].includes(characterName)) {
                userCharacters[rarity].push(characterName);
                console.log(`[Inventory] Added ${characterName} (${rarity}) to ${redeemer}'s inventory.`);
            }
        }
    });
    
    // Increment total pulls for the user
    userInventory[redeemer].total_pulls += pullCount;
    console.log(`[Inventory] ${redeemer}'s total pulls is now: ${userInventory[redeemer].total_pulls}`);

    try {
        await fs.writeFile(INVENTORY_DATA_PATH, JSON.stringify(userInventory, null, 2));
    } catch (writeError) {
        console.error('[Inventory] Error writing to inventory file:', writeError);
    }
}

function updateUserPity(userPity, obtainedRarity) {
    if (obtainedRarity === '5_star') {
        userPity['5_star'] = 0;
        userPity['4_star']++;
    } else if (obtainedRarity === '4_star') {
        userPity['4_star'] = 0;
        userPity['5_star']++;
    } else {
        userPity['4_star']++;
        userPity['5_star']++;
    }
    userPity.total_pulls++;
}

async function performSinglePull(redeemer) {
    if (!userData.pity_counters[redeemer]) {
        userData.pity_counters[redeemer] = {
            '4_star': 0,
            '5_star': 0,
            'total_pulls': 0,
            'guaranteed_seasonal_5_star': false // Only 5-star needs a guarantee flag
        };
    }
    // Ensure existing users have the 5-star flag and remove the old 4-star one
    if (userData.pity_counters[redeemer].guaranteed_seasonal_5_star === undefined) {
        userData.pity_counters[redeemer].guaranteed_seasonal_5_star = false;
    }
    if (userData.pity_counters[redeemer].guaranteed_seasonal_4_star !== undefined) {
        delete userData.pity_counters[redeemer].guaranteed_seasonal_4_star;
    }


    const userPity = userData.pity_counters[redeemer];
    const rarity = selectRarity(userPity);
    const character = selectCharacter(rarity, userPity); // Pass userPity to selectCharacter
    updateUserPity(userPity, rarity);

    // Decrement stock if character has it and update gachaConfig
    if (character.stock !== undefined && character.stock > 0) {
        gachaConfig.character_stocks[character.name] = Math.max(0, gachaConfig.character_stocks[character.name] - 1);
        characterData[character.name].stock = gachaConfig.character_stocks[character.name]; // Update in-memory characterData
        await saveGachaConfig();
    }
    
    await fs.writeFile(USER_DATA_PATH, JSON.stringify(userData, null, 2));
    
    // Create a copy to avoid modifying the cached character data
    const characterForClient = { ...character };

    // Fix the image path by removing the "public/" prefix before sending to client
    if (characterForClient.image_url && characterForClient.image_url.startsWith('public/')) {
        characterForClient.image_url = characterForClient.image_url.replace('public/', '');
    }
    
    characterForClient.rarity = rarity; // Asegurar el formato X_star
    
    console.log(`[Gacha] ${redeemer} pulled: ${characterForClient.name} (${rarity})`);
    return characterForClient;
}


async function writeLatestPullInfo(redeemer, characters, userPity) {
    const LATEST_PULL_PATH = path.join(__dirname, 'GachaWish', 'latest_pull.json');
    const hardPity5Star = pityData.pity_thresholds['5_star'].hard_pity;
    const pullsUntilGuaranteed5Star = hardPity5Star - userPity['5_star'];

    const pullData = {
        redeemer: redeemer,
        characters: characters.map(c => c.name),
        pulls_until_guaranteed_5_star: pullsUntilGuaranteed5Star,
        is_5_star_guaranteed_seasonal: userPity.guaranteed_seasonal_5_star
    };

    try {
        await fs.writeFile(LATEST_PULL_PATH, JSON.stringify(pullData, null, 2));
        console.log(`[Gacha] Successfully wrote latest pull info for ${redeemer} to ${LATEST_PULL_PATH}`);
    } catch (error) {
        console.error(`[Gacha] Failed to write latest pull info:`, error);
    }
}

// --- WEBSOCKET AND SERVER SETUP ---

app.use(express.static(path.join(__dirname, 'web')));

wss.on('connection', (ws) => {
    console.log('Client connected to overlay server');
    ws.on('close', () => console.log('Client disconnected'));
});

function broadcast(data) {
    wss.clients.forEach((client) => {
        if (client.readyState === client.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

// --- STREAMER.BOT ENDPOINTS ---

async function saveGachaConfig() {
    try {
        await fs.writeFile(path.join(__dirname, 'web', 'gacha_config.json'), JSON.stringify(gachaConfig, null, 2));
        console.log('[Gacha] gacha_config.json updated successfully.');
    } catch (error) {
        console.error('[Gacha] Failed to save gacha_config.json:', error);
    }
}

app.get('/pull-single', async (req, res) => {
    const redeemer = req.query.user || 'test-user';
    console.log(`[API] Single pull triggered by ${redeemer}`);
    
    const character = await performSinglePull(redeemer);
    
    await updateInventoryAndPulls(redeemer, [character], 1);
    await writeLatestPullInfo(redeemer, [character], userData.pity_counters[redeemer]);
    
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

app.get('/pull-multi', async (req, res) => {
    const redeemer = req.query.user || 'test-user';
    console.log(`[API] Multi pull (x5) triggered by ${redeemer}`);
    
    const results = [];
    for (let i = 0; i < 5; i++) {
        const character = await performSinglePull(redeemer);
        results.push(character);
    }
    
    await updateInventoryAndPulls(redeemer, results, 5);
    await writeLatestPullInfo(redeemer, results, userData.pity_counters[redeemer]);

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


// --- ADMIN ENDPOINTS ---
app.get('/admin/clear-all-data', async (req, res) => {
    const { confirm } = req.query;

    if (confirm !== 'true') {
        const message = 'Confirmation not provided. Please add ?confirm=true to the URL to proceed with clearing all data.';
        console.log(`[ADMIN] Data clearing aborted. ${message}`);
        return res.status(400).send(message);
    }

    console.log('[ADMIN] Received confirmed request to clear all user data.');
    try {
        // Clear pity data in memory and file
        userData = { pity_counters: {} };
        await fs.writeFile(USER_DATA_PATH, JSON.stringify(userData, null, 2));
        console.log('[ADMIN] All pity data has been cleared.');

        // Clear inventory data file
        const inventoryPath = path.join(__dirname, 'GachaWish', 'user_inventory.json');
        await fs.writeFile(inventoryPath, JSON.stringify({}, null, 2));
        console.log('[ADMIN] All inventory data has been cleared.');

        const successMessage = 'All user pity and inventory data has been successfully cleared.';
        console.log(`[ADMIN] ${successMessage}`);
        res.status(200).send(successMessage);
    } catch (error) {
        console.error('[ADMIN] Failed to clear user data:', error);
        res.status(500).send('An error occurred while clearing user data.');
    }
});


// --- START SERVER ---
loadGachaData().then(() => {
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`Server is running on port ${PORT}`);
        console.log('--- Endpoints for Streamer.bot ---');
        console.log(`Single Pull: http://YOUR_IP_ADDRESS:${PORT}/pull-single?user=USERNAME`);
        console.log(`Multi Pull:  http://YOUR_IP_ADDRESS:${PORT}/pull-multi?user=USERNAME`);
        console.log('--- Admin Commands ---');
        console.log(`Clear All Data: http://YOUR_IP_ADDRESS:${PORT}/admin/clear-all-data?confirm=true`);
        console.log('\nTo access from another PC, use this PC\'s IP address instead of YOUR_IP_ADDRESS.');
        console.log('You can find your IP address by running "ipconfig" (Windows) or "ifconfig" (Linux/macOS) in your terminal.');
    });
}).catch(error => {
    console.error("Failed to start server due to data loading issues.", error);
});
