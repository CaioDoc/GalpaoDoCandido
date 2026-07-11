const express = require('express');
const router = express.Router();
const promotionController = require('../controllers/promotionController');
const { requireAuth } = require('../middleware/auth'); // using the project's actual auth middleware requireAuth

router.post('/generate-text', promotionController.generatePromoText);
router.post('/generate-image', promotionController.generatePromoImage);
router.post('/schedule', promotionController.upload.single('image'), promotionController.schedulePromotion);
router.get('/list', promotionController.getPromotions);
router.put('/cancel/:id', promotionController.cancelPromotion);

const openaiController = require('../controllers/openaiController');
const promptController = require('../controllers/promptController');

// Rota OpenRouter (substitui ou complementa a Pollinations)
router.post('/generate-image-openai', openaiController.generateImage);
router.get('/test-openai', openaiController.testOpenAI);
router.post('/improve-prompt', promptController.improvePrompt);

module.exports = router;
