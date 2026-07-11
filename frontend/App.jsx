import React, { useState } from 'react';
import Header from './components/Header';
import CreatePromotionModal from './components/CreatePromotionModal';

export default function App() {
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
  const [selectedProduct] = useState({
    id: 'prod-123',
    name: 'Poltrona Eames Vintage',
    price: 4500.00,
    description: 'Poltrona clássica de madeira jacarandá e couro legítimo.',
    category: 'Móveis de Época'
  });

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Header onNewProductClick={() => setIsPromoModalOpen(true)} />
      
      <main className="max-w-7xl mx-auto p-8 space-y-6">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <span className="text-blue-500 font-semibold text-sm uppercase tracking-wider">Demo de Produto</span>
            <h2 className="text-3xl font-extrabold text-white mt-1">{selectedProduct.name}</h2>
            <p className="text-gray-400 mt-2 max-w-xl">{selectedProduct.description}</p>
            <div className="text-2xl font-bold text-green-400 mt-4">
              R$ {selectedProduct.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </div>
          
          <button 
            onClick={() => setIsPromoModalOpen(true)}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-lg font-bold shadow-lg hover:shadow-cyan-900/40 transition-all flex items-center gap-2"
          >
            Criar Promoção com IA
          </button>
        </div>
      </main>

      <CreatePromotionModal 
        isOpen={isPromoModalOpen}
        onClose={() => setIsPromoModalOpen(false)}
        product={selectedProduct}
      />
    </div>
  );
}
