const db = require("../models/db");

const jobs = [
  {
    status: "completed",
    volume: 0.45,
    completedAt: "2025-05-10 14:22:00"
  },
  {
    status: "completed",
    volume: 0.80,
    completedAt: "2025-05-22 09:10:00"
  },
  {
    status: "completed",
    volume: 1.20,
    completedAt: "2025-06-03 16:40:00"
  },
  {
    status: "completed",
    volume: 0.60,
    completedAt: "2025-06-18 11:05:00"
  }
];

const stmt = db.prepare(`
  INSERT INTO print_jobs (fileName, printerName, status, volume, completedAt)
  VALUES (?, ?, ?, ?, ?)
`);

for (const job of jobs) {
  stmt.run(
    "test.stl",
    "Printer A",
    job.status,
    job.volume,
    job.completedAt
  );
}

console.log("Seeded print jobs");
