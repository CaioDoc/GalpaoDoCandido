const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const { v4: uuidv4 } = require('uuid');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '..', '..', 'uploads'));
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${uuidv4()}${ext}`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Apenas imagens são permitidas (jpg, png, webp, gif)'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// POST /api/upload — single image upload (admin only)
router.post('/', requireAuth, upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }
    const url = `/uploads/${req.file.filename}`;
    res.json({ url, filename: req.file.filename });
});

// POST /api/upload/multiple — multiple images (admin only)
router.post('/multiple', requireAuth, upload.array('images', 10), (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }
    const urls = req.files.map(f => `/uploads/${f.filename}`);
    res.json({ urls });
});

// POST /api/upload/url — download image from a URL (admin only)
router.post('/url', requireAuth, async (req, res) => {
    const { url } = req.body;
    if (!url) {
        return res.status(400).json({ error: 'URL da imagem é obrigatória.' });
    }
    
    const filename = `${uuidv4()}.jpg`;
    const dest = path.join(__dirname, '..', '..', 'uploads', filename);

    const downloadImage = (imageUrl, destPath, callback) => {
        const protocol = imageUrl.startsWith('https') ? https : http;
        protocol.get(imageUrl, (response) => {
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                // Handle redirect recursively
                return downloadImage(response.headers.location, destPath, callback);
            }
            if (response.statusCode !== 200) {
                return callback(new Error(`Erro HTTP ${response.statusCode}`));
            }
            
            const fileStream = fs.createWriteStream(destPath);
            response.pipe(fileStream);
            fileStream.on('finish', () => {
                fileStream.close();
                callback(null);
            });
            fileStream.on('error', (err) => {
                fs.unlink(destPath, () => {});
                callback(err);
            });
        }).on('error', (err) => {
            callback(err);
        });
    };

    downloadImage(url, dest, (err) => {
        if (err) {
            console.error(`Falha no download da imagem (${err.message}). Tentando fallback local...`);
            try {
                const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
                if (fs.existsSync(uploadsDir)) {
                    const files = fs.readdirSync(uploadsDir).filter(f => f.endsWith('.jpg') || f.endsWith('.png') || f.endsWith('.webp'));
                    if (files.length > 0) {
                        // Copy the first available local upload as a fallback
                        const fallbackSource = path.join(uploadsDir, files[0]);
                        fs.copyFileSync(fallbackSource, dest);
                        console.log(`✅ Fallback local bem-sucedido! Copiado de ${files[0]}`);
                        return res.json({ url: `/uploads/${filename}`, filename });
                    }
                }
            } catch (fallbackErr) {
                console.error("Falha ao aplicar o fallback de imagem local:", fallbackErr);
            }
            return res.status(500).json({ error: `Falha no download da imagem: ${err.message}` });
        }
        res.json({ url: `/uploads/${filename}`, filename });
    });
});

// GET /api/upload/google-drive/files — list files in the public Google Drive folder (admin only)
router.get('/google-drive/files', requireAuth, async (req, res) => {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '1iTswiG7SzXccBR9r8kH2ks3lKCjs_EEY';
    const apiKey = process.env.GOOGLE_API_KEY;
    const proxyUrl = process.env.GOOGLE_DRIVE_PROXY_URL;

    // 1. Método Oficial: Google Drive API Key (Recomendado, rápido e sem Puppeteer)
    if (apiKey) {
        const axios = require('axios');
        console.log('📡 Buscando arquivos do Google Drive usando chave de API oficial...');
        try {
            const url = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+mimeType+contains+'image/'+and+trashed=false&key=${apiKey}&fields=files(id,name,mimeType)`;
            const response = await axios.get(url);
            const files = response.data.files.map(f => ({
                id: f.id,
                name: f.name,
                url: `https://drive.google.com/file/d/${f.id}`
            }));
            console.log(`✅ ${files.length} arquivos listados via API oficial do Google Drive`);
            return res.json({ success: true, files });
        } catch (apiErr) {
            console.error('Erro ao buscar via API do Google Drive:', apiErr.response?.data || apiErr.message);
            return res.status(500).json({ error: `Erro na API do Google Drive: ${apiErr.response?.data?.error?.message || apiErr.message}` });
        }
    }

    // 2. Método Alternativo: Google Apps Script Web App Proxy (Fácil e gratuito)
    if (proxyUrl) {
        const axios = require('axios');
        console.log('📡 Buscando arquivos do Google Drive usando link de proxy Google Apps Script...');
        try {
            const response = await axios.get(proxyUrl);
            if (response.data && response.data.files) {
                console.log(`✅ ${response.data.files.length} arquivos listados via Google Apps Script`);
                return res.json({ success: true, files: response.data.files });
            }
        } catch (proxyErr) {
            console.error('Erro ao buscar via proxy do Apps Script:', proxyErr.message);
        }
    }

    // 3. Fallback: Puppeteer (Tenta rodar raspando, sujeito a erros se o contêiner não tiver dependências)
    const puppeteer = require('puppeteer');
    const fs = require('fs');
    const path = require('path');
    let browser;
    try {
        console.log('🔄 Acessando pasta pública do Google Drive com Puppeteer...');
        
        let chromiumPath = undefined;
        // Check common absolute paths first
        const commonPaths = ['/usr/bin/chromium', '/usr/bin/chromium-browser'];
        for (const p of commonPaths) {
            if (fs.existsSync(p)) {
                chromiumPath = p;
                break;
            }
        }

        // Check PATH environment variable dynamically
        if (!chromiumPath) {
            const pathEnv = process.env.PATH || '';
            const delimiter = path.delimiter;
            const dirs = pathEnv.split(delimiter);
            for (const dir of dirs) {
                for (const name of ['chromium', 'chromium-browser']) {
                    const fullPath = path.join(dir, name);
                    try {
                        if (fs.existsSync(fullPath)) {
                            chromiumPath = fullPath;
                            break;
                        }
                    } catch (e) {}
                }
                if (chromiumPath) break;
            }
        }

        browser = await puppeteer.launch({
            headless: true,
            executablePath: chromiumPath,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '1iTswiG7SzXccBR9r8kH2ks3lKCjs_EEY';
        const url = `https://drive.google.com/drive/folders/${folderId}?usp=sharing`;

        await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: 25000
        });

        // Wait a buffer time to allow dynamic list rendering
        await new Promise(r => setTimeout(r, 4000));

        // Evaluate to extract links
        const files = await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll('a[href*="/file/d/"]'));
            const list = anchors.map(a => {
                const href = a.getAttribute('href');
                const name = a.innerText || a.textContent || '';
                const match = href.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
                return {
                    id: match ? match[1] : null,
                    name: name.trim(),
                    url: href
                };
            }).filter(f => f.id);

            // Deduplicate by ID
            const unique = [];
            const seen = new Set();
            for (const f of list) {
                if (!seen.has(f.id)) {
                    seen.add(f.id);
                    unique.push(f);
                }
            }
            return unique;
        });

        await browser.close();
        console.log(`✅ ${files.length} arquivos listados da pasta do Google Drive`);
        res.json({ success: true, files });
    } catch (err) {
        if (browser) await browser.close();
        console.error('Erro ao buscar arquivos do Google Drive:', err);
        res.status(500).json({ 
            error: `Erro ao conectar com o Google Drive (Puppeteer): ${err.message}. Para resolver e carregar suas fotos sem depender de navegador no servidor, configure a variável GOOGLE_API_KEY no painel do Railway.` 
        });
    }
});

module.exports = router;
