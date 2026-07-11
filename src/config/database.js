const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Remove as opções depreciadas que estão causando o crash!
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/galpao_do_candido');
    
    console.log(`✅ MongoDB Conectado: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ Erro MongoDB: ${error.message}`);
    // NÃO saia do processo! O servidor deve continuar rodando mesmo sem MongoDB
    console.warn('⚠️  Servidor continuará em modo limitado sem o scheduler de promoções MongoDB...');
    // process.exit(1);
  }
};

module.exports = connectDB;
