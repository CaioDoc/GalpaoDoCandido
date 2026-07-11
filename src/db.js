const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'galpao.db');
let db;

function getDb() {
    if (!db) {
        db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL');
    }
    return db;
}

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
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

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

    // Seed demo products if empty
    const count = database.prepare('SELECT COUNT(*) as cnt FROM products').get();
    if (count.cnt === 0) {
        seedDemoProducts(database);
    }

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

module.exports = { getDb, initDb };
