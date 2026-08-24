const fs = require('fs');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

// Determine persistent data directory
const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || process.env.DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
    try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}
}

const DB_PATH = path.join(DATA_DIR, 'galpao.db');
const BACKUP_JSON_PATH = path.join(DATA_DIR, 'backup_db.json');
const ROOT_BACKUP_JSON = path.join(__dirname, '..', 'data', 'backup_db.json');

let db;

function getDb() {
    if (!db) {
        db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL');
    }
    return db;
}

function exportDatabaseJSON() {
    const database = getDb();
    const products = database.prepare('SELECT * FROM products ORDER BY display_order ASC, created_at DESC').all().map(p => ({
        ...p,
        images: JSON.parse(p.images || '[]')
    }));
    const categories = database.prepare('SELECT * FROM categories ORDER BY name ASC').all();
    const settings = database.prepare('SELECT * FROM settings').all();
    const contacts = database.prepare('SELECT * FROM contacts ORDER BY created_at DESC').all();

    return {
        version: 1,
        exported_at: new Date().toISOString(),
        products,
        categories,
        settings,
        contacts
    };
}

function triggerAutoBackup() {
    try {
        const data = exportDatabaseJSON();
        const jsonStr = JSON.stringify(data, null, 2);
        fs.writeFileSync(BACKUP_JSON_PATH, jsonStr, 'utf8');
        if (BACKUP_JSON_PATH !== ROOT_BACKUP_JSON) {
            try {
                const rootDir = path.dirname(ROOT_BACKUP_JSON);
                if (!fs.existsSync(rootDir)) fs.mkdirSync(rootDir, { recursive: true });
                fs.writeFileSync(ROOT_BACKUP_JSON, jsonStr, 'utf8');
            } catch (e) {}
        }
    } catch (err) {
        console.error('⚠️ Erro no auto-backup:', err);
    }
}

