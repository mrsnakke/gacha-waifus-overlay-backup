/* Waifu Wisher para Streamer.bot - Frontend Script v3.0 */

// --- Elementos del DOM ---
const gashaponAnimation = document.getElementById('gashapon-animation');
const gashaponMachineImg = document.getElementById('gashapon-machine-img');
const singlePullDisplay = document.getElementById('single-pull-display');
const singlePullRedeemer = document.getElementById('single-pull-redeemer');
const singleCharacterImage = document.getElementById('single-character-image');
const multiPullDisplay = document.getElementById('multi-pull-display');
const multiPullGrid = document.getElementById('multi-pull-grid');
const testMessageDisplay = document.getElementById('test-message-display');
const fiveStarReveal = document.getElementById('five-star-reveal'); // Nuevo elemento para la revelación de 5/6 estrellas
const fiveStarImage = document.getElementById('five-star-image');
const fiveStarRedeemer = document.getElementById('five-star-redeemer');


// --- Configuración ---
const GASHAPON_ANIMATION_DURATION = 500; // Reducido drásticamente
const SINGLE_PULL_DISPLAY_DURATION = 5000;
const MULTI_PULL_CLOSE_DELAY = 4000; 
const FIVE_SIX_STAR_REVEAL_DURATION = 4000; // Duración de la revelación especial

let queue = [];
let isRunning = false;

// --- Funciones de Utilidad ---
function hideAllDisplays() {
    console.log("Ocultando todas las pantallas...");
    gashaponAnimation.classList.add('hidden');
    singlePullDisplay.classList.add('hidden');
    multiPullDisplay.classList.add('hidden');
    testMessageDisplay.classList.add('hidden');
    fiveStarReveal.classList.add('hidden'); // Ocultar también la revelación de 5/6 estrellas
    
    // Limpiar contenido dinámico
    multiPullGrid.innerHTML = '';
    singleCharacterImage.src = '';
    singlePullRedeemer.textContent = '';
    fiveStarImage.src = '';
    fiveStarRedeemer.textContent = '';

    const existingRedeemer = multiPullDisplay.querySelector('.redeemer-name');
    if (existingRedeemer) existingRedeemer.remove();
    
    // Asegurarse de que las tarjetas estén en su estado inicial (no volteadas)
    const allCards = document.querySelectorAll('.character-card');
    allCards.forEach(card => {
        card.classList.remove('is-flipped', 'five-star-flip', 'card-flip-normal');
        const frontFace = card.querySelector('.card-face-front');
        if (frontFace) {
            frontFace.classList.remove('rarity-pulse-3_star', 'rarity-pulse-4_star', 'rarity-pulse-5_star', 'rarity-pulse-6_star');
        }
    });
    console.log("Todas las pantallas ocultas y limpiadas.");
}

function getNumericRarity(rarity) {
    // Convierte "3_star" a 3, "4_star" a 4, etc. o maneja números directamente
    if (typeof rarity === 'number') {
        return rarity;
    }
    if (typeof rarity === 'string') {
        // Intenta extraer el número de la cadena
        const match = rarity.match(/^(\d+)_star$/);
        if (match && match[1]) {
            return parseInt(match[1]);
        }
    }
    console.error("Error: rarityString no es una cadena válida o un número. Valor:", rarity);
    return 0; // Valor predeterminado en caso de error
}

async function putStars(rarity, targetDiv) {
    targetDiv.innerHTML = '';
    const numericRarity = getNumericRarity(rarity);
    const starSounds = {
        common: new Audio("sounds/ping estrella.mp3"),
        rare: new Audio("sounds/chime estrella.mp3"),
        legendary: new Audio("sounds/swell estrella.mp3")
    };

    for (let i = 1; i <= numericRarity; i++) {
        let star_img = document.createElement('img');
        star_img.src = "img/star.svg";
        star_img.className = `star-icon rarity-${numericRarity}`;
        star_img.style.animationDelay = `${i * 150}ms`;
        targetDiv.append(star_img);

        // Reproducir sonido secuencialmente
        try {
            if (i === numericRarity && numericRarity >= 5) {
                await playSound(starSounds.legendary);
            } else if (i === 4) {
                await playSound(starSounds.rare);
            } else if (i <= 3) {
                await playSound(starSounds.common.cloneNode()); // Usamos cloneNode para poder reproducirlo rápido
            }
        } catch (e) {
            console.warn("No se pudo reproducir el sonido de estrella:", e.message);
        }
        
        // Pausa entre cada sonido de estrella para que no se solapen
        await new Promise(r => setTimeout(r, 180)); 
    }
}

