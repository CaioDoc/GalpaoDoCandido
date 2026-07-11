import React from 'react';

export default function Header({ onNewProductClick }) {
  return (
    <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold text-white tracking-wide">Galpão do Cândido</h1>
      </div>
      <div className="flex items-center gap-3">
        <button 
          onClick={onNewProductClick}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          Novo Produto
        </button>
      </div>
    </header>
  );
}
