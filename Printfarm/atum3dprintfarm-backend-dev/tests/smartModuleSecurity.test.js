const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

process.env.SMART_MODULE_KEY_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
process.env.SMART_MODULE_ALLOWED_CIDRS = "192.168.0.0/16,10.10.0.0/16";

const {
  createModuleSignature,
  decryptModuleKey,
  encryptModuleKey,
} = require("../services/smartModuleSecurity");
const {
  SmartModuleError,
  parseCidr,
  validateModuleAddress,
  requestJson,
} = require("../services/smartModuleClient");

test("module keys are encrypted with authenticated encryption", () => {
  const encrypted = encryptModuleKey("printer-specific-secret");
  assert.notEqual(encrypted, "printer-specific-secret");
  assert.equal(decryptModuleKey(encrypted), "printer-specific-secret");
  assert.throws(() => decryptModuleKey(`${encrypted}tampered`));
});

test("HMAC uses the shared method/path/timestamp/nonce wire format", () => {
  assert.equal(
    createModuleSignature(
      "test-secret",
      "GET",
      "/api/status",
      1700000000,
      "1234567890abcdef"
    ),
    "b5Alwlnvje50G64Lr43fuL7wa7Humz6uCkVLoUgSDCA"
  );
});

test("module targets must be IPv4 addresses inside an allowed CIDR", () => {
  assert.deepEqual(parseCidr("192.168.0.0/16"), {
    network: 3232235520,
    mask: 4294901760,
  });
  assert.equal(validateModuleAddress("192.168.10.20"), "192.168.10.20");
  assert.throws(
    () => validateModuleAddress("127.0.0.1"),
    (error) => error instanceof SmartModuleError && error.status === 422
  );
  assert.throws(() => validateModuleAddress("http://192.168.1.2"));
});

test("JSON proxy signs the canonical module path without sending the secret", async () => {
  const secret = "per-printer-test-secret";
  const server = http.createServer((request, response) => {
    try {
      assert.equal(request.url, "/sensor/api/status");
      assert.equal(request.headers["x-module-key"], undefined);
      const timestamp = request.headers["x-module-timestamp"];
      const nonce = request.headers["x-module-nonce"];
      assert.equal(
        request.headers["x-module-signature"],
        createModuleSignature(secret, "GET", "/api/status", timestamp, nonce)
      );
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ status: "ok" }));
    } catch (error) {
      response.statusCode = 500;
      response.end(JSON.stringify({ error: error.message }));
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  process.env.SMART_MODULE_ALLOWED_CIDRS = "127.0.0.0/8";
  process.env.SMART_MODULE_HTTP_PORT = String(server.address().port);
  try {
    const result = await requestJson(
      {
        raspberryPiIp: "127.0.0.1",
        smartModuleApiKeyEncrypted: encryptModuleKey(secret),
      },
      "/sensor/api/status",
      "/api/status"
    );
    assert.deepEqual(result, { status: "ok" });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    process.env.SMART_MODULE_ALLOWED_CIDRS = "192.168.0.0/16,10.10.0.0/16";
    delete process.env.SMART_MODULE_HTTP_PORT;
  }
});