async function playSound(audioElement) {
    try {
        // Asegurarse de que cualquier audio anterior se detenga para evitar solapamientos
        audioElement.currentTime = 0;
        await audioElement.play();
    } catch (error) {
        // Este error es esperado si la política de autoplay del navegador está activa.
        // Para OBS, la solución es configurar la fuente de navegador correctamente.
        if (error.name === 'NotAllowedError') {
            console.warn(`Error de autoplay: ${error.message}. Esto es normal si no se ha configurado la fuente de navegador en OBS para permitir audio automáticamente.`);
        } else {
            console.error("Error al reproducir sonido:", error);
        }
    }
}

// --- Funciones de Visualización del Gacha ---

async function displaySinglePull(redeemer, character) {
    console.log("Mostrando tirada única para:", redeemer, character);
    singlePullRedeemer.textContent = `Tirada de: ${redeemer}`;
    singleCharacterImage.src = character.image_url.replace('web/', ''); // Ajustar ruta de imagen
    singleCharacterImage.alt = character.name;
    document.getElementById('single-character-name').textContent = character.name;

    let starContainer = singlePullDisplay.querySelector('.star-container');
    if (!starContainer) {
        starContainer = document.createElement('div');
        starContainer.className = 'star-container';
        singlePullDisplay.appendChild(starContainer);
    } else {
        starContainer.innerHTML = '';
    }
    await putStars(character.rarity, starContainer); // Asegurarse de que putStars se complete

    singlePullDisplay.classList.remove('hidden');
    await playSound(new Audio("sounds/character_appearance.ogg"));
    await new Promise(r => setTimeout(r, SINGLE_PULL_DISPLAY_DURATION));
    console.log("Tirada única mostrada.");
}

async function displayMultiPull(redeemer, characters) {
    console.log("Mostrando tirada múltiple para:", redeemer, characters);
    multiPullGrid.innerHTML = '';
    
    const redeemerNameEl = document.createElement('div');
    redeemerNameEl.className = 'redeemer-name';
    redeemerNameEl.textContent = `Tirada de: ${redeemer}`;
    multiPullDisplay.insertBefore(redeemerNameEl, multiPullGrid);

    const numCardsToShow = 5;
    const actualCharacters = characters || [];

    const rarityOrder = { '3_star': 3, '4_star': 4, '5_star': 5, '6_star': 6 };
    const sortedCharacters = [...actualCharacters].sort((a, b) => {
        // Ensure rarity exists before sorting, default to 0 if not
        const rarityA = a && a.rarity ? rarityOrder[a.rarity] || 0 : 0;
        const rarityB = b && b.rarity ? rarityOrder[b.rarity] || 0 : 0;
        return rarityA - rarityB;
    });

    for (let i = 0; i < numCardsToShow; i++) {
        let cardData = sortedCharacters[i];
        let isPlaceholder = false;

        if (!cardData) {
            cardData = { rarity: 'default', image_url: '', name: '' }; // Placeholder data
            isPlaceholder = true;
        }
        
        const card = createCharacterCard(cardData, i, isPlaceholder);
        multiPullGrid.appendChild(card);
    }
    
    multiPullDisplay.classList.remove('hidden');

    await new Promise(r => setTimeout(r, 500)); // Pause for entry animation

    const allCards = multiPullGrid.querySelectorAll('.character-card');
    allCards.forEach(card => {
        const rarity = card.dataset.rarity;
        if (rarity && rarity !== 'default') { // Apply pulses only to actual characters
            const frontFace = card.querySelector('.card-face-front');
            if (frontFace) {
                frontFace.classList.add(`rarity-pulse-${rarity}`);
            }
        }
    });

// Pausa para que las cartas entren en la pantalla y su brillo se estabilice
    await new Promise(r => setTimeout(r, 500)); 

    console.log("Revelando 3 estrellas...");
    await revealByRarity('3_star');
    await new Promise(r => setTimeout(r, 200)); // Pausa dramática

    console.log("Revelando 4 estrellas...");
    await revealByRarity('4_star');
    await new Promise(r => setTimeout(r, 300)); // Pausa más larga

    console.log("Revelando 5 estrellas...");
    await revealByRarity('5_star', true); // isSpecial = true
    await new Promise(r => setTimeout(r, 400)); // Pausa máxima para la revelación final

    console.log("¡Revelando 6 estrellas!");
    await revealByRarity('6_star', true); // isSpecial = true también

    await new Promise(r => setTimeout(r, MULTI_PULL_CLOSE_DELAY));
    console.log("Tirada múltiple mostrada.");
}

