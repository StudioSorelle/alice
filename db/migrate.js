const db = require('./index');

var PRODUCTS_SEED = ['Starter Kit', 'Date Night Box', 'Family Box', 'Party Box'];
var OCCASIONS_SEED = ["Date night", "Girls' night", 'Baby shower', 'Bachelorette party', 'Family gathering', 'Birthday party'];

async function migrate() {
  if (!db.isConfigured()) {
    console.log('DB not configured — skipping migration');
    return;
  }
  try {
    await db.query(`CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    )`);
    await db.query(`CREATE TABLE IF NOT EXISTS occasions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    )`);
    await db.query(`CREATE TABLE IF NOT EXISTS codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      first_used_at TEXT,
      expires_at TEXT
    )`);

    var prodCount = await db.query('SELECT COUNT(*) as c FROM products');
    if (Number(prodCount.rows[0].c) === 0) {
      for (var i = 0; i < PRODUCTS_SEED.length; i++) {
        await db.query('INSERT INTO products (name, sort_order) VALUES (?, ?)', [PRODUCTS_SEED[i], i]);
      }
    }

    var occCount = await db.query('SELECT COUNT(*) as c FROM occasions');
    if (Number(occCount.rows[0].c) === 0) {
      for (var j = 0; j < OCCASIONS_SEED.length; j++) {
        await db.query('INSERT INTO occasions (name, sort_order) VALUES (?, ?)', [OCCASIONS_SEED[j], j]);
      }
    }

    console.log('DB migration complete');
  } catch (err) {
    console.error('DB migration error:', err.message);
  }
}

module.exports = migrate;
