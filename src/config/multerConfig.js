const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

const characterImageStorage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const rarity = req.body.rarity;
        // La ruta debe ser relativa a la raíz del proyecto, no a src/config
        const targetDir = path.join(__dirname, '..', '..', 'web', 'img', 'characters', rarity);
        await fs.mkdir(targetDir, { recursive: true });
        cb(null, targetDir);
    },
    filename: (req, file, cb) => {
        const charName = req.body.name;
        const safeCharName = charName.replace(/[\\/:*?"<>|]/g, '');
        const ext = path.extname(file.originalname);
        console.log(`[Multer] Original filename: ${file.originalname}, Safe name: ${safeCharName}, Extension: ${ext}`);
        cb(null, `${safeCharName}${ext}`);
    }
});

const upload = multer({ storage: characterImageStorage });

module.exports = upload;
