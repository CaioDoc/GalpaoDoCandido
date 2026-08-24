const express = require('express');
const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/settings — list all settings (public)
router.get('/', (req, res) => {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM settings').all();
    const settings = {};
    rows.forEach(row => {
        settings[row.key] = row.value;
    });

    let banners = [];
    if (settings.hero_banners) {
        try {
            banners = JSON.parse(settings.hero_banners);
        } catch (e) {
            banners = [];
        }
    }

    if (!banners || banners.length === 0) {
        const defaultBannerUrl = settings.banner_url || "https://lh3.googleusercontent.com/aida-public/AB6AXuAvAAN1NYELrbPLEreymiDA3OOKNsrELf3jHiCj2XHPqEBke9mUS5zbtQdR55Sm0V7jLLsFvZigJVFmzp2zeStmiSOtW61yeJ9hZ8_Pb-F-JxXHteXRDU3BdUeY5Wxk0TBVlE5fKWtFJZddxRbZoQPySNwe6yBA9bEAeripeIMdxoPKn3MuKec65M58Uh-qproteVwhUBjmnGk2TQsklIc4k7IW6hcQyxwsAIRiC0fZw794BKH2NXoyiXTl9FKHcJkQWXURgJGWWsHM";
        banners = [
            {
                id: 'banner-default-1',
                tag: 'COLEÇÃO EXCLUSIVA',
                title: 'Móveis de Luxo & Design Atemporal',
                subtitle: 'Transforme seu ambiente com a sofisticação de peças selecionadas à mão.',
                imageUrl: defaultBannerUrl,
                buttons: [
                    { text: 'Explorar Catálogo', type: 'default', link: '#catalogo' },
                    { text: 'Falar com Vendedor', type: 'secondary', link: 'https://wa.me/5519996146549' }
                ]
            }
        ];
    }

    settings.hero_banners = JSON.stringify(banners);
    settings.parsed_banners = banners;

    res.json(settings);
});

// PUT /api/settings/hero-banners — update hero_banners (admin only)
router.put('/hero-banners', requireAuth, (req, res) => {
    const { banners } = req.body;
    if (!Array.isArray(banners)) {
        return res.status(400).json({ error: 'Formato inválido. Esperado um array de banners.' });
    }

    const db = getDb();
    try {
        const val = JSON.stringify(banners);
        db.prepare("INSERT INTO settings (key, value) VALUES ('hero_banners', ?) ON CONFLICT(key) DO UPDATE SET value = ?").run(val, val);

        if (banners.length > 0 && banners[0].imageUrl) {
            db.prepare("INSERT INTO settings (key, value) VALUES ('banner_url', ?) ON CONFLICT(key) DO UPDATE SET value = ?").run(banners[0].imageUrl, banners[0].imageUrl);
        }

        res.json({ success: true, banners, banner_url: banners[0]?.imageUrl || '' });
    } catch (err) {
        console.error('Erro ao salvar hero_banners:', err);
        res.status(500).json({ error: 'Erro ao atualizar banners principais.' });
    }
});

// PUT /api/settings/banner — update banner_url (admin only)
router.put('/banner', requireAuth, (req, res) => {
    const { url } = req.body;
    const val = url || '';
    const db = getDb();
    try {
        db.prepare("INSERT INTO settings (key, value) VALUES ('banner_url', ?) ON CONFLICT(key) DO UPDATE SET value = ?").run(val, val);
        res.json({ success: true, banner_url: val });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao atualizar banner.' });
    }
});

// GET /api/settings/backup/export — download full database JSON backup (admin only)
router.get('/backup/export', requireAuth, (req, res) => {
    const { exportDatabaseJSON } = require('../db');
    try {
        const backupData = exportDatabaseJSON();
        const filename = `backup-galpao-${new Date().toISOString().slice(0, 10)}.json`;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.json(backupData);
    } catch (err) {
        console.error('Erro ao exportar backup:', err);
        res.status(500).json({ error: 'Erro ao gerar arquivo de backup.' });
    }
});

// POST /api/settings/backup/import — restore database from JSON backup (admin only)
router.post('/backup/import', requireAuth, (req, res) => {
    const { restoreFromJSON } = require('../db');
    try {
        const backupData = req.body;
        restoreFromJSON(backupData);
        res.json({ success: true, message: 'Banco de dados restaurado com sucesso!' });
    } catch (err) {
        console.error('Erro ao importar backup:', err);
        res.status(400).json({ error: err.message || 'Erro ao importar backup.' });
    }
});

module.exports = router;
