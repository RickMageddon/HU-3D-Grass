const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Database = require("better-sqlite3");

test("existing printer databases gain sensor and encrypted module credential columns", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "atum3d-migration-test-"));
  const databasePath = path.join(directory, "existing.sqlite");
  const existing = new Database(databasePath);
  existing.exec(`
    CREATE TABLE printers (
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
      raspberryPiIp TEXT
    );
  `);
  existing.close();

  process.env.DATABASE_PATH = databasePath;
  const db = require("../models/db");
  const columns = db.prepare("PRAGMA table_info(printers)").all().map((column) => column.name);
  assert.ok(columns.includes("enabledSensors"));
  assert.ok(columns.includes("smartModuleApiKeyEncrypted"));
  db.close();
  fs.rmSync(directory, { recursive: true, force: true });
});
