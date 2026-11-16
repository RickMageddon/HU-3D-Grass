// models/printerModel.js
const db = require("./db"); // ✅ points to db.js, which opens database.sqlite

const DEFAULT_ENABLED_SENSORS = ["bme280", "pir", "mcp3008"];
const UPDATABLE_FIELDS = new Set([
  "name",
  "model",
  "status",
  "location",
  "serialNumber",
  "addedDate",
  "lastMaintenance",
  "ipAddress",
  "sensorIp",
  "resinType",
  "resinLevel",
  "raspberryPiIp",
  "enabledSensors",
  "currentLayer",
  "totalLayers",
]);

function normalizeStoredSensors(value) {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (
      !Array.isArray(parsed) ||
      parsed.some((sensor) => !DEFAULT_ENABLED_SENSORS.includes(sensor)) ||
      new Set(parsed).size !== parsed.length
    ) {
      return [...DEFAULT_ENABLED_SENSORS];
    }

    return DEFAULT_ENABLED_SENSORS.filter((sensor) => parsed.includes(sensor));
  } catch {
    return [...DEFAULT_ENABLED_SENSORS];
  }
}

function deserializePrinter(printer) {
  if (!printer) return printer;
  const { smartModuleApiKeyEncrypted, ...publicPrinter } = printer;
  return {
    ...publicPrinter,
    enabledSensors: normalizeStoredSensors(printer.enabledSensors),
    smartModuleAuthConfigured: Boolean(smartModuleApiKeyEncrypted),
  };
}

module.exports = {
  getAll: () => {
    return db.prepare("SELECT * FROM printers").all().map(deserializePrinter);
  },

  getById: (id) => {
    return deserializePrinter(
      db.prepare("SELECT * FROM printers WHERE id = ?").get(id)
    );
  },

  getInternalById: (id) => {
    const printer = db.prepare("SELECT * FROM printers WHERE id = ?").get(id);
    if (!printer) return undefined;
    return {
      ...printer,
      enabledSensors: normalizeStoredSensors(printer.enabledSensors),
    };
  },

  add: (data) => {
    const stmt = db.prepare(`
      INSERT INTO printers
      (name, model, status, location, serialNumber, addedDate, lastMaintenance, ipAddress, sensorIp, resinType, resinLevel, raspberryPiIp, enabledSensors)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      data.name,
      data.model,
      data.status,
      data.location,
      data.serialNumber,
      data.addedDate,
      data.lastMaintenance,
      data.ipAddress,
      data.sensorIp,
      data.resinType,
      data.resinLevel,
      data.raspberryPiIp ?? null,
      JSON.stringify(data.enabledSensors ?? DEFAULT_ENABLED_SENSORS)
    );

    return deserializePrinter(
      db.prepare("SELECT * FROM printers WHERE id = ?").get(result.lastInsertRowid)
    );
  },

  update: (id, data) => {
    const storedData = Object.fromEntries(
      Object.entries(data).filter(([key]) => UPDATABLE_FIELDS.has(key))
    );
    if (Object.prototype.hasOwnProperty.call(storedData, "enabledSensors")) {
      storedData.enabledSensors = JSON.stringify(storedData.enabledSensors);
    }

    if (Object.keys(storedData).length === 0) return module.exports.getById(id);

    const fields = Object.keys(storedData)
      .map(key => `${key} = @${key}`)
      .join(", ");

    const stmt = db.prepare(`UPDATE printers SET ${fields} WHERE id = @id`);
    stmt.run({ ...storedData, id });

    return deserializePrinter(
      db.prepare("SELECT * FROM printers WHERE id = ?").get(id)
    );
  },

  updateSmartModuleCredential: (id, encryptedKey) => {
    const result = db
      .prepare("UPDATE printers SET smartModuleApiKeyEncrypted = ? WHERE id = ?")
      .run(encryptedKey, id);
    return result.changes > 0;
  },

  remove: (id) => {
    const stmt = db.prepare("DELETE FROM printers WHERE id = ?");
    const result = stmt.run(id);
    return result.changes > 0;
  }
};
