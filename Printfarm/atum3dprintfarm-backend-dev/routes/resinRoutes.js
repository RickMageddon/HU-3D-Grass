const express = require("express");
const router = express.Router();
const resinService = require("../services/resinService"); // new multi-printer service

// Returns all printers' latest resin volumes
router.get("/volumes", (req, res) => {
  const volumes = resinService.getAllResinVolumes();

  if (!volumes || volumes.length === 0) {
    return res.status(503).json({
      error: "Resin volumes not available yet",
    });
  }

  res.json(volumes);
});

module.exports = router;
