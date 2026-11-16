const express = require("express");
const router = express.Router();
const controller = require("../controllers/statsController");

router.get("/monthly", controller.getMonthlyStats);

module.exports = router;
