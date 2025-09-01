const path = require('path');
const fs = require('fs').promises;
const dataManager = require('./dataManager'); // Importar el dataManager

async function updateInventoryAndPulls(redeemer, characters, pullCount) {
    let userInventory = await dataManager.loadUserInventory();

    if (!userInventory[redeemer]) {
        userInventory[redeemer] = {
            "4_star": [],
            "5_star": [],
            "6_star": [],
            "total_pulls": 0
        };
    }

    characters.forEach(character => {
        const { rarity, name: characterName } = character;
        if (['4_star', '5_star', '6_star'].includes(rarity)) {
            const userCharacters = userInventory[redeemer];
            if (userCharacters[rarity] && !userCharacters[rarity].includes(characterName)) {
                userCharacters[rarity].push(characterName);
                console.log(`[Inventory] Added ${characterName} (${rarity}) to ${redeemer}'s inventory.`);
            }
        }
    });
    
    userInventory[redeemer].total_pulls += pullCount;
    console.log(`[Inventory] ${redeemer}'s total pulls is now: ${userInventory[redeemer].total_pulls}`);

    await dataManager.saveUserInventory(userInventory);
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

function selectRarity(userPity) {
    if (userPity['5_star'] >= dataManager.pityData.pity_thresholds['5_star'].hard_pity) return '5_star';
    if (userPity['4_star'] >= dataManager.pityData.pity_thresholds['4_star'].hard_pity) return '4_star';

    const rand = Math.random();
    let cumulative = 0;
    const probabilities = { ...dataManager.gachaConfig.gacha_rules.rarity_probabilities };

    if (userPity['5_star'] >= dataManager.pityData.pity_thresholds['5_star'].soft_pity) {
        probabilities['5_star'] += 0.1;
    }
    if (userPity['4_star'] >= dataManager.pityData.pity_thresholds['4_star'].soft_pity) {
        probabilities['4_star'] += 0.1;
    }

    if (probabilities['6_star'] && rand < (cumulative += probabilities['6_star'])) return '6_star';
    if (rand < (cumulative += probabilities['5_star'])) return '5_star';
    if (rand < (cumulative += probabilities['4_star'])) return '4_star';
    return '3_star';
}

function selectCharacter(rarity, userPity) {
    let characterList;
    let bannerSource = 'standard';

    if (rarity === '3_star') {
        characterList = dataManager.standardBanner['3_star'];
        bannerSource = 'standard';
    } else if (rarity === '6_star') {
        characterList = dataManager.seasonalBanner['6_star'];
        bannerSource = 'seasonal';
    } else if (rarity === '4_star') {
        if (Math.random() < 0.4) {
            characterList = dataManager.seasonalBanner['4_star'];
            bannerSource = 'seasonal';
            console.log('[Gacha] 4-star 40/60 result: seasonal.');
        } else {
            characterList = dataManager.standardBanner['4_star'];
            bannerSource = 'standard';
            console.log('[Gacha] 4-star 40/60 result: standard.');
        }
    } else if (rarity === '5_star') {
        const isGuaranteed = userPity.guaranteed_seasonal_5_star;
        if (isGuaranteed) {
            characterList = dataManager.seasonalBanner['5_star'];
            userPity.guaranteed_seasonal_5_star = false;
            bannerSource = 'seasonal';
            console.log('[Gacha] 5-star pull is guaranteed seasonal.');
        } else {
            if (Math.random() < 0.5) {
                characterList = dataManager.seasonalBanner['5_star'];
                bannerSource = 'seasonal';
                console.log('[Gacha] 5-star 50/50 won, got seasonal.');
            } else {
                characterList = dataManager.standardBanner['5_star'];
                userPity.guaranteed_seasonal_5_star = true;
                bannerSource = 'standard';
                console.log('[Gacha] 5-star 50/50 lost, got standard. Next is guaranteed.');
            }
        }
    }

    if (!characterList || characterList.length === 0) {
        console.warn(`No characters in chosen banner (${bannerSource}) for rarity ${rarity}. Falling back to standard banner.`);
        characterList = dataManager.standardBanner[rarity];
        if (!characterList || characterList.length === 0) {
             console.error(`CRITICAL: No characters found for rarity ${rarity} in any banner. Returning a default character.`);
             return dataManager.characterData['qtip'];
        }
    }

    if (!characterList || characterList.length === 0) {
        console.error(`CRITICAL: No characters found for rarity ${rarity} in any banner. Returning a default character.`);
        return dataManager.characterData['qtip'];
    }

    let availableCharacters = characterList.filter(charName => {
        const char = dataManager.characterData[charName];
        return char && (char.stock === undefined || char.stock > 0);
    });

    if (availableCharacters.length === 0) {
        console.warn(`No available characters for rarity ${rarity} in chosen banner. Falling back to standard banner.`);
        if (bannerSource === 'seasonal') {
            characterList = dataManager.standardBanner[rarity];
            availableCharacters = characterList.filter(charName => {
                const char = dataManager.characterData[charName];
                return char && (char.stock === undefined || char.stock > 0);
            });
        }
        if (availableCharacters.length === 0) {
            console.error(`CRITICAL: No characters found for rarity ${rarity} in any banner with available stock. Returning a default character.`);
            return dataManager.characterData['qtip'];
        }
    }

    let selectedCharacter = undefined;
    let attempts = 0;
    const maxAttempts = availableCharacters.length * 2;

    while (!selectedCharacter && attempts < maxAttempts) {
        const charName = availableCharacters[Math.floor(Math.random() * availableCharacters.length)];
        selectedCharacter = dataManager.characterData[charName];
        
        if (!selectedCharacter) {
            console.warn(`Attempted to select unloaded character '${charName}'. Re-rolling...`);
        }
        attempts++;
    }

    if (!selectedCharacter) {
        console.error(`Could not select a loaded character for rarity ${rarity} after ${attempts} attempts. Finding a fallback.`);
        for (const charName of characterList) {
            if (dataManager.characterData[charName]) {
                return dataManager.characterData[charName];
            }
        }
        return dataManager.characterData['qtip'];
    }

    return selectedCharacter;
}

async function performSinglePull(redeemer) {
    if (!dataManager.userData.pity_counters[redeemer]) {
        dataManager.userData.pity_counters[redeemer] = {
            '4_star': 0,
            '5_star': 0,
            'total_pulls': 0,
            'guaranteed_seasonal_5_star': false
        };
    }
    if (dataManager.userData.pity_counters[redeemer].guaranteed_seasonal_5_star === undefined) {
        dataManager.userData.pity_counters[redeemer].guaranteed_seasonal_5_star = false;
    }
    if (dataManager.userData.pity_counters[redeemer].guaranteed_seasonal_4_star !== undefined) {
        delete dataManager.userData.pity_counters[redeemer].guaranteed_seasonal_4_star;
    }

    const userPity = dataManager.userData.pity_counters[redeemer];
    const rarity = selectRarity(userPity);
    const character = selectCharacter(rarity, userPity);
    updateUserPity(userPity, rarity);

    if (character.stock !== undefined && character.stock > 0) {
        dataManager.gachaConfig.character_stocks[character.name] = Math.max(0, dataManager.gachaConfig.character_stocks[character.name] - 1);
        dataManager.characterData[character.name].stock = dataManager.gachaConfig.character_stocks[character.name];
        await dataManager.saveGachaConfig();
    }
    
    await dataManager.saveUserData();
    
    const characterForClient = { ...character };

    if (characterForClient.image_url && characterForClient.image_url.startsWith('public/')) {
        characterForClient.image_url = characterForClient.image_url.replace('public/', '');
    }
    
    characterForClient.rarity = rarity;
    
    console.log(`[Gacha] ${redeemer} pulled: ${characterForClient.name} (${rarity})`);
    return characterForClient;
}

async function writeLatestPullInfo(redeemer, characters, userPity) {
    const LATEST_PULL_PATH = path.join(__dirname, '..', '..', 'GachaWish', 'latest_pull.json');
    const hardPity5Star = dataManager.pityData.pity_thresholds['5_star'].hard_pity;
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

module.exports = {
    selectRarity,
    selectCharacter,
    updateUserPity,
    performSinglePull,
    updateInventoryAndPulls,
    writeLatestPullInfo
};
