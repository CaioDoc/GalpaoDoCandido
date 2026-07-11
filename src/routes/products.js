const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/products — list all, optional ?category=
router.get('/', (req, res) => {
    const db = getDb();
    const { category, featured } = req.query;
    let query = 'SELECT * FROM products';
    const params = [];

    const conditions = [];
    if (category) {
        conditions.push('category = ?');
        params.push(category);
    }
    if (featured === '1') {
        conditions.push('featured = 1');
    }
    if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY created_at DESC';

    const products = db.prepare(query).all(...params);
    // Parse images JSON
    const parsed = products.map(p => ({ ...p, images: JSON.parse(p.images || '[]') }));
    res.json(parsed);
});

// GET /api/products/categories — get distinct category list
router.get('/categories', (req, res) => {
    const db = getDb();
    const rows = db.prepare('SELECT DISTINCT category FROM products ORDER BY category ASC').all();
    res.json(rows.map(r => r.category));
});

// GET /api/products/:id
router.get('/:id', (req, res) => {
    const db = getDb();
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!product) return res.status(404).json({ error: 'Produto não encontrado.' });
    res.json({ ...product, images: JSON.parse(product.images || '[]') });
});

// POST /api/products — create (admin only)
router.post('/', requireAuth, (req, res) => {
    const { title, subtitle, description, price, category, images, featured } = req.body;
    if (!title || price === undefined) {
        return res.status(400).json({ error: 'Título e preço são obrigatórios.' });
    }

    const db = getDb();
    const id = uuidv4();
    db.prepare(
        'INSERT INTO products (id, title, subtitle, description, price, category, images, featured) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
        id,
        title,
        subtitle || '',
        description || '',
        parseFloat(price) || 0,
        category || 'Outros',
        JSON.stringify(Array.isArray(images) ? images : []),
        featured ? 1 : 0
    );

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    res.status(201).json({ ...product, images: JSON.parse(product.images) });
});

// PUT /api/products/:id — update (admin only)
router.put('/:id', requireAuth, (req, res) => {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Produto não encontrado.' });

    const { title, subtitle, description, price, category, images, featured } = req.body;

    db.prepare(
        `UPDATE products SET 
      title = ?, subtitle = ?, description = ?, price = ?, 
      category = ?, images = ?, featured = ?
     WHERE id = ?`
    ).run(
        title ?? existing.title,
        subtitle ?? existing.subtitle,
        description ?? existing.description,
        price !== undefined ? parseFloat(price) : existing.price,
        category ?? existing.category,
        images !== undefined ? JSON.stringify(Array.isArray(images) ? images : []) : existing.images,
        featured !== undefined ? (featured ? 1 : 0) : existing.featured,
        req.params.id
    );

    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    res.json({ ...updated, images: JSON.parse(updated.images) });
});

// DELETE /api/products/:id — delete (admin only)
router.delete('/:id', requireAuth, (req, res) => {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Produto não encontrado.' });

    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

module.exports = router;
