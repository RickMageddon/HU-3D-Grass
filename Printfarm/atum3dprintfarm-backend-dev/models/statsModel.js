const db = require("./db");

exports.getMonthlyStats = () => {
  const sql = `
    SELECT
      strftime('%Y-%m', completedAt) AS month,
      COUNT(*) AS jobs,
      ROUND(SUM(volume), 3) AS volume
    FROM print_jobs
    WHERE status = 'completed'
      AND completedAt IS NOT NULL
    GROUP BY month
    ORDER BY month ASC
  `;

  return db.prepare(sql).all();
};
