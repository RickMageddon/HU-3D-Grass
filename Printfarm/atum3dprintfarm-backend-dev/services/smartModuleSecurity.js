const crypto = require("crypto");

const ENCRYPTION_PREFIX = "v1";

function readRequiredSecret(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function getEncryptionKey() {
  const encoded = readRequiredSecret("SMART_MODULE_KEY_ENCRYPTION_KEY");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) {
    throw new Error("SMART_MODULE_KEY_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  }
  return key;
}

function encryptModuleKey(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    ENCRYPTION_PREFIX,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

function decryptModuleKey(value) {
  const [version, encodedIv, encodedTag, encodedCiphertext, ...rest] = String(value || "").split(".");
  if (
    version !== ENCRYPTION_PREFIX ||
    !encodedIv ||
    !encodedTag ||
    !encodedCiphertext ||
    rest.length > 0
  ) {
    throw new Error("Invalid encrypted Smart Module key");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(encodedIv, "base64url")
  );
  decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encodedCiphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function generateModuleKey() {
  return crypto.randomBytes(32).toString("base64url");
}

function createModuleSignature(secret, method, path, timestamp, nonce) {
  const message = [method.toUpperCase(), path, String(timestamp), nonce].join("\n");
  return crypto.createHmac("sha256", secret).update(message).digest("base64url");
}

function createSignedHeaders(secret, method, path, now = Date.now()) {
  const timestamp = Math.floor(now / 1000);
  const nonce = crypto.randomBytes(16).toString("base64url");
  return {
    "X-Module-Timestamp": String(timestamp),
    "X-Module-Nonce": nonce,
    "X-Module-Signature": createModuleSignature(secret, method, path, timestamp, nonce),
  };
}

module.exports = {
  createModuleSignature,
  createSignedHeaders,
  decryptModuleKey,
  encryptModuleKey,
  generateModuleKey,
  getEncryptionKey,
  readRequiredSecret,
};
