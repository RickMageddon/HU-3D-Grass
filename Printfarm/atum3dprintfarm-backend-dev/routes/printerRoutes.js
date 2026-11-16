// routes/printerRoutes.js
const express = require("express");
const router = express.Router();
const printerController = require("../controllers/printerController");
const smartModuleController = require("../controllers/smartModuleController");
const isAdmin = require("../middleware/isAdmin");

router.get("/", printerController.getPrinters);
router.post("/", isAdmin, printerController.addPrinter);
router.get("/:id/smart-module/status", smartModuleController.getStatus);
router.get("/:id/smart-module/camera/detections", smartModuleController.getDetections);
router.post("/:id/smart-module/camera/stream-ticket", smartModuleController.createStreamTicket);
router.post("/:id/smart-module/credentials/rotate", isAdmin, smartModuleController.rotateCredential);
router.put("/:id", isAdmin, printerController.updatePrinter);
router.delete("/:id", isAdmin, printerController.deletePrinter);

module.exports = router;
