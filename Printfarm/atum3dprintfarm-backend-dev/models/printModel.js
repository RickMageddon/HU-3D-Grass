// models/printJobModel.js
const db = require("./db"); // ✅ points to db.js, which opens database.sqlite

module.exports = {
  getAll: () => {
    return db.prepare("SELECT * FROM print_jobs").all();
  },

  getById: (id) => {
    return db.prepare("SELECT * FROM print_jobs WHERE id = ?").get(id);
  },

  getByStatus: (status) => {
    return db.prepare("SELECT * FROM print_jobs WHERE status = ?").all(status);
  },

  add: (data) => {
    const stmt = db.prepare(`
      INSERT INTO print_jobs 
      (fileName, printerName, status, progress, timeRemaining, timeElapsed, startedAt, completedAt, queuePosition, estimatedTime, fileSize, material)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      data.fileName,
      data.printerName,
      data.status,
      data.progress ?? null,
      data.timeRemaining ?? null,
      data.timeElapsed ?? null,
      data.startedAt ?? null,
      data.completedAt ?? null,
      data.queuePosition ?? null,
      data.estimatedTime ?? null,
      data.fileSize,
      data.material
    );

    return db.prepare("SELECT * FROM print_jobs WHERE id = ?").get(result.lastInsertRowid);
  },

  update: (id, data) => {
    const fields = Object.keys(data)
      .map(key => `${key} = @${key}`)
      .join(", ");

    const stmt = db.prepare(`UPDATE print_jobs SET ${fields} WHERE id = @id`);
    stmt.run({ ...data, id });

    return db.prepare("SELECT * FROM print_jobs WHERE id = ?").get(id);
  },

  remove: (id) => {
    const stmt = db.prepare("DELETE FROM print_jobs WHERE id = ?");
    const result = stmt.run(id);
    return result.changes > 0;
  }
};
