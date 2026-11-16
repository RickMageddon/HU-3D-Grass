const jwt = require("jsonwebtoken");
const Printer = require("../models/printerModel");
const {
  encryptModuleKey,
  generateModuleKey,
  readRequiredSecret,
} = require("../services/smartModuleSecurity");
const {
  SmartModuleError,
  openCameraStream,
  requestJson,
  validateModuleAddress,
} = require("../services/smartModuleClient");

const STREAM_AUDIENCE = "atum3d-camera-stream";
const STREAM_ISSUER = "atum3d-backend";
const STREAM_LIFETIME_SECONDS = 60 * 60;

function sendError(res, error) {
  const status = error instanceof SmartModuleError ? error.status : 500;
  const code = error instanceof SmartModuleError ? error.code : "internal_error";
  if (status >= 500) console.error("Smart Module request failed:", code, error.message);
  return res.status(status).json({ error: code, message: error.message });
}

exports.rotateCredential = (req, res) => {
  const printer = Printer.getInternalById(req.params.id);
  if (!printer) return res.status(404).json({ error: "printer_not_found", message: "Printer not found" });

  try {
    const apiKey = generateModuleKey();
    Printer.updateSmartModuleCredential(printer.id, encryptModuleKey(apiKey));
    res.set("Cache-Control", "no-store");
    return res.json({ apiKey, configured: true });
  } catch (error) {
    return sendError(res, error);
  }
};

exports.getStatus = async (req, res) => {
  try {
    const result = await requestJson(
      Printer.getInternalById(req.params.id),
      "/sensor/api/status",
      "/api/status"
    );
    res.set("Cache-Control", "no-store");
    return res.json(result);
  } catch (error) {
    return sendError(res, error);
  }
};

exports.getDetections = async (req, res) => {
  try {
    const result = await requestJson(
      Printer.getInternalById(req.params.id),
      "/camera/detections",
      "/detections"
    );
    res.set("Cache-Control", "no-store");
    return res.json(result);
  } catch (error) {
    return sendError(res, error);
  }
};

exports.createStreamTicket = (req, res) => {
  const printer = Printer.getInternalById(req.params.id);
  if (!printer) return res.status(404).json({ error: "printer_not_found", message: "Printer not found" });
  if (!printer.smartModuleApiKeyEncrypted) {
    return res.status(409).json({ error: "module_not_configured", message: "Smart Module authentication is not configured" });
  }

  try {
    validateModuleAddress(printer.raspberryPiIp);
    const token = jwt.sign(
      {
        scope: "camera:stream",
        printerId: String(printer.id),
        userId: String(req.user.id),
      },
      readRequiredSecret("CAMERA_STREAM_TICKET_SECRET"),
      {
        audience: STREAM_AUDIENCE,
        issuer: STREAM_ISSUER,
        expiresIn: STREAM_LIFETIME_SECONDS,
      }
    );
    const decoded = jwt.decode(token);
    res.set("Cache-Control", "no-store");
    return res.json({
      streamUrl: `/smart-module-stream/${encodeURIComponent(token)}`,
      expiresAt: new Date(decoded.exp * 1000).toISOString(),
    });
  } catch (error) {
    return sendError(res, error);
  }
};

exports.streamCamera = async (req, res) => {
  let payload;
  try {
    payload = jwt.verify(
      req.params.ticket,
      readRequiredSecret("CAMERA_STREAM_TICKET_SECRET"),
      { audience: STREAM_AUDIENCE, issuer: STREAM_ISSUER }
    );
  } catch {
    return res.status(401).json({ error: "invalid_stream_ticket", message: "Stream ticket is invalid or expired" });
  }

  if (payload.scope !== "camera:stream" || !payload.printerId || !payload.exp) {
    return res.status(401).json({ error: "invalid_stream_ticket", message: "Stream ticket is invalid" });
  }

  try {
    const printer = Printer.getInternalById(payload.printerId);
    const { request, response } = await openCameraStream(printer);
    const remainingMs = Math.max(0, payload.exp * 1000 - Date.now());
    if (remainingMs === 0) {
      request.destroy();
      response.destroy();
      return res.status(401).json({ error: "stream_ticket_expired", message: "Stream ticket expired" });
    }

    res.status(200);
    res.set({
      "Cache-Control": "no-store",
      "Content-Type": response.headers["content-type"] || "multipart/x-mixed-replace; boundary=frame",
      "Referrer-Policy": "no-referrer",
      "X-Accel-Buffering": "no",
    });

    const expiryTimer = setTimeout(() => {
      response.destroy();
      request.destroy();
      res.destroy();
    }, remainingMs);
    expiryTimer.unref?.();

    const close = () => {
      clearTimeout(expiryTimer);
      response.destroy();
      request.destroy();
    };
    res.on("close", close);
    response.on("error", close);
    response.pipe(res);
    return undefined;
  } catch (error) {
    if (res.headersSent) return res.destroy();
    return sendError(res, error);
  }
};

exports.STREAM_LIFETIME_SECONDS = STREAM_LIFETIME_SECONDS;
