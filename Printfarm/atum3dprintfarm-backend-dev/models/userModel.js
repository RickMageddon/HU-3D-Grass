const db = require("./db");
const bcrypt = require("bcryptjs");

module.exports = {
  create: (name, email, passwordHash, role = "user") => {
    const stmt = db.prepare(`
      INSERT INTO users (name, email, passwordHash, role, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      name,
      email,
      passwordHash,
      role,
      new Date().toISOString()
    );

    return db.prepare("SELECT id, name, email, role, createdAt FROM users WHERE id = ?").get(result.lastInsertRowid);
  },

  findByEmail: (email) => {
    return db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  },

  findById: (id) => {
    return db.prepare("SELECT id, name, email, role FROM users WHERE id = ?").get(id);
  },

  // --- New: Update user ---
  update: (id, { name, email, role }) => {
    const stmt = db.prepare(`
      UPDATE users SET name = ?, email = ?, role = ?
      WHERE id = ?
    `);
    stmt.run(name, email, role, id);
    return db.prepare("SELECT id, name, email, role, createdAt FROM users WHERE id = ?").get(id);
  },

  // --- New: Delete user ---
  delete: (id) => {
    return db.prepare("DELETE FROM users WHERE id = ?").run(id);
  },

  // --- New: Get all users ---
  getAll: () => {
    return db.prepare("SELECT id, name, email, role, createdAt FROM users").all();
  }
,

  ensureAdmin: (name, email, password) => {
    if (!name || !email || !password) {
      throw new Error("Admin name, email and password are required");
    }
    try {
      const admin = db.prepare("SELECT * FROM users WHERE role = 'admin' LIMIT 1").get();
      if (admin) return admin;

      const passwordHash = bcrypt.hashSync(password, 10);
      const created = module.exports.create(name, email, passwordHash, "admin");
      console.log(`Initial admin created: ${email}`);
      return created;
    } catch (e) {
      console.error("Failed to ensure admin user:", e.message || e);
      return null;
    }
  }
};
