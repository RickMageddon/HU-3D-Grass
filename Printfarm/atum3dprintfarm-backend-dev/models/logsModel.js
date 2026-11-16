const db = require("./db");
const Notifications = require("./notificationsModel");

// Get all logs
exports.getAll = () => {
  const stmt = db.prepare("SELECT * FROM logs ORDER BY timestamp DESC");
  return stmt.all(); // synchronous
};

// Create log
exports.create = (data) => {
  const timestamp = data.timestamp || new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO logs (timestamp, level, source, message)
    VALUES (?, ?, ?, ?)
  `);

  const result = stmt.run(
    timestamp,
    data.level,
    data.source,
    data.message
  );

  // Only create notifications for low-resin events (don’t persist every warn/error)
  try {
    const notifyThreshold = Number(process.env.NOTIFY_RESIN_PERCENT || process.env.JOB_MIN_RESIN_PERCENT || 10);
    const msg = (data.message || '').toString();
    // match patterns like: "resin measurement: 8.0187 pF (9%)"
    const m = msg.match(/resin measurement:.*\((\d+)%\)/i);
    if (m) {
      const percent = Number(m[1]);
      if (!Number.isNaN(percent) && percent <= notifyThreshold) {
        const title = `Low resin${data.source ? ' - ' + data.source : ''}`;
        // dedupe: if an unread notification for this title exists, or a recent one
        // within NOTIFY_DEDUP_MINUTES, skip creating another
        try {
          const dedupMinutes = Number(process.env.NOTIFY_DEDUP_MINUTES || 60);
          const row = db.prepare('SELECT id, timestamp, read FROM notifications WHERE title = ? ORDER BY timestamp DESC LIMIT 1').get(title);
          let createNotif = true;
          if (row) {
            if (Number(row.read) === 0) {
              createNotif = false; // already unread notification
            } else if (row.timestamp) {
              const lastTs = Date.parse(row.timestamp);
              if (!Number.isNaN(lastTs)) {
                const minutesAgo = (Date.now() - lastTs) / 60000;
                if (minutesAgo < dedupMinutes) createNotif = false;
              }
            }
          }
          if (createNotif) {
            Notifications.create({ timestamp, title, message: msg, read: 0 });
          }
        } catch (e) {
          try { console.error('Failed to dedupe/create notification:', e && e.message ? e.message : e); } catch (e2) {}
        }
      }
    }
  } catch (e) {
    try { console.error('Failed to create notification from log:', e && e.message ? e.message : e); } catch (e2) {}
  }

  return {
    id: result.lastInsertRowid,
    timestamp,
    ...data,
  };
};

// Clear logs
exports.clear = () => {
  const stmt = db.prepare("DELETE FROM logs");
  stmt.run();
  return true;
};