function restoreFromJSON(backupData) {
    if (!backupData || (!Array.isArray(backupData.products) && !Array.isArray(backupData.categories))) {
        throw new Error('Formato de arquivo de backup inválido.');
    }

    const database = getDb();

    const restoreTx = database.transaction(() => {
        // Restore products if array present
        if (Array.isArray(backupData.products) && backupData.products.length > 0) {
            database.exec('DELETE FROM products');
            const insertProduct = database.prepare(`
                INSERT INTO products (id, title, subtitle, description, price, category, images, featured, display_order, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            backupData.products.forEach((p, idx) => {
                insertProduct.run(
                    p.id,
                    p.title,
                    p.subtitle || '',
                    p.description || '',
                    parseFloat(p.price) || 0,
                    p.category || 'Outros',
                    JSON.stringify(Array.isArray(p.images) ? p.images : []),
                    p.featured ? 1 : 0,
                    p.display_order !== undefined ? p.display_order : idx,
                    p.created_at || new Date().toISOString()
                );
            });
        }

        // Restore categories if present
        if (Array.isArray(backupData.categories) && backupData.categories.length > 0) {
            database.exec('DELETE FROM categories');
            const insertCat = database.prepare('INSERT OR IGNORE INTO categories (id, name, created_at) VALUES (?, ?, ?)');
            backupData.categories.forEach(c => {
                insertCat.run(c.id || null, c.name, c.created_at || new Date().toISOString());
            });
        }

        // Restore settings if present
        if (Array.isArray(backupData.settings) && backupData.settings.length > 0) {
            database.exec('DELETE FROM settings');
            const insertSetting = database.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
            backupData.settings.forEach(s => {
                insertSetting.run(s.key, typeof s.value === 'string' ? s.value : JSON.stringify(s.value));
            });
        }
    });

    restoreTx();
    triggerAutoBackup();
    return true;
}

function checkAndAutoRestore() {
    const database = getDb();
    const prodCount = database.prepare('SELECT COUNT(*) as cnt FROM products').get();

    // If products table is empty, check if backup_db.json exists
    if (prodCount.cnt === 0) {
        let backupFile = fs.existsSync(BACKUP_JSON_PATH) ? BACKUP_JSON_PATH : (fs.existsSync(ROOT_BACKUP_JSON) ? ROOT_BACKUP_JSON : null);
        if (backupFile) {
            try {
                const raw = fs.readFileSync(backupFile, 'utf8');
                const parsed = JSON.parse(raw);
                restoreFromJSON(parsed);
                console.log(`🛡️  AUTO-RESTAURAÇÃO CONCLUÍDA: ${parsed.products ? parsed.products.length : 0} produtos restaurados do backup!`);
            } catch (err) {
                console.error('⚠️ Erro na auto-restauração:', err);
            }
        }
    }
}

module.exports = { getDb, initDb, exportDatabaseJSON, restoreFromJSON, triggerAutoBackup };

function initDb() {
    const database = getDb();

    // Products table
    database.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      subtitle TEXT,
      description TEXT,
      price REAL NOT NULL DEFAULT 0,
      category TEXT NOT NULL DEFAULT 'Outros',
      images TEXT NOT NULL DEFAULT '[]',
      featured INTEGER NOT NULL DEFAULT 0,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

    try {
        database.exec(`ALTER TABLE products ADD COLUMN display_order INTEGER NOT NULL DEFAULT 0;`);
    } catch {
        // Column already exists
    }

    // Admin table
    database.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    );
  `);

    // Categories table
    database.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

    // Seed default categories if empty
    const catCount = database.prepare('SELECT COUNT(*) as cnt FROM categories').get();
    if (catCount.cnt === 0) {
        const defaultCategories = ['Poltronas', 'Cadeiras', 'Mesas', 'Sofás', 'Armários', 'Iluminação', 'Decoração', 'Diversos', 'Outros'];
        const insertCat = database.prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)');
        for (const name of defaultCategories) {
            insertCat.run(name);
        }
        console.log('✅  Categorias padrão inseridas');
    }

    // Settings table
    database.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

    // Scheduled Promotions table
    database.exec(`
    CREATE TABLE IF NOT EXISTS scheduled_promotions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id TEXT NOT NULL,
      target TEXT NOT NULL,
      is_group INTEGER NOT NULL,
      message TEXT NOT NULL,
      image_path TEXT,
      scheduled_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

    // Contacts table
    database.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      image_url TEXT,
      status TEXT NOT NULL DEFAULT 'unread',
      reply_message TEXT,
      replied_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

    // Seed default banner url
    const bannerCount = database.prepare("SELECT COUNT(*) as cnt FROM settings WHERE key = 'banner_url'").get();
    if (bannerCount.cnt === 0) {
        const defaultBanner = "https://lh3.googleusercontent.com/aida-public/AB6AXuAvAAN1NYELrbPLEreymiDA3OOKNsrELf3jHiCj2XHPqEBke9mUS5zbtQdR55Sm0V7jLLsFvZigJVFmzp2zeStmiSOtW61yeJ9hZ8_Pb-F-JxXHteXRDU3BdUeY5Wxk0TBVlE5fKWtFJZddxRbZoQPySNwe6yBA9bEAeripeIMdxoPKn3MuKec65M58Uh-qproteVwhUBjmnGk2TQsklIc4k7IW6hcQyxwsAIRiC0fZw794BKH2NXoyiXTl9FKHcJkQWXURgJGWWsHM";
        database.prepare("INSERT INTO settings (key, value) VALUES ('banner_url', ?)").run(defaultBanner);
        console.log('✅  Configurações padrão inseridas');
    }

    // Seed admin if not exists
    const adminUser = process.env.ADMIN_USER || 'admin';
    const adminPass = process.env.ADMIN_PASS || 'galpao2024';
    const existingAdmin = database.prepare('SELECT id FROM admin_users WHERE username = ?').get(adminUser);

    if (!existingAdmin) {
        const hash = bcrypt.hashSync(adminPass, 10);
        database.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)').run(adminUser, hash);
        console.log(`✅  Admin criado: ${adminUser}`);
    } else {
        const hash = bcrypt.hashSync(adminPass, 10);
        database.prepare('UPDATE admin_users SET password_hash = ? WHERE username = ?').run(hash, adminUser);
        console.log(`✅  Senha do Admin sincronizada: ${adminUser}`);
    }

    // Check auto-restore from backup FIRST before seeding demo products
    let restoredFromBackup = false;
    let backupFile = fs.existsSync(BACKUP_JSON_PATH) ? BACKUP_JSON_PATH : (fs.existsSync(ROOT_BACKUP_JSON) ? ROOT_BACKUP_JSON : null);
    if (backupFile) {
        try {
            const raw = fs.readFileSync(backupFile, 'utf8');
            const parsed = JSON.parse(raw);
            if (parsed && Array.isArray(parsed.products) && parsed.products.length > 0) {
                const currentCount = database.prepare('SELECT COUNT(*) as cnt FROM products').get();
                if (currentCount.cnt === 0) {
                    restoreFromJSON(parsed);
                    restoredFromBackup = true;
                    console.log(`🛡️  AUTO-RESTAURAÇÃO CONCLUÍDA: ${parsed.products.length} produtos restaurados do backup!`);
                }
            }
        } catch (err) {
            console.error('⚠️  Erro na auto-restauração:', err);
        }
    }

    // Seed demo products ONLY if empty AND not restored from backup
    const count = database.prepare('SELECT COUNT(*) as cnt FROM products').get();
    if (count.cnt === 0 && !restoredFromBackup) {
        seedDemoProducts(database);
    }

    triggerAutoBackup();
    console.log('✅  Banco de dados inicializado');
}

function seedDemoProducts(database) {
    const { v4: uuidv4 } = require('uuid');

    const products = [
        {
            id: uuidv4(),
            title: 'Poltrona Eames Original',
            subtitle: 'Design Clássico Americano',
            description: 'Icônica poltrona Eames em couro legítimo caramelo com base de alumínio polido. Peça original dos anos 70, restaurada por nossos especialistas. Um exemplar raro para colecionadores.',
            price: 8500.00,
            category: 'Poltronas',
            images: JSON.stringify(['/uploads/demo-eames.jpg']),
            featured: 1
        },
        {
            id: uuidv4(),
            title: 'Mesa de Jantar Art Déco',
            subtitle: 'Mogno Maciço com Detalhes em Bronze',
            description: 'Mesa de jantar em mogno maciço com incrustações em bronze dourado. Estilo Art Déco dos anos 1930, peça única em excelente estado de conservação. Acompanha 6 cadeiras originais.',
            price: 22000.00,
            category: 'Mesas',
            images: JSON.stringify(['/uploads/demo-mesa.jpg']),
            featured: 1
        },
        {
            id: uuidv4(),
            title: 'Cadeira Barcelona',
            subtitle: 'Réplica Premium Mies van der Rohe',
            description: 'Réplica premium da lendária cadeira Barcelona de Mies van der Rohe. Estrutura em aço inox polido, estofamento em couro genuíno branco. Ícone do modernismo.',
            price: 4200.00,
            category: 'Cadeiras',
            images: JSON.stringify(['/uploads/demo-barcelona.jpg']),
            featured: 1
        },
        {
            id: uuidv4(),
            title: 'Aparador Vintage Escandinavo',
            subtitle: 'Teca Maciça — Anos 1960',
            description: 'Aparador escandinavo em teca maciça com pés palito originais. Três gavetas e duas portas com fechamento suave. Peça marcante de meados do século XX.',
            price: 6800.00,
            category: 'Armários',
            images: JSON.stringify(['/uploads/demo-aparador.jpg']),
            featured: 1
        },
        {
            id: uuidv4(),
            title: 'Luminária de Chão Arco',
            subtitle: 'Alumínio e Mármore — Design Italiano',
            description: 'Luminária de chão em arco com base de mármore branco e haste em alumínio cromado. Design italiano dos anos 70, funcional e decorativa. Caçamba em alumínio fosco.',
            price: 3100.00,
            category: 'Iluminação',
            images: JSON.stringify(['/uploads/demo-luminaria.jpg']),
            featured: 0
        },
        {
            id: uuidv4(),
            title: 'Sofá Retrô 3 Lugares',
            subtitle: 'Veludo Verde Floresta',
            description: 'Sofá estilo retrô de 3 lugares, reestofado em veludo verde floresta de alta qualidade. Pés em madeira torneada encerada. Estrutura robusta revisada e reforçada.',
            price: 9500.00,
            category: 'Sofás',
            images: JSON.stringify(['/uploads/demo-sofa.jpg']),
            featured: 0
        }
    ];

    const insert = database.prepare(
        'INSERT INTO products (id, title, subtitle, description, price, category, images, featured) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );

    for (const p of products) {
        insert.run(p.id, p.title, p.subtitle, p.description, p.price, p.category, p.images, p.featured);
    }

    console.log('✅  Produtos demo inseridos');
}

module.exports = { getDb, initDb, exportDatabaseJSON, restoreFromJSON, triggerAutoBackup };
