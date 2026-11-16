const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const jwt = require("jsonwebtoken");

const testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "atum3d-backend-test-"));
process.env.DATABASE_PATH = path.join(testDirectory, "database.sqlite");
process.env.SMART_MODULE_KEY_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
process.env.SMART_MODULE_ALLOWED_CIDRS = "192.168.0.0/16";
process.env.CAMERA_STREAM_TICKET_SECRET = "camera-ticket-test-secret";

const Printer = require("../models/printerModel");
const controller = require("../controllers/smartModuleController");

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    set(name, value) {
      if (typeof name === "object") Object.assign(this.headers, name);
      else this.headers[name] = value;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function addPrinter() {
  return Printer.add({
    name: "Secure printer",
    model: "DLP",
    status: "idle",
    location: "Lab",
    serialNumber: "TEST-1",
    addedDate: "2026-09-18",
    lastMaintenance: "2026-09-18",
    ipAddress: "192.168.1.20",
    sensorIp: "192.168.1.20",
    resinType: "Generic",
    resinLevel: 100,
    raspberryPiIp: "192.168.1.30",
  });
}

test("rotated module key is shown once and never returned by printer queries", () => {
  const printer = addPrinter();
  const response = createResponse();
  controller.rotateCredential({ params: { id: printer.id } }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(typeof response.body.apiKey, "string");
  assert.equal(response.headers["Cache-Control"], "no-store");
  const publicPrinter = Printer.getById(printer.id);
  const internalPrinter = Printer.getInternalById(printer.id);
  assert.equal(publicPrinter.smartModuleAuthConfigured, true);
  assert.equal("smartModuleApiKeyEncrypted" in publicPrinter, false);
  assert.notEqual(internalPrinter.smartModuleApiKeyEncrypted, response.body.apiKey);
});

test("camera tickets are scoped and expire after exactly one hour", () => {
  const printer = addPrinter();
  controller.rotateCredential({ params: { id: printer.id } }, createResponse());
  const response = createResponse();
  controller.createStreamTicket(
    { params: { id: printer.id }, user: { id: 42 } },
    response
  );

  const token = decodeURIComponent(response.body.streamUrl.split("/").pop());
  const payload = jwt.verify(token, process.env.CAMERA_STREAM_TICKET_SECRET, {
    audience: "atum3d-camera-stream",
    issuer: "atum3d-backend",
  });
  assert.equal(payload.printerId, String(printer.id));
  assert.equal(payload.userId, "42");
  assert.equal(payload.scope, "camera:stream");
  assert.equal(payload.exp - payload.iat, 3600);
});

test.after(() => {
  fs.rmSync(testDirectory, { recursive: true, force: true });
});
