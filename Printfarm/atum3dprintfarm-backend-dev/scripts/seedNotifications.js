const db = require("../models/db");

function seed() {
  const stmt = db.prepare(`INSERT INTO notifications (timestamp, title, message, read) VALUES (?, ?, ?, ?)`);

  stmt.run(new Date().toISOString(), "Welcome", "Notifications are enabled for your account.", 0);
  stmt.run(new Date().toISOString(), "Printer Offline", "Printer 'Form 3' is offline.", 0);

  console.log("Seeded notifications");
}

seed();
