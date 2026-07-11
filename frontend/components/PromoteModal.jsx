import React, { useState, useEffect } from 'react';
import { X, Upload, Wand2, Share2, Loader2, Smartphone, Image as ImageIcon } from 'lucide-react';

export default function PromoteModal({ isOpen, onClose, product }) {
  const [mensagem, setMensagem] = useState('');
  const [imgFile, setImgFile] = useState(null);
  const [imgPreview, setImgPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState({
    status: 'disconnected',
    qrCode: null,
    ready: false
  });

  useEffect(() => {
    if (!isOpen) return;
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/promote/whatsapp-status');
        const data = await res.json();
        setWhatsappStatus(data);
      } catch (error) {
        console.error('Erro ao buscar status:', error);
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, [isOpen]);

  const handleGenMensagem = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/promote/generate-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: product.name,
          productPrice: product.price,
          productDescription: product.description,
          productCategory: product.category,
          prompt: `Crie uma mensagem promocional atraente para WhatsApp sobre ${product.name}, preço R$ ${product?.price || ''}. Use emojis e seja persuasivo.`
        })
      });
      const data = await res.json();
      if (data.success) setMensagem(data.message);
    } catch {
      alert('Erro ao gerar mensagem');
    }
    setLoading(false);
  };

  const handleGenImagem = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/promote/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: product.name,
          productDescription: product.description,
          prompt: `Foto profissional de produto: ${product.name}, ${product.description}, estilo e-commerce premium, iluminação de estúdio, fundo neutro`
        })
      });
      const data = await res.json();
      if (data.success) {
        const blob = await fetch(data.imageUrl).then(r => r.blob());
        const file = new File([blob], 'promo-ia.png', { type: 'image/png' });
        setImgFile(file);
        setImgPreview(data.imageUrl);
      }
    } catch {
      alert('Erro ao gerar imagem');
    }
    setLoading(false);
  };

  const handlePromoverWhatsApp = async () => {
    if (!mensagem.trim()) {
      alert('Digite ou gere uma mensagem primeiro');
      return;
    }

    setLoading(true);
    try {
      // Prepara a mensagem e imagem para envio
      const formData = new FormData();
      formData.append('mensagem', mensagem);
      if (imgFile) formData.append('imagem', imgFile);
      formData.append('productId', product.id);

      // Salva temporariamente para usar no WhatsApp
      const res = await fetch('/api/promote/prepare-whatsapp', {
        method: 'POST',
        body: formData
      });
      
      const data = await res.json();
      
      if (data.success) {
        // Abre WhatsApp Web com link wa.me (usuário escolhe o contato)
        const encodedMsg = encodeURIComponent(mensagem);
        const waLink = `https://wa.me/?text=${encodedMsg}`;
        window.open(waLink, '_blank');
        
        // Se tiver imagem, informa que precisa enviar manualmente
        if (imgFile) {
          alert('📎 Imagem gerada! No WhatsApp, anexe a imagem antes de enviar.');
        }
        
        onClose();
      } else {
        alert('Erro ao preparar: ' + data.error);
      }
    } catch (error) {
      alert('Erro na conexão');
    }
    setLoading(false);
  };

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImgFile(file);
      setImgPreview(URL.createObjectURL(file));
    }
  };

  if (!isOpen) return null;

  const getStatusColor = () => {
    switch(whatsappStatus.status) {
      case 'connected': return 'bg-green-600';
      case 'connecting': return 'bg-yellow-600';
      default: return 'bg-red-600';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-gray-700">
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-white">Promover Produto</h2>
            <p className="text-gray-400 text-sm">{product?.name}</p>
            <p className="text-orange-400 font-semibold">R$ {product?.price}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={24} /></button>
        </div>

        <div className="p-6 space-y-6">
          {/* Status WhatsApp */}
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Smartphone className="text-gray-400" size={20} />
                <span className="text-white font-medium">WhatsApp</span>
              </div>
              <div className={`px-3 py-1 rounded-full text-sm text-white ${getStatusColor()}`}>
                {whatsappStatus.status === 'connected' ? 'Conectado ✓' : 
                 whatsappStatus.status === 'connecting' ? 'Conectando...' : 'Desconectado'}
              </div>
            </div>
            
            {whatsappStatus.status === 'disconnected' && whatsappStatus.qrCode && (
              <div className="mt-4 flex flex-col items-center">
                <div className="bg-white p-3 rounded-lg mb-2">
                  <img src={whatsappStatus.qrCode} alt="QR Code" className="w-48 h-48" />
                </div>
                <p className="text-sm text-gray-400">Escaneie para conectar</p>
              </div>
            )}
          </div>

          {/* Campo de Mensagem - Estilo Preencher Produto */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Mensagem Promocional
            </label>
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  placeholder="Descreva como quer promover este produto (ou use a IA)..."
                  className="flex-1 px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  onChange={(e) => setMensagem(e.target.value)}
                  value={mensagem}
                />
                <button
                  onClick={handleGenMensagem}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-lg font-medium disabled:opacity-50"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18} />}
                  Gerar com IA
                </button>
              </div>
              
              {mensagem && (
                <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
                  <p className="text-white text-sm whitespace-pre-wrap">{mensagem}</p>
                </div>
              )}
            </div>
          </div>

          {/* Geração de Imagem */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-300">Imagem do Produto</label>
              <button
                onClick={handleGenImagem}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-medium text-sm disabled:opacity-50"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}
                Gerar Imagem (Nano Banana)
              </button>
            </div>
            
            <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center relative hover:border-purple-500 transition-colors">
              <input
                type="file"
                accept="image/*"
                onChange={handleUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
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
                <div>
                  <Upload className="mx-auto h-12 w-12 text-gray-500" />
                  <p className="text-gray-400 mt-2">Clique ou arraste uma imagem</p>
                  <p className="text-xs text-gray-500 mt-1">PNG, JPG, WEBP até 10MB</p>
                </div>
              )}
            </div>
          </div>

          {/* Botão Promover */}
          <div className="pt-4">
            <button
              onClick={handlePromoverWhatsApp}
              disabled={loading || !mensagem || whatsappStatus.status !== 'connected'}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <Loader2 size={24} className="animate-spin" />
              ) : (
                <>
                  <Share2 size={24} />
                  Promover no WhatsApp
                </>
              )}
            </button>
            {whatsappStatus.status !== 'connected' && (
              <p className="text-center text-sm text-yellow-500 mt-2">
                ⚠️ Conecte o WhatsApp para promover
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
