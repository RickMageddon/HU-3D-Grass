const Logs = require("../models/logsModel");

exports.getLogs = async (req, res) => {
  try {
    const logs = await Logs.getAll();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: "Could not fetch logs" });
  }
};

exports.addLog = async (req, res) => {
  try {
    const newLog = await Logs.create(req.body);
    res.status(201).json(newLog);
  } catch (err) {
    res.status(500).json({ error: "Failed to insert log" });
  }
};

exports.clearLogs = async (req, res) => {
  try {
    await Logs.clear();
    res.json({ message: "All logs cleared" });
  } catch (err) {
    res.status(500).json({ error: "Failed to clear logs" });
  }
};
