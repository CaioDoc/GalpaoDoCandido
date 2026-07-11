const axios = require('axios');

async function improvePrompt(req, res) {
  try {
    const { prompt, language = 'pt-BR' } = req.body;
    
    if (!prompt || prompt.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        error: 'Prompt é obrigatório' 
      });
    }

    console.log('📝 Melhorando prompt:', prompt);

    const systemPrompt = `You are an expert prompt engineer specializing in DALL-E 3 image generation for marketing and product photography.

YOUR TASK:
1. Translate Portuguese (pt-BR) to English if needed
2. Enhance the prompt with professional photography details
3. Add: lighting, composition, style, quality, camera angles
4. Make it specific and descriptive
5. Return ONLY the improved prompt, no explanations or quotes

EXAMPLES:
Input: "cadeira eames em sala cozy"
Output: "Professional product photography of iconic Charles Eames lounge chair and ottoman in a cozy modern Scandinavian living room, warm natural lighting from large windows, soft beige and cream tones, minimalist interior design, wooden floor with soft rug, ambient daylight, plants in background, high quality, photorealistic, 8k resolution, commercial photography"

Input: "sofa marrom em ambiente moderno"
Output: "Luxury brown leather sofa in a contemporary modern living room, warm ambient lighting, mid-century modern style, walnut wood coffee table, soft textured throw pillows, indoor plants, architectural photography, professional studio lighting, ultra realistic, magazine quality"

Now improve this prompt: "${prompt}"`;

    const API_KEY = process.env.OPENROUTER_API_KEY;
    
    if (!API_KEY) {
      return res.status(500).json({ 
        success: false, 
        error: 'OPENROUTER_API_KEY não configurada no .env' 
      });
    }

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'openai/gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Improve this prompt for DALL-E 3: "${prompt}"` }
        ],
        max_tokens: 400,
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'Galpao do Candido - Prompt Improver'
        }
      }
    );

    const improvedPrompt = response.data.choices[0].message.content.trim();
    
    console.log('✅ Prompt melhorado:', improvedPrompt);
    
    res.json({
      success: true,
      originalPrompt: prompt,
      improvedPrompt: improvedPrompt,
      language: language === 'pt-BR' ? 'Traduzido PT→EN + Melhorado' : 'Melhorado'
    });

  } catch (error) {
    console.error('❌ Erro ao melhorar prompt:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    
    res.status(500).json({ 
      success: false, 
      error: error.response?.data?.error?.message || error.message,
      hint: 'Verifique se OPENROUTER_API_KEY está configurada no .env'
    });
  }
}

module.exports = { improvePrompt };
