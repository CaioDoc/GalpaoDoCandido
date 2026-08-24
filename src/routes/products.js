const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb, triggerAutoBackup } = require('../db');
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
    query += ' ORDER BY display_order ASC, created_at DESC';

    const products = db.prepare(query).all(...params);
    // Parse images JSON
    const parsed = products.map(p => ({ ...p, images: JSON.parse(p.images || '[]') }));
    res.json(parsed);
});

// PUT /api/products/reorder — update product display order in batch (admin only)
router.put('/reorder', requireAuth, (req, res) => {
    const { items } = req.body;
    if (!Array.isArray(items)) {
        return res.status(400).json({ error: 'Lista de ordenação inválida.' });
    }

    const db = getDb();
    const updateStmt = db.prepare('UPDATE products SET display_order = ? WHERE id = ?');

    const reorderTx = db.transaction((orderItems) => {
        for (let i = 0; i < orderItems.length; i++) {
            const item = orderItems[i];
            const id = typeof item === 'string' ? item : item.id;
            updateStmt.run(i, id);
        }
    });

    try {
        reorderTx(items);
        triggerAutoBackup();
        res.json({ success: true, message: 'Ordem de produtos atualizada.' });
    } catch (err) {
        console.error('Erro ao reordenar produtos:', err);
        res.status(500).json({ error: 'Erro ao salvar nova ordem.' });
    }
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
    triggerAutoBackup();
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
    triggerAutoBackup();
    res.json({ ...updated, images: JSON.parse(updated.images) });
});

// DELETE /api/products/:id — delete (admin only)
router.delete('/:id', requireAuth, (req, res) => {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Produto não encontrado.' });

    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    triggerAutoBackup();
    res.json({ success: true });
});

// POST /api/products/generate-details-ai — generate product subtitle and description based on title (admin only)
router.post('/generate-details-ai', requireAuth, async (req, res) => {
    const axios = require('axios');
    const { title } = req.body;
    if (!title || title.trim() === '') {
        return res.status(400).json({ error: 'Título é obrigatório para gerar com IA.' });
    }

    const API_KEY = process.env.OPENROUTER_API_KEY;
    if (!API_KEY) {
        return res.status(500).json({ error: 'OPENROUTER_API_KEY não configurada no servidor.' });
    }

    const systemPrompt = `You are a professional copywriter for a premium furniture and decor store called "Galpão do Cândido".
Your task is to generate an attractive subtitle and a detailed description in Portuguese (pt-BR) based on the product title provided.

Format your response as a valid JSON object with the following fields:
"subtitle": A short, catchy, marketing-focused one-sentence subtitle (max 10 words).
"description": A sophisticated, descriptive paragraph highlighting the material, quality, style, and cozy feel of the product (max 60 words).

Do NOT include markdown formatting like backticks (\`\`\`json) or any text other than the raw JSON object.

Example Input: "Cadeira Charles Eames"
Example Output:
{"subtitle": "Design clássico com conforto incomparável para sua sala.", "description": "A Cadeira Charles Eames combina perfeitamente elegância e ergonomia. Confeccionada com materiais nobres, possui acabamento impecável em madeira moldada e estofamento em couro legítimo, ideal para dar um toque de sofisticação moderna ao seu escritório ou sala de estar."}`;

    try {
        const response = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                model: 'openai/gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `Generate subtitle and description for product: "${title}"` }
                ],
                max_tokens: 300,
                temperature: 0.7
            },
            {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'http://localhost:3000',
                    'X-Title': 'Galpao do Candido - Product AI Generator'
                }
            }
        );

        const content = response.data.choices[0].message.content.trim();
        // Try parsing JSON. In case the model wrapped it, we try to clean it
        let jsonStr = content;
        if (jsonStr.includes('{')) {
            jsonStr = jsonStr.substring(jsonStr.indexOf('{'), jsonStr.lastIndexOf('}') + 1);
        }
        
        const details = JSON.parse(jsonStr);
        res.json({
            success: true,
            subtitle: details.subtitle,
            description: details.description
        });
    } catch (err) {
        console.error('Erro ao gerar detalhes com IA:', err);
        res.status(500).json({ error: `Erro na geração de IA: ${err.message}` });
    }
});

module.exports = router;