function createCharacterCard(characterData, index, isPlaceholder = false) {
    const card = document.createElement('div');
    card.className = 'character-card';
    
    let rarityClass = 'default'; // Default for placeholders
    let animationDelay = `${index * 120}ms`;

    if (!isPlaceholder && characterData) {
        rarityClass = characterData.rarity;
        card.dataset.rarity = rarityClass;
        card.style.animationDelay = animationDelay;
    } else {
        card.dataset.rarity = 'default'; // Use 'default' to avoid applying specific rarity styles
        card.style.animationDelay = animationDelay;
    }

    let cardContent = '';
    if (isPlaceholder) {
        cardContent = `
            <div class="card-face card-face-front"></div>
            <div class="card-face card-face-back">
                <div class="character-image placeholder-image"></div>
                <div class="character-name placeholder-name"></div>
                <div class="star-container"></div>
            </div>
        `;
    } else {
        cardContent = `
            <div class="card-face card-face-front"></div>
            <div class="card-face card-face-back rarity-${rarityClass}">
                <img src="${characterData.image_url.replace('web/', '')}" class="character-image" alt="${characterData.name}">
                <div class="character-name">${characterData.name}</div>
                <div class="star-container"></div>
            </div>
        `;
    }
    card.innerHTML = cardContent;

    if (!isPlaceholder && characterData && characterData.rarity) {
        putStars(characterData.rarity, card.querySelector('.star-container'));
        const frontFace = card.querySelector('.card-face-front');
        if (frontFace) {
            frontFace.classList.add(`rarity-pulse-${characterData.rarity}`);
        }
    }
    
    return card;
}

async function revealByRarity(rarity, isSpecial = false) {
    const cardsToReveal = multiPullGrid.querySelectorAll(`.character-card[data-rarity='${rarity}']:not(.is-flipped)`);
    if (cardsToReveal.length === 0) return;

    const flipPromises = [];
    cardsToReveal.forEach((card, index) => {
        const promise = new Promise(resolve => {
            setTimeout(async () => {
                // Sonido sincronizado con cada carta
                // const flipSound = getNumericRarity(rarity) === 6 ? new Audio("sounds/Aparición de la Carta.mp3") : new Audio("sounds/flipcard.mp3");
                // flipSound.play();

                // Aplicar la clase de animación de volteo
                if (getNumericRarity(rarity) === 6) {
                    card.classList.add('six-star-flip'); // Animación ultra rara
                } else if (isSpecial) {
                    card.classList.add('five-star-flip'); // Animación especial para 5 estrellas
                } else {
                    card.classList.add('card-flip-normal'); // Animación normal
                }
                card.classList.add('is-flipped');

                // Pausa para que el giro comience antes de mostrar estrellas
                await new Promise(r => setTimeout(r, 250)); 
                const starContainer = card.querySelector('.star-container');
                if (starContainer) {
                    await putStars(card.dataset.rarity, starContainer);
                }

                resolve();
            }, index * 350); // Espacio entre el volteo de cada carta del mismo grupo
        });
        flipPromises.push(promise);
    });
    await Promise.all(flipPromises);
}

// --- Funciones de Manejo de Eventos de WebSocket ---

