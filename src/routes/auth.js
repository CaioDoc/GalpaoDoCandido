const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../db');

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    req.session.userId = user.id;
    req.session.username = user.username;
    res.json({ success: true, username: user.username });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
    req.session.destroy(() => {
        res.json({ success: true });
    });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
    if (req.session.userId) {
        res.json({ authenticated: true, username: req.session.username });
    } else {
        res.status(401).json({ authenticated: false });
    }
});

const googleAuthService = require('../services/googleAuthService');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { jwtAuth } = require('../middleware/jwtAuth');

const JWT_SECRET = process.env.JWT_SECRET || 'galpao_jwt_secret_2026';

// POST /api/auth/google
router.post('/google', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ success: false, error: 'Código não fornecido' });
    }
    
    const result = await googleAuthService.verifyToken(code);
    
    if (result.success) {
      const mongoose = require('mongoose');
      let dbUser = null;
      
      if (mongoose.connection.readyState === 1) {
        dbUser = await User.findOne({ googleId: result.user.id });
        if (!dbUser) {
          dbUser = new User({
            googleId: result.user.id,
            email: result.user.email,
            name: result.user.name,
            picture: result.user.picture
          });
          await dbUser.save();
          console.log(`👤 Novo usuário criado via Google OAuth: ${dbUser.email}`);
        } else {
          // Atualiza a foto e o nome se mudarem
          dbUser.name = result.user.name;
          dbUser.picture = result.user.picture;
          await dbUser.save();
        }
      }
      
      // Assina o token JWT
      const token = jwt.sign(
        { userId: dbUser ? dbUser._id : result.user.id, email: result.user.email },
        JWT_SECRET,
        { expiresIn: '7d' }
      );
      
      res.json({
        success: true,
        user: result.user,
        tokens: result.tokens,
        token,
        hasGeminiKey: !!(dbUser && dbUser.geminiKeyEncrypted)
      });
    } else {
      res.status(401).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Erro na autenticação Google:', error);
    res.status(500).json({ success: false, error: 'Erro na autenticação' });
  }
});

// GET /api/auth/gemini-key/status
router.get('/gemini-key/status', jwtAuth, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, hasGeminiKey: false });
    }
    
    const user = await User.findById(req.user.id);
    res.json({
      success: true,
      hasGeminiKey: !!(user && user.geminiKeyEncrypted)
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/auth/gemini-key
router.put('/gemini-key', jwtAuth, async (req, res) => {
  try {
    const { geminiKey } = req.body;
    if (!geminiKey) {
      return res.status(400).json({ success: false, error: 'Chave do Gemini é obrigatória' });
    }

    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({ success: false, error: 'MongoDB não conectado' });
    }

    const encryptionService = require('../services/encryptionService');
    const encrypted = encryptionService.encryptKey(geminiKey);
    
    await User.findByIdAndUpdate(req.user.id, { geminiKeyEncrypted: encrypted });
    
    console.log(`🔒 Chave Gemini criptografada e salva para usuário: ${req.user.email}`);

    res.json({ success: true, message: 'Chave do Gemini salva com sucesso' });
  } catch (error) {
    console.error('Erro ao salvar chave do Gemini:', error);
    res.status(500).json({ success: false, error: 'Erro ao salvar chave' });
  }
});

// DELETE /api/auth/gemini-key
router.delete('/gemini-key', jwtAuth, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({ success: false, error: 'MongoDB não conectado' });
    }

    await User.findByIdAndUpdate(req.user.id, { $unset: { geminiKeyEncrypted: "" } });
    
    console.log(`🗑️ Chave Gemini removida para usuário: ${req.user.email}`);

    res.json({ success: true, message: 'Chave do Gemini removida com sucesso' });
  } catch (error) {
    console.error('Erro ao remover chave do Gemini:', error);
    res.status(500).json({ success: false, error: 'Erro ao remover chave' });
  }
});

module.exports = router;
