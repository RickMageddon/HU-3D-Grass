const PrintJob = require("../models/printModel");

exports.getAllJobs = (req, res) => {
  res.json(PrintJob.getAll());
};

exports.getJobById = (req, res) => {
  const job = PrintJob.getById(req.params.id);
  if (!job) return res.status(404).json({ message: "Not found" });
  res.json(job);
};

exports.getJobsByStatus = (req, res) => {
  res.json(PrintJob.getByStatus(req.params.status));
};

exports.createJob = (req, res) => {
  const saved = PrintJob.add(req.body);
  res.status(201).json(saved);
};

exports.updateJob = (req, res) => {
  const updated = PrintJob.update(req.params.id, req.body);
  res.json(updated);
};

exports.deleteJob = (req, res) => {
  const ok = PrintJob.remove(req.params.id);
  if (!ok) return res.status(404).json({ message: "Not found" });
  res.json({ message: "Print job deleted" });
};
