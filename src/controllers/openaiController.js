const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Carrega a chave diretamente da variável de ambiente (configurada no Railway)
const API_KEY = process.env.OPENROUTER_API_KEY;
const BASE_URL = 'https://openrouter.ai/api/v1';

async function generateImage(req, res) {
  try {
    const { prompt, model = 'dall-e-3' } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt é obrigatório' });
    }

    // Mapeamento para modelos de imagem ativos no OpenRouter
    const modelMap = {
      'dall-e-3': 'openai/gpt-5-image',
      'dall-e-2': 'openai/gpt-5-image-mini',
      'flux': 'openai/gpt-5.4-image-2',
      'stable-diffusion': 'google/gemini-2.5-flash-image'
    };

    const selectedModel = modelMap[model] || modelMap['dall-e-3'];
    
    console.log(`🎨 [OpenRouter] Gerando: ${selectedModel}`);

    // Headers OBRIGATÓRIOS do OpenRouter
    const headers = {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'Galpao do Candido'
    };

    // Corpo da requisição para chat/completions com modalities: ["image"]
    const payload = {
      model: selectedModel,
      messages: [
        {
          role: 'user',
          content: `Professional product photography: ${prompt}, ultra realistic, commercial quality, studio lighting`
        }
      ],
      modalities: ['image']
    };

    console.log('📤 Enviando para:', `${BASE_URL}/chat/completions`);

    // POST para gerar imagem
    const response = await axios.post(
      `${BASE_URL}/chat/completions`,
      payload,
      { headers, timeout: 60000 }
    );

    console.log('✅ Resposta OpenRouter:', response.status);

    const choices = response.data?.choices;
    const firstChoice = choices?.[0];
    const images = firstChoice?.message?.images;
    const imageUrl = images?.[0]?.image_url?.url || images?.[0]?.url;

    if (!imageUrl) {
      console.error('Resposta sem imagem:', JSON.stringify(response.data));
      throw new Error('Nenhuma imagem foi retornada pelo OpenRouter. Verifique o saldo e o modelo.');
    }

    // Baixar imagem (suporta base64 codificado ou link público)
    let imageBuffer;
    if (imageUrl.startsWith('data:image')) {
      console.log('📦 Imagem recebida como Base64!');
      const base64Data = imageUrl.split(';base64,').pop();
      imageBuffer = Buffer.from(base64Data, 'base64');
    } else {
      console.log('🌐 Baixando imagem da URL remota...');
      const imageResponse = await axios.get(imageUrl, { 
        responseType: 'arraybuffer',
        timeout: 30000 
      });
      imageBuffer = imageResponse.data;
    }
    
    // Salvar localmente
    const dir = 'uploads/promotions/';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    const filename = `or-${Date.now()}.png`;
    const filepath = path.join(dir, filename);
    fs.writeFileSync(filepath, imageBuffer);
    
    console.log('💾 Imagem salva:', filepath);
    
    res.json({
      success: true,
      imageUrl: `/uploads/promotions/${filename}`,
      provider: selectedModel,
      message: 'Imagem gerada com sucesso!'
    });

  } catch (error) {
    console.error('❌ ERRO OpenRouter:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    
    res.status(500).json({ 
      success: false, 
      error: error.response?.data?.error?.message || error.message,
      status: error.response?.status,
      hint: 'Verifique: modelo disponível, créditos, prompt válido'
    });
  }
}

// Rota de TESTE funcional
async function testOpenAI(req, res) {
  try {
    console.log('🧪 Teste OpenRouter iniciado...');
    
    const headers = {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:3000'
    };

    // 1. Testar autenticação
    const auth = await axios.get(`${BASE_URL}/auth/key`, { headers });
    console.log('✅ Auth OK:', auth.data.data?.label);

    // 2. Gerar imagem de teste
    const response = await axios.post(
      `${BASE_URL}/chat/completions`,
      {
        model: 'openai/gpt-5-image-mini',
        messages: [
          {
            role: 'user',
            content: 'A minimalist white chair in a bright modern room, professional photography'
          }
        ],
        modalities: ['image']
      },
      { headers, timeout: 60000 }
    );

    const choices = response.data?.choices;
    const firstChoice = choices?.[0];
    const images = firstChoice?.message?.images;
    const imageUrl = images?.[0]?.image_url?.url || images?.[0]?.url;

    if (!imageUrl) {
      throw new Error('Nenhuma imagem retornada no teste.');
    }
    
    res.json({
      success: true,
      message: '✅ OpenRouter funcionando perfeitamente!',
      imageUrl: imageUrl,
      model: 'openai/gpt-5-image-mini',
      credits_used: auth.data.data?.usage
    });
    
  } catch (error) {
    console.error('❌ Falha no teste:', error.response?.data || error.message);
    
    res.json({
      success: false,
      error: error.response?.data?.error?.message || error.message,
      status: error.response?.status,
      debug: {
        apiKey: 'Configurada e válida (testada via curl)',
        baseUrl: BASE_URL,
        endpoint: `${BASE_URL}/chat/completions`
      }
    });
  }
}

module.exports = { generateImage, testOpenAI };
