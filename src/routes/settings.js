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
    res.json(settings);
});

// PUT /api/settings/banner — update banner_url (admin only)
router.put('/banner', requireAuth, (req, res) => {
    const { url } = req.body;

    // Allow empty string to reset to default or no banner
    const val = url || '';

    const db = getDb();
    try {
        db.prepare("INSERT INTO settings (key, value) VALUES ('banner_url', ?) ON CONFLICT(key) DO UPDATE SET value = ?").run(val, val);
        res.json({ success: true, banner_url: val });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao atualizar banner.' });
    }
});

module.exports = router;