// Función principal que orquesta la animación del gacha
const wishAnimation = (data) => new Promise(async (resolve) => {
    console.log("Iniciando wishAnimation con datos:", data);
    console.log("isRunning en wishAnimation:", isRunning);
    hideAllDisplays();

    gashaponMachineImg.src = "img/gashapon.gif?t=" + new Date().getTime();
    gashaponAnimation.classList.remove('hidden');
    await new Promise(r => setTimeout(r, GASHAPON_ANIMATION_DURATION));
    gashaponAnimation.classList.add('hidden');
    console.log("Animación de gashapon terminada.");

    // Lógica para la revelación especial de 5 o 6 estrellas
    const highRarityCharacters = (data.characters || []).filter(char => getNumericRarity(char.rarity) >= 5);

    if (data.pull_type === 'single' && data.character) {
        if (getNumericRarity(data.character.rarity) >= 5) {
            await displayFiveSixStarReveal(data.redeemer, data.character);
        }
        await displaySinglePull(data.redeemer, data.character);
    } else if (data.pull_type === 'multi' && data.characters) {
        if (highRarityCharacters.length > 0) {
            // Mostrar cada personaje de alta rareza en grande secuencialmente
            for (const char of highRarityCharacters) {
                await displayFiveSixStarReveal(data.redeemer, char);
            }
        }
        await displayMultiPull(data.redeemer, data.characters);
    } else {
        console.warn("Datos de tirada incompletos o tipo de tirada desconocido:", data);
    }

    setTimeout(() => {
        hideAllDisplays();
        console.log("wishAnimation completada y pantallas ocultas.");
        resolve('gacha_wish_completed');
    }, 500); // Pequeño retraso antes de resolver la promesa y ocultar todo
});

async function displayFiveSixStarReveal(redeemer, character) {
    console.log("Iniciando revelación especial para 5/6 estrellas:", character.name);
    hideAllDisplays(); // Ocultar todo lo demás para la revelación especial

    fiveStarRedeemer.textContent = `¡${redeemer} obtuvo un ${character.rarity.replace('_star', '-star')}!`;
    fiveStarImage.src = character.image_url.replace('web/', ''); // Ajustar ruta de imagen
    fiveStarImage.alt = character.name;

    fiveStarReveal.classList.remove('hidden');
    await playSound(new Audio("sounds/character_appearance.ogg")); // Sonido para la revelación
    await new Promise(r => setTimeout(r, FIVE_SIX_STAR_REVEAL_DURATION));
    fiveStarReveal.classList.add('hidden'); // Ocultar después de la duración
    console.log("Revelación especial terminada.");
}


// Funciones llamadas por websocket.js
function handleSinglePullRequest(redeemer, character) {
    console.log("handleSinglePullRequest llamado. Añadiendo a la cola.");
    addToQueue({ pull_type: 'single', redeemer, character });
}

function handleMultiPullRequest(redeemer, characters) {
    console.log("handleMultiPullRequest llamado. Añadiendo a la cola.");
    addToQueue({ pull_type: 'multi', redeemer, characters });
}

function displayTestMessage(text) {
    console.log("Mostrando mensaje de prueba:", text);
    testMessageDisplay.textContent = text;
    testMessageDisplay.classList.remove('hidden');
    setTimeout(() => {
        testMessageDisplay.classList.add('hidden');
        console.log("Mensaje de prueba oculto.");
    }, 5000); // Mostrar el mensaje por 5 segundos
}

// --- Gestión de la Cola ---
function addToQueue(data) {
    console.log("Añadiendo a la cola:", data);
    queue.push(data);
    console.log("Tamaño de la cola después de añadir:", queue.length);
    if (!isRunning) {
        console.log("Cola no está corriendo, iniciando procesamiento.");
        processQueue();
    } else {
        console.log("Cola ya está corriendo, añadiendo a la espera.");
    }
}

async function processQueue() {
    isRunning = true;
    console.log("Iniciando procesamiento de cola. Elementos en cola:", queue.length);
    while (queue.length > 0) {
        const data = queue.shift();
        console.log("Procesando elemento de cola:", data);
        console.log("Tamaño de la cola después de shift:", queue.length);
        try {
            await wishAnimation(data); // Llamar a la función de animación principal
        } catch (error) {
            console.error("Error en wishAnimation:", error);
        }
    }
    isRunning = false;
    console.log("Procesamiento de cola terminado. isRunning:", isRunning);
}

// --- Inicialización ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM completamente cargado. Inicializando...");
    hideAllDisplays();
    // La conexión WebSocket es iniciada por websocket.js
});
