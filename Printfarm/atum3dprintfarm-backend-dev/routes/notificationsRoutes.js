const express = require("express");
const router = express.Router();
const controller = require("../controllers/notificationsController");

router.get("/", controller.getNotifications);
router.post("/", controller.addNotification);
router.patch("/:id/read", controller.markRead);
router.delete("/", controller.clearNotifications);

module.exports = router;
