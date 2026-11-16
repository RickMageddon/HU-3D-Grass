const db = require("./db");

// Get all notifications
exports.getAll = () => {
  const stmt = db.prepare("SELECT * FROM notifications ORDER BY timestamp DESC");
  const rows = stmt.all();
  return rows.map((r) => ({
    ...r,
    read: !!r.read,
  }));
};

// Create notification
exports.create = (data) => {
  const timestamp = data.timestamp || new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO notifications (timestamp, title, message, read)
    VALUES (?, ?, ?, ?)
  `);

  const result = stmt.run(
    timestamp,
    data.title,
    data.message,
    data.read ? 1 : 0
  );

  return {
    id: result.lastInsertRowid,
    timestamp,
    title: data.title,
    message: data.message,
    read: !!data.read,
  };
};

// Clear notifications
exports.clear = () => {
  const stmt = db.prepare("DELETE FROM notifications");
  stmt.run();
  return true;
};

// Mark a notification as read
exports.markRead = (id) => {
  const stmt = db.prepare("UPDATE notifications SET read = 1 WHERE id = ?");
  stmt.run(id);
  return true;
};
