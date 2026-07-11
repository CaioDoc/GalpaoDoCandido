const express = require('express');
const { requireAuth } = require('../middleware/auth');
const promoteController = require('../controllers/promoteController');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '..', '..', 'uploads'));
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `promo-${uuidv4()}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Routes for Promotion Feature (admin authenticated)
router.get('/status', requireAuth, promoteController.getPromotionStatus);
router.post('/send', requireAuth, promoteController.sendPromotion);

// Adicionar esta nova rota para o Frontend pegar o status e o QR Code
router.get('/whatsapp-status', (req, res) => {
  const whatsappService = require('../services/whatsappService');
  res.json(whatsappService.getStatus());
});

// Nova rota para preparar o WhatsApp (recebe a mensagem e a imagem opcional)
router.post('/prepare-whatsapp', upload.single('imagem'), promoteController.prepareWhatsApp);

// Novas rotas para geração automática de texto e imagem via IA
router.post('/generate-message', requireAuth, promoteController.generateMessage);
router.post('/generate-image', requireAuth, promoteController.generateImage);

// Rotas para Promoção Geral IA
router.post('/generate-general-message', requireAuth, promoteController.generateGeneralMessage);
router.post('/send-general', requireAuth, promoteController.sendGeneralPromotion);

module.exports = router;
