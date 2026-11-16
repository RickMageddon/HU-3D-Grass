require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const WebSocket = require("ws");
const logger = require("./middleware/logger");
const auth = require("./middleware/auth");
const startSerialReader = require("./models/serialReader");
const { connectResinSocket } = require("./services/resinService.js");
const resinRoutes = require("./routes/resinRoutes");


//Route files
const printerRoutes = require("./routes/printerRoutes.js");
const printJobRoutes = require("./routes/printRoutes.js");
const logRoutes = require("./routes/logsRoutes.js");
const authRoutes = require("./routes/authRoutes");
const statsRoutes = require("./routes/statsRoutes.js");
const notificationsRoutes = require("./routes/notificationsRoutes");
const smartModuleController = require("./controllers/smartModuleController");
const { getAllowedCidrs } = require("./services/smartModuleClient");
const { getEncryptionKey, readRequiredSecret } = require("./services/smartModuleSecurity");

// services
const printerService = require("./services/printerService");
const queueWorker = require("./services/queueWorker");
const userModel = require("./models/userModel");

const app = express();
const server = http.createServer(app);

// Middleware
const dashboardOrigin = process.env.DASHBOARD_ORIGIN?.trim();
if (!dashboardOrigin) throw new Error("DASHBOARD_ORIGIN is required");
readRequiredSecret("JWT_SECRET");
readRequiredSecret("CAMERA_STREAM_TICKET_SECRET");
getEncryptionKey();
getAllowedCidrs();

app.use(cors({ origin: dashboardOrigin }));
app.use(express.json());
app.use(logger);

// This route authenticates with its own short-lived, scope-limited ticket.
app.get("/smart-module-stream/:ticket", smartModuleController.streamCamera);

// REST API routes
app.use("/print-jobs", auth, printJobRoutes);
app.use("/printers", auth, printerRoutes);
app.use("/logs", auth, logRoutes);
app.use("/auth", authRoutes);
app.use("/stats", statsRoutes);
app.use("/resin", resinRoutes);
app.use("/notifications", auth, notificationsRoutes);

// Start server
const PORT = Number(process.env.PORT || 3000);
const adminName = process.env.DEFAULT_ADMIN_NAME?.trim();
const adminEmail = process.env.DEFAULT_ADMIN_EMAIL?.trim();
const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD;

if (adminEmail || adminPassword || adminName) {
    if (!adminName || !adminEmail || !adminPassword) {
        throw new Error("DEFAULT_ADMIN_NAME, DEFAULT_ADMIN_EMAIL and DEFAULT_ADMIN_PASSWORD must be set together");
    }
    userModel.ensureAdmin(adminName, adminEmail, adminPassword);
}

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    // register printer service routes (service auto-starts itself)
    try {
        printerService.attachRoutes(app);
    } catch (e) {
        console.error("Failed to attach printerService routes:", e.message || e);
    }
    try {
        queueWorker.start();
    } catch (e) {
        console.error("Failed to start queueWorker:", e.message || e);
    }
});
