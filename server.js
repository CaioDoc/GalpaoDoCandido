require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

const { initDb } = require('./src/db');
// const connectDB = require('./src/config/database');
// const authRoutes = require('./src/routes/auth');
// const authRoutesNew = require('./src/routes/authRoutes');
// const userRoutes = require('./src/routes/userRoutes');
const productRoutes = require('./src/routes/products');
const uploadRoutes = require('./src/routes/upload');
const categoryRoutes = require('./src/routes/categories');
const settingsRoutes = require('./src/routes/settings');
const promoteRoutes = require('./src/routes/promoteRoutes');
const promotionRoutes = require('./src/routes/promotionRoutes');
const whatsappService = require('./src/services/whatsappService');
const schedulerService = require('./src/services/schedulerService');
// const promotionScheduler = require('./src/services/promotionScheduler');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads', 'promotions');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('📁 Pasta uploads/promotions criada');
}

// Initialize database (SQLite)
initDb();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session
const SQLiteStore = require('connect-sqlite3')(session);
app.use(session({
    store: new SQLiteStore({ db: 'sessions.sqlite', dir: './' }),
    secret: process.env.SESSION_SECRET || 'galpao_secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
// app.use('/api/auth', authRoutes);
// app.use('/api/auth', authRoutesNew);
// app.use('/api/user', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/promote', promoteRoutes);
app.use('/api/promotion', promotionRoutes);

// SPA fallback for admin
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});
app.get('/admin/login', (req, res) => {
    res.redirect('/admin');
});

// Start function to prevent server from crashing during dependency startup failures
async function startServer() {
    try {
        console.log('🔄 Inicializando serviços de banco de dados e comunicação...');
        
        // 1. MongoDB Connect (non-blocking) - Desativado para remover dependências do Google/Gemini
        /*
        try {
            await connectDB();
        } catch (err) {
            console.error('⚠️  MongoDB não conectado, continuando...', err.message);
        }
        */

        // 2. WhatsApp Web Service (non-blocking)
        try {
            await whatsappService.initialize();
            console.log('✅ WhatsApp Web Service inicializado');
        } catch (err) {
            console.error('⚠️  WhatsApp não inicializado, continuando...', err.message);
        }

        // 3. SQLite Scheduled Promotions (non-blocking)
        try {
            schedulerService.startScheduler();
            console.log('✅ SQLite Scheduler inicializado');
        } catch (err) {
            console.error('⚠️  SQLite Scheduler não inicializado, continuando...', err.message);
        }

        // 4. Mongoose Campaign Scheduler (non-blocking) - Desativado para remover dependências do Mongoose
        /*
        try {
            promotionScheduler.init();
            console.log('✅ Mongoose Campaign Scheduler inicializado');
        } catch (err) {
            console.error('⚠️  Mongoose Scheduler não inicializado, continuando...', err.message);
        }
        */
        
    } catch (error) {
        console.error('✕ Erro na inicialização geral dos serviços:', error);
    }

    // Always start the server, regardless of the initialization outcomes above
    app.listen(PORT, () => {
        console.log(`\n🪑  Galpão do Cândido rodando em: http://localhost:${PORT}`);
        console.log(`🔧  Painel Admin: http://localhost:${PORT}/admin`);
        console.log(`📋  Admin: ${process.env.ADMIN_USER} / ${process.env.ADMIN_PASS}\n`);
    });
}

startServer();
