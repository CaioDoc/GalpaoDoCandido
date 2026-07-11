const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuração multer para upload de imagens
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/promotions/';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `promo-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const extname = allowed.test(path.extname(file.originalname).toLowerCase());
    if (extname) cb(null, true);
    else cb(new Error('Apenas imagens'));
  }
});

module.exports = {
  upload,

  async generatePromoText(req, res) {
    try {
      const { productName, productPrice, productDescription, productCategory } = req.body;
      
      const title = productName || 'Peça Exclusiva';
      const formattedPrice = productPrice
        ? (typeof productPrice === 'number' ? productPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : parseFloat(productPrice).toLocaleString('pt-BR', { minimumFractionDigits: 2 }))
        : '0,00';

      const message = `Olá! 🌟\n\nTemos uma novidade imperdível do *Galpão do Cândido* para você! ✨\n\nAcabamos de colocar em oferta especial a magnífica peça: *${title}* (${productCategory || 'Mobiliário de Época'}).\n\nPreço Especial: R$ ${formattedPrice}\n\n*Sobre a peça:*\n_${productDescription || 'Um exemplar raro e autêntico que reúne design atemporal e estado de conservação primoroso.'}_\n\nEssa é uma oportunidade única para adquirir uma peça histórica e exclusiva para o seu ambiente. 🏡🪑\n\nQuer garantir ou agendar uma visita para ver de perto? Fale conosco! 📲\n\nAbraços,\n*Galpão do Cândido* 🪑✨`;

      res.json({ success: true, message });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Erro ao gerar texto: ' + error.message });
    }
  },

  async generatePromoImage(req, res) {
    try {
      const { customPrompt } = req.body;
      if (!customPrompt) return res.status(400).json({ error: 'Prompt é obrigatório' });

      console.log('🎨 Gerando imagem com Pollinations.ai...');
      
      // URL da API Pollinations (Sem API Key!)
      const seed = Math.floor(Math.random() * 1000000);
      const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(customPrompt)}?width=1024&height=768&seed=${seed}&nologo=true&model=flux`;

      // Baixar a imagem
      const axios = require('axios');
      const fs = require('fs');
      const path = require('path');

      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      
      // Salvar localmente
      const dir = 'uploads/promotions/';
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      
      const filename = `promo-${Date.now()}.jpg`;
      const filepath = path.join(dir, filename);
      fs.writeFileSync(filepath, response.data);
      
      console.log('✅ Imagem salva:', filepath);
      
      // Retornar URL pública
      res.json({ 
        success: true, 
        imageUrl: `/uploads/promotions/${filename}`,
        message: 'Imagem gerada com sucesso!'
      });

    } catch (error) {
      console.error('❌ Erro ao gerar imagem:', error);
      res.status(500).json({ success: false, error: 'Falha ao gerar imagem' });
    }
  },

  async schedulePromotion(req, res) {
    try {
      const { 
        productName, 
        productId,
        message, 
        scheduledDate, 
        scheduledTime,
        whatsappNumber 
      } = req.body;
      
      const imageFile = req.file;
      const scheduledAt = `${scheduledDate} ${scheduledTime}`; // "YYYY-MM-DD HH:MM"
      const target = whatsappNumber || '5511999999999';

      const { getDb } = require('../db');
      const db = getDb();
      
      const stmt = db.prepare(`
        INSERT INTO scheduled_promotions (product_id, target, is_group, message, image_path, scheduled_at, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      const info = stmt.run(
        productId || 'general',
        target,
        0, // is_group = 0
        message,
        imageFile ? imageFile.path : null,
        scheduledAt,
        'pending'
      );

      res.json({ 
        success: true, 
        promotion: {
          id: info.lastInsertRowid,
          product_id: productId,
          target,
          message,
          scheduled_at: scheduledAt,
          status: 'pending'
        } 
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  async getPromotions(req, res) {
    try {
      const { getDb } = require('../db');
      const db = getDb();
      
      const promotions = db.prepare(`
        SELECT p.id, p.product_id, p.target, p.is_group, p.message, p.image_path, p.scheduled_at, p.status, p.error_message, pr.title as productTitle
        FROM scheduled_promotions p
        LEFT JOIN products pr ON p.product_id = pr.id
        ORDER BY p.scheduled_at DESC
      `).all();
      
      const mappedPromotions = promotions.map(p => ({
        _id: p.id.toString(),
        id: p.id,
        productName: p.productTitle || 'Promoção Geral',
        productId: { id: p.product_id, name: p.productTitle || 'Promoção Geral' },
        message: p.message,
        scheduledDate: p.scheduled_at.split(' ')[0],
        scheduledTime: p.scheduled_at.split(' ')[1],
        status: p.status,
        whatsappNumber: p.target,
        imagePath: p.image_path
      }));
      
      res.json({ success: true, promotions: mappedPromotions });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  async cancelPromotion(req, res) {
    try {
      const { id } = req.params;
      const { getDb } = require('../db');
      const db = getDb();
      
      db.prepare("UPDATE scheduled_promotions SET status = 'cancelled' WHERE id = ?").run(id);
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
};
