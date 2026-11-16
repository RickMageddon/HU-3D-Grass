const http = require("http");
const net = require("net");
const {
  createSignedHeaders,
  decryptModuleKey,
} = require("./smartModuleSecurity");

const DEFAULT_PORT = 5443;
const DEFAULT_TIMEOUT_MS = 4_000;
const DEFAULT_MAX_JSON_BYTES = 1024 * 1024;

class SmartModuleError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "SmartModuleError";
    this.status = status;
    this.code = code;
  }
}

function ipv4ToNumber(value) {
  if (net.isIP(value) !== 4) return null;
  return value.split(".").reduce((result, part) => (result << 8) + Number(part), 0) >>> 0;
}

function parseCidr(value) {
  const [address, prefixText, ...rest] = value.trim().split("/");
  const addressNumber = ipv4ToNumber(address);
  const prefix = Number(prefixText);
  if (
    rest.length > 0 ||
    addressNumber === null ||
    !Number.isInteger(prefix) ||
    prefix < 0 ||
    prefix > 32
  ) {
    throw new Error(`Invalid IPv4 CIDR in SMART_MODULE_ALLOWED_CIDRS: ${value}`);
  }
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return { network: (addressNumber & mask) >>> 0, mask };
}

function getAllowedCidrs() {
  const configured = process.env.SMART_MODULE_ALLOWED_CIDRS?.trim();
  if (!configured) throw new Error("SMART_MODULE_ALLOWED_CIDRS is required");
  return configured.split(",").map((value) => value.trim()).filter(Boolean).map(parseCidr);
}

function validateModuleAddress(value) {
  const address = typeof value === "string" ? value.trim() : "";
  const numericAddress = ipv4ToNumber(address);
  if (numericAddress === null) {
    throw new SmartModuleError(422, "invalid_module_address", "Raspberry Pi IP must be an IPv4 address");
  }
  const allowed = getAllowedCidrs().some(
    ({ network, mask }) => ((numericAddress & mask) >>> 0) === network
  );
  if (!allowed) {
    throw new SmartModuleError(422, "module_address_not_allowed", "Raspberry Pi IP is outside the allowed networks");
  }
  return address;
}

function getPort() {
  const port = Number(process.env.SMART_MODULE_HTTP_PORT || DEFAULT_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("SMART_MODULE_HTTP_PORT must be a valid TCP port");
  }
  return port;
}

function getModuleTarget(printer) {
  if (!printer) throw new SmartModuleError(404, "printer_not_found", "Printer not found");
  if (!printer.smartModuleApiKeyEncrypted) {
    throw new SmartModuleError(409, "module_not_configured", "Smart Module authentication is not configured");
  }
  return {
    host: validateModuleAddress(printer.raspberryPiIp),
    port: getPort(),
    secret: decryptModuleKey(printer.smartModuleApiKeyEncrypted),
  };
}

function mapRequestError(error) {
  if (error instanceof SmartModuleError) return error;
  if (error?.code === "ETIMEDOUT" || error?.code === "ECONNRESET") {
    return new SmartModuleError(504, "module_timeout", "Smart Module request timed out");
  }
  return new SmartModuleError(502, "module_unavailable", "Smart Module is unavailable");
}

function requestJson(printer, gatewayPath, canonicalPath) {
  const target = getModuleTarget(printer);
  const timeoutMs = Number(process.env.SMART_MODULE_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const maxBytes = Number(process.env.SMART_MODULE_MAX_JSON_BYTES || DEFAULT_MAX_JSON_BYTES);

  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        host: target.host,
        port: target.port,
        method: "GET",
        path: gatewayPath,
        headers: {
          Accept: "application/json",
          ...createSignedHeaders(target.secret, "GET", canonicalPath),
        },
      },
      (response) => {
        const chunks = [];
        let received = 0;
        response.on("data", (chunk) => {
          received += chunk.length;
          if (received > maxBytes) {
            response.destroy(new SmartModuleError(502, "module_response_too_large", "Smart Module response is too large"));
            return;
          }
          chunks.push(chunk);
        });
        response.on("error", (error) => reject(mapRequestError(error)));
        response.on("end", () => {
          if (response.statusCode === 401 || response.statusCode === 403) {
            reject(new SmartModuleError(502, "module_auth_failed", "Smart Module rejected authentication"));
            return;
          }
          if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
            reject(new SmartModuleError(502, "module_bad_response", `Smart Module returned HTTP ${response.statusCode || 0}`));
            return;
          }
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
          } catch {
            reject(new SmartModuleError(502, "module_invalid_json", "Smart Module returned invalid JSON"));
          }
        });
      }
    );
    request.setTimeout(timeoutMs, () => {
      const error = new Error("Smart Module request timed out");
      error.code = "ETIMEDOUT";
      request.destroy(error);
    });
    request.on("error", (error) => reject(mapRequestError(error)));
    request.end();
  });
}

function openCameraStream(printer) {
  const target = getModuleTarget(printer);
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        host: target.host,
        port: target.port,
        method: "GET",
        path: "/camera/video_raw",
        headers: createSignedHeaders(target.secret, "GET", "/video_raw"),
      },
      (response) => {
        if (response.statusCode === 401 || response.statusCode === 403) {
          response.resume();
          reject(new SmartModuleError(502, "module_auth_failed", "Smart Module rejected authentication"));
          return;
        }
        if (response.statusCode !== 200) {
          response.resume();
          reject(new SmartModuleError(502, "module_bad_response", `Smart Module returned HTTP ${response.statusCode || 0}`));
          return;
        }
        resolve({ request, response });
      }
    );
    request.setTimeout(DEFAULT_TIMEOUT_MS, () => {
      const error = new Error("Smart Module stream timed out");
      error.code = "ETIMEDOUT";
      request.destroy(error);
    });
    request.on("error", (error) => reject(mapRequestError(error)));
    request.end();
  });
}

module.exports = {
  SmartModuleError,
  getAllowedCidrs,
  openCameraStream,
  parseCidr,
  requestJson,
  validateModuleAddress,
};
