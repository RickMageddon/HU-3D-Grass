// models/db.js
const Database = require("better-sqlite3");

// Create or open database file
const db = new Database(process.env.DATABASE_PATH || "database.sqlite", {
  verbose: process.env.SQLITE_VERBOSE === "true" ? console.log : undefined,
});

// Initialize tables if not exists
db.exec(`
CREATE TABLE IF NOT EXISTS printers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  model TEXT,
  status TEXT,
  location TEXT,
  serialNumber TEXT,
  addedDate TEXT,
  lastMaintenance TEXT,
  ipAddress TEXT,
  sensorIp TEXT,
  resinType TEXT,
  resinLevel INTEGER,
  raspberryPiIp TEXT,
  enabledSensors TEXT NOT NULL DEFAULT '["bme280","pir","mcp3008"]',
  smartModuleApiKeyEncrypted TEXT
);

CREATE TABLE IF NOT EXISTS print_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fileName TEXT NOT NULL,
  printerName TEXT NOT NULL,
  status TEXT NOT NULL,
  progress INTEGER,
  timeRemaining TEXT,
  timeElapsed TEXT,
  startedAt TEXT,
  completedAt TEXT,
  queuePosition INTEGER,
  estimatedTime TEXT,
  fileSize TEXT,
  material TEXT
);

 CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      level TEXT NOT NULL,
      source TEXT NOT NULL,
      message TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    passwordHash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    createdAt TEXT NOT NULL
  );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      read INTEGER NOT NULL DEFAULT 0
    );
`);

// Ensure print_jobs has columns for layers (add if missing)
try {
  const info = db.prepare("PRAGMA table_info(print_jobs)").all();
  const cols = info.map(r => r.name);
  if (!cols.includes('currentLayer')) {
    db.prepare("ALTER TABLE print_jobs ADD COLUMN currentLayer INTEGER").run();
    console.log('Added column print_jobs.currentLayer');
  }
  if (!cols.includes('totalLayers')) {
    db.prepare("ALTER TABLE print_jobs ADD COLUMN totalLayers INTEGER").run();
    console.log('Added column print_jobs.totalLayers');
  }
} catch (e) {
  console.error('Failed to ensure layer columns on print_jobs:', e.message || e);
}

// Ensure printers has columns for layers (add if missing)
try {
  const info2 = db.prepare("PRAGMA table_info(printers)").all();
  const cols2 = info2.map(r => r.name);
  if (!cols2.includes('currentLayer')) {
    db.prepare("ALTER TABLE printers ADD COLUMN currentLayer INTEGER").run();
    console.log('Added column printers.currentLayer');
  }
  if (!cols2.includes('totalLayers')) {
    db.prepare("ALTER TABLE printers ADD COLUMN totalLayers INTEGER").run();
    console.log('Added column printers.totalLayers');
  }
  if (!cols2.includes('raspberryPiIp')) {
    db.prepare("ALTER TABLE printers ADD COLUMN raspberryPiIp TEXT").run();
    console.log('Added column printers.raspberryPiIp');
  }
  if (!cols2.includes('enabledSensors')) {
    db.prepare(`
      ALTER TABLE printers
      ADD COLUMN enabledSensors TEXT NOT NULL
      DEFAULT '["bme280","pir","mcp3008"]'
    `).run();
    console.log('Added column printers.enabledSensors');
  }
  if (!cols2.includes('smartModuleApiKeyEncrypted')) {
    db.prepare("ALTER TABLE printers ADD COLUMN smartModuleApiKeyEncrypted TEXT").run();
    console.log('Added column printers.smartModuleApiKeyEncrypted');
  }
} catch (e) {
  console.error('Failed to ensure columns on printers:', e.message || e);
}

module.exports = db;
