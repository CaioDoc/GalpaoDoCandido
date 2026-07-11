import React, { useState, useEffect } from 'react';
import { X, Image as ImageIcon, Calendar, Clock, Loader2, Smartphone } from 'lucide-react';

export default function CreatePromotionModal({ isOpen, onClose, product }) {
  const [step, setStep] = useState(1); // 1: Conteúdo, 2: Agendamento
  const [mensagem, setMensagem] = useState('');
  const [imgPreview, setImgPreview] = useState(null);
  const [imgFile, setImgFile] = useState(null);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [promptText, setPromptText] = useState('');
  
  // OpenRouter e Modelos de Imagem
  const [imageModel, setImageModel] = useState('dall-e-3');
  const [useOpenRouter, setUseOpenRouter] = useState(true); // true = OpenRouter, false = Pollinations

  // Define data mínima como hoje
  const minDate = new Date().toISOString().split('T')[0];
  
  // Define hora mínima
  const now = new Date();
  const minTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  useEffect(() => {
    if (isOpen) {
      // Define data mínima como hoje
      const today = new Date().toISOString().split('T')[0];
      setScheduledDate(today);
      
      // Define hora mínima como agora + 5 minutos
      const now = new Date();
      now.setMinutes(now.getMinutes() + 5);
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      setScheduledTime(`${hours}:${minutes}`);

      // Prompt padrão da imagem baseado no produto
      if (product) {
        setPromptText(`Foto profissional de ${product.name}, ${product.description || ''}, estilo e-commerce premium, iluminação de estúdio, fundo neutro, altamente detalhado`);
        
        // Mensagem promocional padrão pré-formatada para WhatsApp
        const formattedPrice = typeof product.price === 'number' 
          ? product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
          : product.price;
          
        setMensagem(`Olá! 🌟\n\nTemos uma novidade imperdível do *Galpão do Cândido* para você! ✨\n\nAcabamos de colocar em oferta especial a magnífica peça: *${product.name}* (${product.category || 'Mobiliário de Época'}).\n\nPreço: R$ ${formattedPrice}\n\n*Sobre a peça:*\n_${product.description || 'Um exemplar raro e autêntico que reúne design atemporal e estado de conservação primoroso.'}_\n\nQuer garantir ou agendar uma visita para ver de perto? Fale conosco! 📲`);
      }
    }
  }, [isOpen]);

  const handleGenerateImage = async () => {
    if (!promptText) {
      alert('Digite uma descrição para a imagem');
      return;
    }

    setLoading(true);
    
    try {
      let endpoint, body;
      
      if (useOpenRouter) {
        // Usar OpenRouter
        endpoint = '/api/promotion/generate-image-openai';
        body = {
          prompt: promptText,
          model: imageModel,
          size: '1024x1024'
        };
      } else {
        // Usar Pollinations (fallback grátis)
        endpoint = '/api/promotion/generate-image';
        body = { customPrompt: promptText };
      }
      
      console.log(`🚀 Gerando imagem via ${useOpenRouter ? 'OpenRouter' : 'Pollinations'}...`);
      
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const data = await res.json();
      
      if (data.success) {
        setImgPreview(data.imageUrl);
        setImgFile({ name: 'generated.png', path: data.imageUrl });
        alert(`✅ Imagem gerada com ${data.provider || 'IA'}!`);
      } else {
        alert('❌ Erro ao gerar imagem: ' + (data.error || 'Erro desconhecido'));
      }
    } catch (error) {
      console.error('Erro:', error);
      alert('❌ Erro na conexão com o servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleSchedule = async () => {
    if (!mensagem) {
      alert('Digite ou gere uma mensagem');
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('productName', product.name);
    formData.append('productId', product._id || product.id);
    formData.append('message', mensagem);
    formData.append('scheduledDate', scheduledDate);
    formData.append('scheduledTime', scheduledTime);
    formData.append('whatsappNumber', whatsappNumber);
    
    if (imgFile) {
      formData.append('image', imgFile);
    }

    try {
      const token = localStorage.getItem('googleToken');
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/promotion/schedule', {
        method: 'POST',
        headers,
        body: formData
      });
      
      const data = await res.json();
      if (data.success) {
        alert('✅ Promoção agendada com sucesso!');
        onClose();
      } else {
        alert('Erro ao agendar: ' + data.error);
      }
    } catch {
      alert('Erro na conexão');
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-700">
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-white">Criar Promoção</h2>
            <p className="text-gray-400 text-sm">{product?.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={24} /></button>
        </div>

        <div className="p-6 space-y-6">
          {/* Step 1: Conteúdo */}
          <div className="space-y-6">
            {/* Mensagem Promocional */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Mensagem Promocional (WhatsApp)
              </label>
              <textarea
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                rows={5}
                placeholder="Escreva sua mensagem promocional..."
                className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none resize-none"
              />
            </div>

            {/* Geração de Imagem */}
            <div className="space-y-3">
              {/* Seletor de IA */}
              <div className="mb-4 bg-gray-800/40 p-4 rounded-lg border border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-300">
                    Serviço de IA
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setUseOpenRouter(true)}
                      className={`px-3 py-1 text-xs font-semibold rounded transition-all ${useOpenRouter ? 'bg-purple-600 text-white shadow-md' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                    >
                      OpenRouter (Premium)
                    </button>
                    <button
                      type="button"
                      onClick={() => setUseOpenRouter(false)}
                      className={`px-3 py-1 text-xs font-semibold rounded transition-all ${!useOpenRouter ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                    >
                      Pollinations (Grátis)
                    </button>
                  </div>
                </div>
                
                {useOpenRouter && (
                  <select
                    value={imageModel}
                    onChange={(e) => setImageModel(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-sm text-white focus:border-purple-500 outline-none"
                  >
                    <option value="dall-e-3">DALL-E 3 (Melhor para banners/texto)</option>
                    <option value="flux">Flux Pro (Realismo fotográfico)</option>
                    <option value="dall-e-2">DALL-E 2 (Mais rápido)</option>
                    <option value="stable-diffusion">Stable Diffusion (Versátil)</option>
                  </select>
                )}
              </div>

              <div className="flex justify-between items-center">
                <label className="block text-sm font-medium text-gray-300">
                  Prompt da Imagem
                </label>
                <button
                  type="button"
                  onClick={handleGenerateImage}
                  disabled={loading || !promptText}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-medium text-sm disabled:opacity-50 transition-all"
                >
                  {loading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <ImageIcon size={16} />
                  )}
                  Gerar Imagem IA ({useOpenRouter ? 'OpenRouter' : 'Pollinations'})
                </button>
              </div>
              
              <div>
                <input
                  type="text"
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  placeholder="Descreva o que deseja na imagem promocional..."
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center relative hover:border-purple-500 transition-colors">
                {imgPreview ? (
                  <div className="relative">
                    <img src={imgPreview} alt="Preview" className="max-h-64 mx-auto rounded-lg" />
                    <button
                      onClick={(e) => { e.preventDefault(); setImgFile(null); setImgPreview(null); }}
                      className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-2 rounded-full"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="text-gray-400">
                    <ImageIcon className="mx-auto h-12 w-12 mb-2" />
                    <p>Descreva acima e clique em "Gerar Imagem IA"</p>
                  </div>
                )}
              </div>
            </div>

            {/* WhatsApp e Agendamento */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  WhatsApp (opcional)
                </label>
                <div className="relative">
                  <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    placeholder="5511999999999"
                    className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-green-500 focus:outline-none"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Deixe em branco para escolher manualmente</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Data de Envio
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    min={minDate}
                    className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-green-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Hora de Envio
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    min={scheduledDate === minDate ? minTime : '00:00'}
                    className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-green-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Botão Agendar */}
          <div className="pt-4 border-t border-gray-700">
            <button
              onClick={handleSchedule}
              disabled={loading || !mensagem}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <Loader2 size={24} className="animate-spin" />
              ) : (
                <>
                  <Calendar size={24} />
                  Agendar Promoção
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
