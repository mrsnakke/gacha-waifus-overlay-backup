document.addEventListener('DOMContentLoaded', () => {
    const characterForm = document.getElementById('character-form');
    const characterNameInput = document.getElementById('character-name');
    const characterRaritySelect = document.getElementById('character-rarity');
    const characterBannerSelect = document.getElementById('character-banner');
    const characterImageInput = document.getElementById('character-image');
    const imagePreview = document.getElementById('image-preview');
    const stockSection = document.getElementById('stock-section');
    const characterStockInput = document.getElementById('character-stock');
    const bannersContainer = document.getElementById('banners-container');

    // Elementos de la nueva sección de Personajes de Temporada
    const seasonDurationInput = document.getElementById('season-duration-input');
    const saveSeasonDurationButton = document.getElementById('save-season-duration');
    const availableCharactersSelect = document.getElementById('available-characters-select');
    const seasonalCharacterStockInput = document.getElementById('seasonal-character-stock');
    const addCharacterToSeasonButton = document.getElementById('add-character-to-season');
    const seasonalCharactersList = document.getElementById('seasonal-characters-list');

    // Elementos de la nueva sección de configuración de Gacha
    const rarityForm = document.getElementById('rarity-form');
    const prob3StarInput = document.getElementById('prob-3-star');
    const prob4StarInput = document.getElementById('prob-4-star');
    const prob5StarInput = document.getElementById('prob-5-star');
    const prob6StarInput = document.getElementById('prob-6-star');

    const bannerProbForm = document.getElementById('banner-prob-form');
    const probStandardBannerInput = document.getElementById('prob-standard-banner');
    const probSeasonalBannerInput = document.getElementById('prob-seasonal-banner');

    const stocksContainer = document.getElementById('stocks-container');
    const saveStocksButton = document.getElementById('save-stocks-button');

    let editingCharacter = null; // Para saber si estamos editando o añadiendo

    // --- Funciones de Utilidad ---
    function showNotification(message, isError = false) {
        alert(message); // Por ahora, un simple alert. Podríamos mejorarlo con un div.
    }

    // --- Lógica de Pestañas ---
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.dataset.tab;

            document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

            button.classList.add('active');
            document.getElementById(tabId).classList.add('active');

            // Cargar configuración de gacha si se activa la pestaña
            if (tabId === 'gacha-config') {
                loadGachaConfig();
            } else if (tabId === 'characters') {
                loadCharacters();
            } else if (tabId === 'seasonal-characters') {
                loadSeasonalCharactersConfig();
            } else if (tabId === 'info') {
                loadEndpointInfo();
            }
        });
    });

    // Asegurarse de que la pestaña "characters" se cargue por defecto y luego la info si es la activa
    if (document.querySelector('.tab-button.active').dataset.tab === 'info') {
        loadEndpointInfo();
    } else {
        loadCharacters(); // Cargar personajes por defecto
    }

    // --- Cargar y Mostrar Información de Endpoints ---
    async function loadEndpointInfo() {
        try {
            const response = await fetch('/admin/endpoints');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const endpoints = await response.json();

            const streamerbotEndpointsDiv = document.getElementById('streamerbot-endpoints');
            const adminEndpointsDiv = document.getElementById('admin-endpoints');
            const tradeEndpointDiv = document.getElementById('trade-endpoint');

            streamerbotEndpointsDiv.textContent = endpoints.streamerbot.join('\n');
            adminEndpointsDiv.textContent = endpoints.admin.join('\n');
            tradeEndpointDiv.textContent = endpoints.trade;

        } catch (error) {
            console.error('Error al cargar la información de endpoints:', error);
            showNotification('Error al cargar la información de endpoints.', true);
        }
    }

    // --- Previsualización de Imagen ---
    characterImageInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                imagePreview.src = e.target.result;
                imagePreview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        } else {
            imagePreview.src = '';
            imagePreview.style.display = 'none';
        }
    });

    // --- Lógica para mostrar/ocultar el campo de stock ---
    function toggleStockVisibility() {
        const rarity = characterRaritySelect.value;
        const banner = characterBannerSelect.value;
        if ((rarity === '5_star' || rarity === '6_star') && banner === 'seasonal_banner') {
            stockSection.style.display = 'block';
        } else {
            stockSection.style.display = 'none';
            characterStockInput.value = 0; // Resetear el valor si se oculta
        }
    }

    characterRaritySelect.addEventListener('change', toggleStockVisibility);
    characterBannerSelect.addEventListener('change', toggleStockVisibility);

    // --- Cargar y Mostrar Personajes ---
    async function loadCharacters() {
        bannersContainer.innerHTML = ''; // Limpiar antes de cargar

        try {
            const response = await fetch('/admin/characters');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            const { standard_banner, seasonal_banner, character_details } = data;

            const allBanners = {
                'standard_banner': standard_banner,
                'seasonal_banner': seasonal_banner
            };

            for (const bannerKey in allBanners) {
                const bannerData = allBanners[bannerKey];
                const bannerSection = document.createElement('div');
                bannerSection.className = 'banner-section';
                bannerSection.innerHTML = `<h3>${bannerKey === 'standard_banner' ? 'Banner Estándar' : 'Banner de Temporada'}</h3>`;

                const rarities = ['6_star', '5_star', '4_star', '3_star']; // Ordenar por rareza descendente

                for (const rarity of rarities) {
                    if (bannerData[rarity] && bannerData[rarity].length > 0) {
                        const rarityDiv = document.createElement('div');
                        rarityDiv.innerHTML = `<h4>${rarity.replace('_star', ' Estrellas')}</h4>`;

                        bannerData[rarity].forEach(charName => {
                            const charDetails = character_details[charName];
                            if (charDetails) {
                                const characterCard = document.createElement('div');
                                characterCard.className = 'character-card';
                                characterCard.dataset.name = charName; // Para identificar al personaje

                                const imageUrl = charDetails.image_url ? charDetails.image_url.replace('public/', '') : ''; // Eliminar 'public/' si existe
                                
                                characterCard.innerHTML = `
                                    <img src="${imageUrl}" alt="${charName}">
                                    <div class="character-info">
                                        <h4>${charName}</h4>
                                        <p>Rareza: ${rarity.replace('_star', ' Estrellas')}</p>
                                        <p>Stock: ${charDetails.stock !== undefined ? charDetails.stock : 'N/A'}</p>
                                    </div>
                                    <div class="character-actions">
                                        <button class="edit" data-name="${charName}">Editar</button>
                                        <button class="delete" data-name="${charName}">Eliminar</button>
                                    </div>
                                `;
                                rarityDiv.appendChild(characterCard);
                            }
                        });
                        bannerSection.appendChild(rarityDiv);
                    }
                }
                bannersContainer.appendChild(bannerSection);
            }

            // Rellenar el selector de personajes disponibles para la pestaña de temporada
            const allCharacterNames = Object.keys(character_details);
            availableCharactersSelect.innerHTML = '<option value="">Selecciona un personaje</option>';
            allCharacterNames.forEach(charName => {
                const option = document.createElement('option');
                option.value = charName;
                option.textContent = charName;
                availableCharactersSelect.appendChild(option);
            });

            // Añadir listeners a los botones de editar y eliminar
            document.querySelectorAll('.edit').forEach(button => {
                button.addEventListener('click', (event) => editCharacter(event.target.dataset.name));
            });
            document.querySelectorAll('.delete').forEach(button => {
                button.addEventListener('click', (event) => deleteCharacter(event.target.dataset.name));
            });

        } catch (error) {
            console.error('Error al cargar personajes:', error);
            showNotification('Error al cargar personajes.', true);
        }
    }

    // --- Añadir/Editar Personaje ---
    characterForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const name = characterNameInput.value.trim();
        const rarity = characterRaritySelect.value;
        const banner = characterBannerSelect.value;
        const imageFile = characterImageInput.files[0];
        const stock = characterStockInput.value; // Obtener el valor del stock

        if (!name || !rarity || !banner) {
            showNotification('Por favor, rellena todos los campos obligatorios.', true);
            return;
        }

        // Validar stock si la sección está visible
        if (stockSection.style.display === 'block' && (stock === '' || parseInt(stock) < 0)) {
            showNotification('Por favor, introduce un valor de stock válido (mayor o igual a 0).', true);
            return;
        }

        const formData = new FormData();
        formData.append('name', name);
        formData.append('rarity', rarity);
        formData.append('banner', banner);
        if (imageFile) {
            formData.append('image', imageFile);
        }
        // Añadir stock solo si la sección está visible
        if (stockSection.style.display === 'block') {
            formData.append('stock', stock);
        }

        const url = editingCharacter ? `/admin/character/${editingCharacter}` : '/admin/character';
        const method = editingCharacter ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method: method,
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                showNotification(result.message);
                characterForm.reset();
                imagePreview.src = '';
                imagePreview.style.display = 'none';
                stockSection.style.display = 'none'; // Ocultar stock al resetear
                characterStockInput.value = 0; // Resetear stock
                editingCharacter = null; // Resetear el modo edición
                document.querySelector('#add-character h2').textContent = 'Añadir Nuevo Personaje';
                document.querySelector('#character-form button[type="submit"]').textContent = 'Añadir Personaje';
                loadCharacters(); // Recargar la lista
            } else {
                showNotification(result.error || 'Error al procesar el personaje.', true);
            }
        } catch (error) {
            console.error('Error al enviar el formulario:', error);
            showNotification('Error de conexión al servidor.', true);
        }
    });

    // --- Editar Personaje (rellenar formulario) ---
    async function editCharacter(charName) {
        try {
            const response = await fetch(`/admin/character-details/${charName}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const charDetails = await response.json();

            characterNameInput.value = charDetails.name;
            characterRaritySelect.value = charDetails.rarity;
            characterBannerSelect.value = charDetails.banner;

            if (charDetails.image_url) {
                imagePreview.src = charDetails.image_url; // Ya normalizado por el backend
                imagePreview.style.display = 'block';
            } else {
                imagePreview.src = '';
                imagePreview.style.display = 'none';
            }

            // Rellenar y mostrar stock si aplica
            if ((charDetails.rarity === '5_star' || charDetails.rarity === '6_star') && charDetails.banner === 'seasonal_banner') {
                characterStockInput.value = charDetails.stock !== undefined ? charDetails.stock : 0;
                stockSection.style.display = 'block';
            } else {
                stockSection.style.display = 'none';
                characterStockInput.value = 0;
            }

            editingCharacter = charName; // Establecer el personaje que se está editando
            document.querySelector('#add-character h2').textContent = `Editar Personaje: ${charName}`;
            document.querySelector('#character-form button[type="submit"]').textContent = 'Guardar Cambios';

            // Scroll to form
            window.scrollTo({ top: 0, behavior: 'smooth' });

        } catch (error) {
            console.error('Error al cargar detalles del personaje para edición:', error);
            showNotification('Error al cargar detalles del personaje para edición.', true);
        }
    }

    // --- Eliminar Personaje ---
    async function deleteCharacter(charName) {
        if (!confirm(`¿Estás seguro de que quieres eliminar a ${charName}? Esta acción es irreversible.`)) {
            return;
        }

        try {
            const response = await fetch(`/admin/character/${charName}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (response.ok) {
                showNotification(result.message);
                loadCharacters(); // Recargar la lista
            } else {
                showNotification(result.error || 'Error al eliminar el personaje.', true);
            }
        } catch (error) {
            console.error('Error al eliminar el personaje:', error);
            showNotification('Error de conexión al servidor.', true);
        }
    }

    // --- Cargar Configuración de Gacha ---
    async function loadGachaConfig() {
        try {
            const response = await fetch('/admin/gacha-config');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const config = await response.json();

            // Rellenar probabilidades de rareza
            prob3StarInput.value = config.gacha_rules.rarity_probabilities['3_star'];
            prob4StarInput.value = config.gacha_rules.rarity_probabilities['4_star'];
            prob5StarInput.value = config.gacha_rules.rarity_probabilities['5_star'];
            prob6StarInput.value = config.gacha_rules.rarity_probabilities['6_star'];

            // Rellenar probabilidades de banner
            probStandardBannerInput.value = config.gacha_rules.banner_selection_probabilities['4_star_and_above']['standard_banner'];
            probSeasonalBannerInput.value = config.gacha_rules.banner_selection_probabilities['4_star_and_above']['seasonal_banner'];

            // Renderizar stocks de personajes
            renderCharacterStocks(config.character_stocks);

        } catch (error) {
            console.error('Error al cargar la configuración de gacha:', error);
            showNotification('Error al cargar la configuración de gacha.', true);
        }
    }

    // --- Renderizar Stocks de Personajes ---
    function renderCharacterStocks(stocks) {
        stocksContainer.innerHTML = ''; // Limpiar antes de cargar
        for (const charName in stocks) {
            const stockDiv = document.createElement('div');
            stockDiv.className = 'stock-item';
            stockDiv.innerHTML = `
                <label for="stock-${charName}">${charName}:</label>
                <input type="number" id="stock-${charName}" data-char-name="${charName}" value="${stocks[charName]}" min="0">
            `;
            stocksContainer.appendChild(stockDiv);
        }
    }

    // --- Actualizar Probabilidades de Rareza ---
    rarityForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const rarityProbabilities = {
            '3_star': parseFloat(prob3StarInput.value),
            '4_star': parseFloat(prob4StarInput.value),
            '5_star': parseFloat(prob5StarInput.value),
            '6_star': parseFloat(prob6StarInput.value)
        };

        const sum = Object.values(rarityProbabilities).reduce((acc, val) => acc + val, 0);
        if (Math.abs(sum - 1) > 0.0001) { // Permitir una pequeña tolerancia para errores de punto flotante
            showNotification('La suma de las probabilidades de rareza debe ser 1.', true);
            return;
        }

        try {
            const response = await fetch('/admin/gacha-config/rarity-probabilities', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(rarityProbabilities)
            });

            const result = await response.json();
            if (response.ok) {
                showNotification(result.message);
                loadGachaConfig();
            } else {
                showNotification(result.error || 'Error al actualizar probabilidades de rareza.', true);
            }
        } catch (error) {
            console.error('Error al actualizar probabilidades de rareza:', error);
            showNotification('Error de conexión al servidor.', true);
        }
    });

    // --- Actualizar Probabilidades de Banner ---
    bannerProbForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const bannerProbabilities = {
            'standard_banner': parseFloat(probStandardBannerInput.value),
            'seasonal_banner': parseFloat(probSeasonalBannerInput.value)
        };

        const sum = Object.values(bannerProbabilities).reduce((acc, val) => acc + val, 0);
        if (Math.abs(sum - 1) > 0.0001) { // Permitir una pequeña tolerancia para errores de punto flotante
            showNotification('La suma de las probabilidades de banner debe ser 1.', true);
            return;
        }

        try {
            const response = await fetch('/admin/gacha-config/banner-probabilities', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(bannerProbabilities)
            });

            const result = await response.json();
            if (response.ok) {
                showNotification(result.message);
                loadGachaConfig();
            } else {
                showNotification(result.error || 'Error al actualizar probabilidades de banner.', true);
            }
        } catch (error) {
            console.error('Error al actualizar probabilidades de banner:', error);
            showNotification('Error de conexión al servidor.', true);
        }
    });

    // --- Guardar Stocks de Personajes ---
    saveStocksButton.addEventListener('click', async () => {
        const updatedStocks = {};
        document.querySelectorAll('#stocks-container input').forEach(input => {
            updatedStocks[input.dataset.charName] = parseInt(input.value);
        });

        try {
            const response = await fetch('/admin/gacha-config/character-stocks', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updatedStocks)
            });

            const result = await response.json();
            if (response.ok) {
                showNotification(result.message);
                loadGachaConfig(); // Recargar para asegurar que los valores se muestran correctamente
            } else {
                showNotification(result.error || 'Error al guardar stocks de personajes.', true);
            }
        } catch (error) {
            console.error('Error al guardar stocks de personajes:', error);
            showNotification('Error de conexión al servidor.', true);
        }
    });

    // La carga inicial de personajes y otras configuraciones se maneja ahora en la lógica de pestañas.

    // --- Lógica para Personajes de Temporada ---
    async function loadSeasonalCharactersConfig() {
        try {
            const response = await fetch('/admin/seasonal-characters-config');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const config = await response.json();

            seasonDurationInput.value = config.season_duration;
            renderSeasonalCharacters(config.characters);

        } catch (error) {
            console.error('Error al cargar la configuración de personajes de temporada:', error);
            showNotification('Error al cargar la configuración de personajes de temporada.', true);
        }
    }

    function renderSeasonalCharacters(characters) {
        seasonalCharactersList.innerHTML = '';
        if (characters.length === 0) {
            seasonalCharactersList.innerHTML = '<p>No hay personajes de temporada añadidos.</p>';
            return;
        }

        characters.forEach(char => {
            const charCard = document.createElement('div');
            charCard.className = 'seasonal-character-card';
            charCard.innerHTML = `
                <img src="${char.image_url}" alt="${char.name}">
                <div class="seasonal-character-info">
                    <h4>${char.name}</h4>
                    <p>Stock: ${char.stock}</p>
                </div>
                <div class="seasonal-character-actions">
                    <button class="delete-seasonal-character" data-name="${char.name}">Eliminar</button>
                </div>
            `;
            seasonalCharactersList.appendChild(charCard);
        });

        document.querySelectorAll('.delete-seasonal-character').forEach(button => {
            button.addEventListener('click', (event) => deleteSeasonalCharacter(event.target.dataset.name));
        });
    }

    saveSeasonDurationButton.addEventListener('click', async () => {
        const newDuration = seasonDurationInput.value.trim();
        if (!newDuration) {
            showNotification('La duración de la temporada no puede estar vacía.', true);
            return;
        }

        try {
            const response = await fetch('/admin/seasonal-characters-config/duration', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ season_duration: newDuration })
            });

            const result = await response.json();
            if (response.ok) {
                showNotification(result.message);
            } else {
                showNotification(result.error || 'Error al guardar la duración de la temporada.', true);
            }
        } catch (error) {
            console.error('Error al guardar la duración de la temporada:', error);
            showNotification('Error de conexión al servidor.', true);
        }
    });

    addCharacterToSeasonButton.addEventListener('click', async () => {
        const charName = availableCharactersSelect.value;
        const stock = parseInt(seasonalCharacterStockInput.value);

        if (!charName) {
            showNotification('Por favor, selecciona un personaje.', true);
            return;
        }
        if (isNaN(stock) || stock < 0) {
            showNotification('Por favor, introduce un stock válido (mayor o igual a 0).', true);
            return;
        }

        try {
            const response = await fetch('/admin/seasonal-characters-config/add-character', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: charName, stock: stock })
            });

            const result = await response.json();
            if (response.ok) {
                showNotification(result.message);
                loadSeasonalCharactersConfig(); // Recargar la lista de personajes de temporada
            } else {
                showNotification(result.error || 'Error al añadir personaje a la temporada.', true);
            }
        } catch (error) {
            console.error('Error al añadir personaje a la temporada:', error);
            showNotification('Error de conexión al servidor.', true);
        }
    });

    async function deleteSeasonalCharacter(charName) {
        if (!confirm(`¿Estás seguro de que quieres eliminar a ${charName} de la temporada?`)) {
            return;
        }

        try {
            const response = await fetch(`/admin/seasonal-characters-config/remove-character/${charName}`, {
                method: 'DELETE'
            });

            const result = await response.json();
            if (response.ok) {
                showNotification(result.message);
                loadSeasonalCharactersConfig(); // Recargar la lista
            } else {
                showNotification(result.error || 'Error al eliminar personaje de la temporada.', true);
            }
        } catch (error) {
            console.error('Error al eliminar personaje de la temporada:', error);
            showNotification('Error de conexión al servidor.', true);
        }
    }
});
