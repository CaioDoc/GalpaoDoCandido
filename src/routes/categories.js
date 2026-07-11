const express = require('express');
const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/categories — list all categories (public)
router.get('/', (req, res) => {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM categories ORDER BY name ASC').all();
    res.json(rows);
});

// POST /api/categories — create category (admin only)
router.post('/', requireAuth, (req, res) => {
    const { name } = req.body;
    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'O nome da categoria é obrigatório.' });
    }

    const db = getDb();
    try {
        const result = db.prepare('INSERT INTO categories (name) VALUES (?)').run(name.trim());
        const created = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json(created);
    } catch (err) {
        if (err.message.includes('UNIQUE')) {
            return res.status(409).json({ error: `A categoria "${name.trim()}" já existe.` });
        }
        res.status(500).json({ error: 'Erro ao criar categoria.' });
    }
});

// DELETE /api/categories/:id — remove category (admin only)
router.delete('/:id', requireAuth, (req, res) => {
    const db = getDb();
    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
    if (!category) return res.status(404).json({ error: 'Categoria não encontrada.' });

    // Block deletion if products are using this category
    const inUse = db.prepare('SELECT COUNT(*) as cnt FROM products WHERE category = ?').get(category.name);
    if (inUse.cnt > 0) {
        return res.status(409).json({
            error: `Não é possível remover "${category.name}": há ${inUse.cnt} produto(s) nesta categoria.`
        });
    }

    db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

module.exports = router;
