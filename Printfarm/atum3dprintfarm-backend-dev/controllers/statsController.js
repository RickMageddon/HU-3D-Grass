const Stats = require("../models/statsModel");

exports.getMonthlyStats = (req, res) => {
  try {
    const data = Stats.getMonthlyStats();

    // frontend wil "May", "Jun", etc
    const formatted = data.map(row => {
      const [year, month] = row.month.split("-");
      const date = new Date(year, month - 1);

      return {
        month: date.toLocaleString("en-US", { month: "short" }),
        jobs: row.jobs,
        volume: row.volume ?? 0
      };
    });

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: "Failed to load stats" });
  }
};
