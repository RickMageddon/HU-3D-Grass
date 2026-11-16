// Migration: add `sensorIp` column to `printers` table if it doesn't exist
// Run: node scripts/add_sensor_ip_column.js

const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const dbPath = path.resolve(__dirname, "..", "database.sqlite");

function ensureSensorIpColumn() {
  try {
    if (!fs.existsSync(dbPath)) {
      console.error(`Database file not found: ${dbPath}`);
      process.exit(2);
    }

    const db = new Database(dbPath, { readonly: false });
    const cols = db.prepare("PRAGMA table_info(printers)").all();
    const has = cols.some((c) => c.name === "sensorIp");
    if (has) {
      console.log("Column `sensorIp` already exists — nothing to do.");
      db.close();
      return;
    }

    console.log("Adding `sensorIp` column to printers table...");
    db.prepare("ALTER TABLE printers ADD COLUMN sensorIp TEXT").run();
    console.log("Done: `sensorIp` column added.");
    db.close();
  } catch (err) {
    console.error("Migration failed:", err.message || err);
    process.exit(1);
  }
}

ensureSensorIpColumn();
