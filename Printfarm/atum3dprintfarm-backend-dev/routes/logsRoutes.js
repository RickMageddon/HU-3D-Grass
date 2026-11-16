const express = require("express");
const router = express.Router();
const controller = require("../controllers/logsController");

router.get("/", controller.getLogs);
router.post("/", controller.addLog);
router.delete("/", controller.clearLogs);

module.exports = router;
