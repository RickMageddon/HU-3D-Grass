const express = require("express");
const router = express.Router();
const controller = require("../controllers/printController");

const multer = require("multer");
const upload = multer({ dest: "uploads/tmp/" });

const uploadController = require("../controllers/uploadController");

router.post("/", upload.single("file"), uploadController.uploadFile);

// CRUD ROUTES
router.get("/", controller.getAllJobs);
router.get("/:id", controller.getJobById);
router.get("/status/:status", controller.getJobsByStatus);

router.put("/:id", controller.updateJob);
router.delete("/:id", controller.deleteJob);

module.exports = router;
