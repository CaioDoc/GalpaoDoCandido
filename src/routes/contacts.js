const express = require('express');
const { getDb } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/contacts — submit a new contact message (Public)
router.post('/', (req, res) => {
    const { name, email, subject, message, imageUrl } = req.body;

    if (!name || !email || !subject || !message) {
        return res.status(400).json({ error: 'Por favor, preencha todos os campos obrigatórios (Nome, Email, Assunto e Mensagem).' });
    }

    const db = getDb();
    try {
        const stmt = db.prepare(`
            INSERT INTO contacts (name, email, subject, message, image_url)
            VALUES (?, ?, ?, ?, ?)
        `);
        const result = stmt.run(name.trim(), email.trim(), subject.trim(), message.trim(), imageUrl || null);

        res.json({
            success: true,
            id: result.lastInsertRowid,
            message: 'Sua mensagem foi enviada com sucesso! Entraremos em contato em breve.'
        });
    } catch (err) {
        console.error('Erro ao salvar mensagem de contato:', err);
        res.status(500).json({ error: 'Erro ao enviar mensagem. Tente novamente em instantes.' });
    }
});

// GET /api/contacts — list all contact messages (Admin Only)
router.get('/', requireAuth, (req, res) => {
    const db = getDb();
    try {
        const messages = db.prepare('SELECT * FROM contacts ORDER BY id DESC').all();
        const unreadCount = db.prepare("SELECT COUNT(*) as cnt FROM contacts WHERE status = 'unread'").get()?.cnt || 0;
        res.json({ success: true, messages, unreadCount });
    } catch (err) {
        console.error('Erro ao buscar mensagens:', err);
        res.status(500).json({ error: 'Erro ao carregar mensagens.' });
    }
});

// PUT /api/contacts/:id/reply — record admin reply to a contact message (Admin Only)
router.put('/:id/reply', requireAuth, (req, res) => {
    const { id } = req.params;
    const { replyMessage } = req.body;

    const db = getDb();
    try {
        const stmt = db.prepare(`
            UPDATE contacts
            SET reply_message = ?, replied_at = datetime('now'), status = 'replied'
            WHERE id = ?
        `);
        const result = stmt.run(replyMessage || 'Respondido via canal direto', id);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Mensagem não encontrada.' });
        }

        res.json({ success: true, message: 'Resposta registrada com sucesso!' });
    } catch (err) {
        console.error('Erro ao responder mensagem:', err);
        res.status(500).json({ error: 'Erro ao registrar resposta.' });
    }
});

// DELETE /api/contacts/:id — delete a contact message (Admin Only)
router.delete('/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    const db = getDb();
    try {
        const result = db.prepare('DELETE FROM contacts WHERE id = ?').run(id);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Mensagem não encontrada.' });
        }
        res.json({ success: true, message: 'Mensagem excluída com sucesso.' });
    } catch (err) {
        console.error('Erro ao excluir mensagem:', err);
        res.status(500).json({ error: 'Erro ao excluir mensagem.' });
    }
});

module.exports = router;
