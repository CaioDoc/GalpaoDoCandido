const whatsappService = require('../services/whatsappService');
const { getDb } = require('../db');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { v4: uuidv4 } = require('uuid');

/**
 * GET /api/promote/status
 * Returns the current status of the WhatsApp connection.
 */
function getPromotionStatus(req, res) {
    const wsStatus = whatsappService.getStatus();
    res.json(wsStatus);
}

/**
 * POST /api/promote/send
 * Generates a personalized promotion via Gemini and sends it to the customer via WhatsApp.
 */
async function sendPromotion(req, res) {
    const { productId, phoneNumber, phone, groupLink, mensagem, discount, tone, customPrompt, scheduleDate, scheduleTime } = req.body;
    const targetPhone = phone || phoneNumber;
    
    if (!productId) {
        return res.status(400).json({ error: 'ID do produto é obrigatório.' });
    }
    
    if (!targetPhone && !groupLink) {
        return res.status(400).json({ error: 'Número de WhatsApp do cliente ou Link do Grupo do WhatsApp é obrigatório.' });
    }
    
    try {
        const db = getDb();
        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
        
        if (!product) {
            return res.status(404).json({ error: 'Produto não encontrado.' });
        }
        
        // Parse images from JSON if needed
        try {
            product.images = JSON.parse(product.images);
        } catch {
            product.images = [];
        }
        
        // 1. Get or Generate marketing message
        let promotionMessage = mensagem;
        if (!promotionMessage) {
            console.log(`🧠 Mensagem vazia. Gerando texto da promoção para o produto: "${product.title || product.name}" localmente...`);
            const title = product.title || product.name || 'Peça Exclusiva';
            const formattedPrice = typeof product.price === 'number' 
                ? product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                : product.price;
            promotionMessage = `Olá! 🌟\n\nTemos uma novidade imperdível do *Galpão do Cândido* para você! ✨\n\nAcabamos de colocar em oferta especial a magnífica peça: *${title}* (${product.category || 'Mobiliário de Época'}).\n\nPreço Original: R$ ${formattedPrice}\nCondição Especial: *${discount || 'Desconto exclusivo'}*! 💸\n\n*Sobre a peça:*\n_${product.description || 'Um exemplar raro e autêntico que reúne design atemporal e estado de conservação primoroso.'}_\n\nEssa é uma oportunidade única para adquirir uma peça histórica e exclusiva para o seu ambiente. 🏡🪑\n\nQuer garantir ou agendar uma visita para ver de perto? Fale conosco! 📲\n\nAbraços,\n*Galpão do Cândido* 🪑✨`;
        }
        
        // 2. Resolve image path if the product has images
        let imagePath = null;
        const path = require('path');
        const fs = require('fs');
        if (product.images && product.images.length > 0) {
            const firstImage = product.images[0];
            if (firstImage.startsWith('/uploads/')) {
                const imageName = firstImage.replace('/uploads/', '');
                imagePath = path.join(__dirname, '..', '..', 'uploads', imageName);
                if (!fs.existsSync(imagePath)) {
                    imagePath = null;
                }
            }
        }
        
        // 3. Check if this is a scheduled promotion
        const isGroup = !!groupLink;
        const target = isGroup ? groupLink : targetPhone;
        
        if (scheduleDate && scheduleTime) {
            const scheduledAt = `${scheduleDate} ${scheduleTime}`; // "YYYY-MM-DD HH:MM"
            console.log(`⏰ Agendando promoção para o produto: "${product.title}" às ${scheduledAt}...`);
            
            db.prepare(`
                INSERT INTO scheduled_promotions (product_id, target, is_group, message, image_path, scheduled_at, status)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(productId, target, isGroup ? 1 : 0, promotionMessage, imagePath, scheduledAt, 'pending');
            
            return res.json({
                success: true,
                message: `Promoção agendada com sucesso para ${scheduleDate} às ${scheduleTime}!`,
                scheduled: true,
                scheduledAt
            });
        }
        
        // 4. Send the message immediately via WhatsApp service
        console.log(`📤 Enviando mensagem via WhatsApp para ${isGroup ? 'o grupo' : 'o telefone ' + target}...`);
        await whatsappService.sendMessage(target, promotionMessage, imagePath, isGroup);
        
        res.json({
            success: true,
            message: 'Promoção enviada com sucesso!',
            content: promotionMessage
        });
    } catch (err) {
        console.error('✕ Falha ao enviar promoção via WhatsApp:', err);
        res.status(500).json({ error: err.message || 'Erro interno ao processar promoção.' });
    }
}

/**
 * POST /api/promote/prepare-whatsapp
 * Temporarily saves message and image data for promotion.
 */
async function prepareWhatsApp(req, res) {
  try {
    const { mensagem, productId } = req.body;
    const imageFile = req.file;
    
    // Salva temporariamente a mensagem e imagem
    const promoData = {
      id: Date.now(),
      mensagem,
      imagem: imageFile ? imageFile.path : null,
      productId,
      createdAt: new Date()
    };
    
    // Armazena em memória (simplificado)
    global.pendingPromos = global.pendingPromos || {};
    global.pendingPromos[promoData.id] = promoData;
    
    res.json({ 
      success: true, 
      promoId: promoData.id,
      message: 'Pronto para enviar' 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * POST /api/promote/generate-message
 * Generates a promotional message for a product locally.
 */
async function generateMessage(req, res) {
  try {
    const { productId, discount, tone, customPrompt, productName, productPrice, productDescription, productCategory, prompt } = req.body;
    
    let product;
    if (productId) {
      const db = getDb();
      product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
      if (!product) {
        return res.status(404).json({ error: 'Produto não encontrado.' });
      }
      try {
        product.images = JSON.parse(product.images);
      } catch {
        product.images = [];
      }
    } else {
      product = {
        name: productName || 'Produto Especial',
        price: parseFloat(productPrice) || 0,
        description: productDescription || '',
        category: productCategory || 'Outros'
      };
    }
    
    const title = product.name || product.title || 'Peça Exclusiva';
    const formattedPrice = typeof product.price === 'number' 
      ? product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
      : product.price;

    const message = `Olá! 🌟\n\nTemos uma novidade imperdível do *Galpão do Cândido* para você! ✨\n\nAcabamos de colocar em oferta especial a magnífica peça: *${title}* (${product.category || 'Mobiliário de Época'}).\n\nPreço Original: R$ ${formattedPrice}\nCondição Especial: *${discount || 'Desconto exclusivo'}*! 💸\n\n*Sobre a peça:*\n_${product.description || 'Um exemplar raro e autêntico que reúne design atemporal e estado de conservação primoroso.'}_\n\nEssa é uma oportunidade única para adquirir uma peça histórica e exclusiva para o seu ambiente. 🏡🪑\n\nQuer garantir ou agendar uma visita para ver de perto? Fale conosco! 📲\n\nAbraços,\n*Galpão do Cândido* 🪑✨`;
    
    res.json({ success: true, message });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * POST /api/promote/generate-image
 * Generates/returns a marketing image for the product using the local Nano Banana IA generator.
 */
async function generateImage(req, res) {
  try {
    const { productName, productDescription, prompt } = req.body;
    const finalPrompt = prompt || `Foto de e-commerce premium de ${productName || ''}, ${productDescription || ''}`;

    console.log('🎨 Gerando imagem com Pollinations.ai...');
    
    const seed = Math.floor(Math.random() * 1000000);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}?width=1024&height=768&seed=${seed}&nologo=true&model=flux`;

    const axios = require('axios');
    const fs = require('fs');
    const path = require('path');

    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    
    const dir = 'uploads/promotions/';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    const filename = `promo-${Date.now()}.jpg`;
    const filepath = path.join(dir, filename);
    fs.writeFileSync(filepath, response.data);
    
    console.log('✅ Imagem salva:', filepath);
    
    res.json({ 
      success: true, 
      imageUrl: `/uploads/promotions/${filename}`,
      message: 'Imagem gerada com sucesso!'
    });
  } catch (error) {
    console.error('❌ Erro ao gerar imagem com Pollinations:', error);
    res.status(500).json({ success: false, error: 'Falha ao gerar imagem' });
  }
}

/**
 * POST /api/promote/generate-general-message
 * Generates a promotional message for a general campaign locally.
 */
async function generateGeneralMessage(req, res) {
    try {
        const { theme, discount, tone } = req.body;
        
        const messageText = `Olá! 🌟\n\nTemos uma novidade imperdível do *Galpão do Cândido* para você! ✨\n\nEstá começando a nossa campanha: *${theme || 'Grande Queima Vintage'}*! 🎉\n\nAproveite condições exclusivas com *${discount || 'um desconto especial'}* por tempo limitado! 💸\n\nEssa é uma oportunidade única para adquirir peças vintage de época em estado de conservação primoroso. 🏡🪑\n\nQuer garantir ou agendar uma visita para ver de perto? Fale conosco! 📲\n\nAbraços,\n*Galpão do Cândido* 🪑✨`;
        
        res.json({ success: true, message: messageText });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

/**
 * POST /api/promote/send-general
 * Envia ou agenda uma promoção geral (sem produto vinculado) com imagem e mensagem.
 */
async function sendGeneralPromotion(req, res) {
    const { phone, groupLink, mensagem, scheduleDate, scheduleTime, customImagePath } = req.body;
    const targetPhone = phone;
    
    if (!targetPhone && !groupLink) {
        return res.status(400).json({ error: 'Número de WhatsApp do cliente ou Link do Grupo do WhatsApp é obrigatório.' });
    }
    
    try {
        // 1. Resolve physical image path
        let imagePath = null;
        if (customImagePath) {
            if (customImagePath.startsWith('/uploads/')) {
                const imageName = customImagePath.replace('/uploads/', '');
                imagePath = path.join(__dirname, '..', '..', 'uploads', imageName);
                if (!fs.existsSync(imagePath)) {
                    imagePath = null;
                }
            } else if (customImagePath.startsWith('data:image/')) {
                console.log('📦 Recebido upload local via Base64. Salvando no servidor...');
                const base64Data = customImagePath.split(';base64,').pop();
                const buffer = Buffer.from(base64Data, 'base64');
                const dir = path.join(__dirname, '..', '..', 'uploads', 'promotions');
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                
                const filename = `local-${Date.now()}.png`;
                imagePath = path.join(dir, filename);
                fs.writeFileSync(imagePath, buffer);
                console.log('💾 Upload local salvo em:', imagePath);
            }
        }
        
        // 2. Check if this is a scheduled promotion
        const isGroup = !!groupLink;
        const target = isGroup ? groupLink : targetPhone;
        
        if (scheduleDate && scheduleTime) {
            const scheduledAt = `${scheduleDate} ${scheduleTime}`; // "YYYY-MM-DD HH:MM"
            console.log(`⏰ Agendando promoção geral às ${scheduledAt}...`);
            
            const db = getDb();
            db.prepare(`
                INSERT INTO scheduled_promotions (product_id, target, is_group, message, image_path, scheduled_at, status)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run('general', target, isGroup ? 1 : 0, mensagem, imagePath, scheduledAt, 'pending');
            
            return res.json({
                success: true,
                message: `Promoção agendada com sucesso para ${scheduleDate} às ${scheduleTime}!`,
                scheduled: true,
                scheduledAt
            });
        }
        
        // 3. Send the message immediately via WhatsApp service
        console.log(`📤 Enviando promoção geral via WhatsApp para ${isGroup ? 'o grupo' : 'o telefone ' + target}...`);
        await whatsappService.sendMessage(target, mensagem, imagePath, isGroup);
        
        res.json({
            success: true,
            message: 'Promoção geral enviada com sucesso!'
        });
    } catch (err) {
        console.error('✕ Falha ao enviar promoção geral:', err);
        res.status(500).json({ error: err.message || 'Erro interno ao processar.' });
    }
}

module.exports = {
    getPromotionStatus,
    sendPromotion,
    prepareWhatsApp,
    generateMessage,
    generateImage,
    generateGeneralMessage,
    sendGeneralPromotion
};
