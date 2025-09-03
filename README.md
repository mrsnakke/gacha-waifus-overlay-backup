# Simulador de Gacha con Node.js y WebSockets

Este proyecto es un simulador de sistema de "gacha" que permite a los usuarios realizar tiradas, gestionar su inventario de personajes y realizar intercambios. Está diseñado para ser fácil de usar y personalizar, ideal para streamers o comunidades que deseen integrar un sistema de gacha interactivo.

## ¿Qué hace este proyecto?

En pocas palabras, este proyecto te permite:

1.  **Realizar Tiradas de Gacha**: Los usuarios pueden hacer tiradas individuales o múltiples para obtener personajes aleatorios.
2.  **Gestión de Inventario**: Cada usuario tiene su propio inventario de personajes obtenidos.
3.  **Sistema de "Pity"**: Incluye un sistema de "pity" (misericordia) que aumenta las probabilidades de obtener personajes raros después de un cierto número de tiradas sin éxito.
4.  **Intercambios de Personajes**: Los usuarios pueden intercambiar personajes entre sí.
5.  **Panel de Administración**: Un panel web para que los administradores puedan gestionar personajes, banners y la configuración del gacha.
6.  **Comunicación en Tiempo Real**: Utiliza WebSockets para enviar actualizaciones instantáneas a los clientes (como una superposición de transmisión) cuando se realizan tiradas o intercambios.
7.  **Integración con Notion**: Permite la sincronización de datos con Notion para una gestión más flexible y visual de personajes, inventarios o configuraciones.

## ¿Cómo está construido?

*   **Backend**: Desarrollado con **Node.js** y el framework **Express** para manejar las rutas de la API y la lógica del servidor.
*   **Frontend**: Una interfaz web simple construida con **HTML, CSS y JavaScript** puro.
*   **Base de Datos (Archivos JSON)**: Todos los datos del proyecto (usuarios, inventarios, configuración del gacha, personajes, etc.) se almacenan en archivos **JSON** en la carpeta `GachaWish/`. Esto facilita la edición y personalización sin necesidad de una base de datos compleja.
*   **Comunicación en Tiempo Real**: Implementa **WebSockets** para una experiencia interactiva y dinámica.

## Características Clave para Usuarios y Desarrolladores

### Para Usuarios (o Integradores)

*   **Fácil de Usar**: Las tiradas se activan mediante URLs simples que pueden integrarse fácilmente con herramientas como Streamer.bot o cualquier sistema que pueda hacer solicitudes HTTP.
    *   **Tirada Individual**: `http://localhost:8085/pull-single?user=NOMBRE_DE_USUARIO`
    *   **Tirada Múltiple (5 tiradas)**: `http://localhost:8085/pull-multi?user=NOMBRE_DE_USUARIO`
*   **Integración con Notion**: Posibilidad de conectar y sincronizar datos con Notion para una gestión avanzada.
*   **Interfaz Web Intuitiva**: `web/index.html` para las tiradas, `web/trades.html` para intercambios y `web/admin.html` para la administración.
*   **Personalizable**: Puedes modificar fácilmente los personajes, sus rarezas, las probabilidades y los banners editando los archivos JSON en `GachaWish/gacha_data/`.
*   **Sonidos y Animaciones**: Incluye efectos de sonido y animaciones para una experiencia de gacha más inmersiva.

### Para Desarrolladores (o Contribuidores)

*   **Estructura Clara**: El código está organizado en `src/routes`, `src/services` y `src/utils` para una fácil navegación y mantenimiento.
*   **Gestión de Datos Sencilla**: `src/services/dataManager.js` centraliza la lectura y escritura de archivos JSON.
*   **Lógica de Gacha Modular**: `src/services/gachaService.js` encapsula toda la lógica de las tiradas, incluyendo el "pity" y la selección de personajes.
*   **WebSockets Integrados**: `src/utils/websocket.js` maneja la comunicación en tiempo real, permitiendo que el frontend o las superposiciones reaccionen instantáneamente a los eventos del gacha.
*   **Scripts de Utilidad**: Incluye scripts `.bat` para iniciar el servidor (`iniciar.bat`) y realizar copias de seguridad (`backup_inventario.bat`).

## Cómo Empezar

1.  **Requisitos**: Asegúrate de tener [Node.js](https://nodejs.org/) instalado en tu sistema.
2.  **Clonar el Repositorio**:
    ```bash
    git clone [URL_DEL_REPOSITORIO]
    cd test-web-socket # O el nombre de tu carpeta de proyecto
    ```
3.  **Instalar Dependencias**:
    ```bash
    npm install
    ```
4.  **Iniciar el Servidor**:
    ```bash
    node app.js
    # O en Windows, puedes usar el script:
    # .\iniciar.bat
    ```
5.  **Acceder a la Interfaz Web**: Abre tu navegador y visita `http://localhost:8085/`.
    *   Panel de Administración: `http://localhost:8085/admin.html`
    *   Página de Intercambios: `http://localhost:8085/trades.html`

## Personalización

*   **Personajes**: Añade o edita archivos JSON en `GachaWish/gacha_data/characters/` y sus imágenes correspondientes en `web/img/characters/`.
*   **Banners**: Modifica `GachaWish/gacha_data/banners/standard_banner.json` y `seasonal_banner.json`.
*   **Probabilidades y Pity**: Ajusta `web/gacha_config.json` y `GachaWish/pity_data.json`.

¡Esperamos que disfrutes usando y mejorando este simulador de gacha!
