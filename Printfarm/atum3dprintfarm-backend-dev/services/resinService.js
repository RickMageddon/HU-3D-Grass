// tcp-printer-server.js

require("dotenv").config();
const net = require("net");
const WebSocket = require("ws");

const Logs = require("../models/logsModel");
const Printer = require("../models/printerModel");
const { parse } = require("path");


let printerRecords = [];
const clients = {};

const WS_PORT = Number(process.env.WS_PORT || 6000);

const API_BASE_URL = process.env.API_BASE_URL;
const SERVICE_EMAIL = process.env.SERVICE_EMAIL;
const SERVICE_PASSWORD = process.env.SERVICE_PASSWORD;
const TCP_PORT = Number(process.env.TCP_PORT || 5000);

let apiToken = null;

// --------------------
// AUTH
// --------------------

async function loginServiceAccount() {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: SERVICE_EMAIL,
        password: SERVICE_PASSWORD,
      }),
    });

    if (!res.ok) {
      throw new Error(`Login failed: ${res.status}`);
    }

    const data = await res.json();
    apiToken = data.token;

    console.log("Service account logged in");
  } catch (err) {
    console.error("Service login failed:", err.message);
    setTimeout(loginServiceAccount, 5000);
  }
}

// --------------------
// Helpers
// --------------------

function normalizeIp(addr) {
  if (!addr) return null;
  // IPv4-mapped IPv6 addresses come in as ::ffff:127.0.0.1
  if (addr.startsWith("::ffff:")) return addr.slice(7);
  // IPv6 loopback
  if (addr === "::1") return "127.0.0.1";
  return addr;
}

function formatTimestamp(d) {
  const date = d ? new Date(d) : new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    date.getFullYear() +
    "-" +
    pad(date.getMonth() + 1) +
    "-" +
    pad(date.getDate()) +
    " " +
    pad(date.getHours()) +
    ":" +
    pad(date.getMinutes())
  );
}

// Calibration points and conversion helper: pF -> fill percent (linear interpolation)
const calibrationPoints = [
  { pf: 6.85, percent: 0 },
  { pf: 7.80, percent: 25 },
  { pf: 8.20, percent: 50 },
  { pf: 8.50, percent: 78 },
  { pf: 8.80, percent: 100 },
];

function pfToFillPercent(pf) {
  if (typeof pf !== "number" || !Number.isFinite(pf)) return null;
  if (pf <= calibrationPoints[0].pf) return calibrationPoints[0].percent;
  const last = calibrationPoints[calibrationPoints.length - 1];
  if (pf >= last.pf) return last.percent;
  for (let i = 0; i < calibrationPoints.length - 1; i++) {
    const p1 = calibrationPoints[i];
    const p2 = calibrationPoints[i + 1];
    if (pf >= p1.pf && pf <= p2.pf) {
      const t = (pf - p1.pf) / (p2.pf - p1.pf);
      const percent = p1.percent + t * (p2.percent - p1.percent);
      // round up to the next integer percentage, clamp 0-100
      return Math.min(100, Math.max(0, Math.ceil(percent)));
    }
  }
  return last.percent;
}

function findPrinterByIp(ip) {
  return printerRecords.find((p) => p.ipAddress === ip);
}

function parseMeasurementLine(line) {
  // Verwacht: ID=STM01;C=12.3456
  const fields = {};

  for (const part of line.split(";")) {
    const [k, v] = part.split("=");
    if (k && v) fields[k.trim()] = v.trim();
  }

  if (!fields.ID || !fields.C) return null;

  const value = Number(fields.C);
  if (!Number.isFinite(value)) return null;

  return { id: fields.ID, value };
}

// --------------------
// TCP SERVER
// --------------------

function startTcpServer() {
  const server = net.createServer((socket) => {
    const remoteIp = normalizeIp(socket.remoteAddress);
    console.log(`STM connected from ${remoteIp}`);

    const printer = findPrinterByIp(remoteIp);
    if (printer) {
      clients[printer.id] = socket;
      console.log(`Linked to printer ${printer.name}`);
    }
    let buffer = "";

    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      let idx;
      while ((idx = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);

        if (!line) continue;
        const parsed = parseMeasurementLine(line);
        if (parsed) {
          const target =
            printer ||
            printerRecords.find(
              (p) =>
                p.sensorIp === remoteIp ||
                String(p.id) === parsed.id ||
                p.sensorId === parsed.id
            );
          if (target) {
            const fillPercent = pfToFillPercent(parsed.value);
            target.latestResinVolume = {
              volume: parsed.value,
              percent: fillPercent,
              timestamp: formatTimestamp(),
            };
            console.log(`💾 ${target.name}: ${parsed.value.toFixed(4)} pF (${fillPercent}%)`);
            try {
              Logs.create({
                level: "info",
                source: target.name || `printer-${target.id}`,
                message: `resin measurement: ${parsed.value.toFixed(4)} pF (${fillPercent}%)`,
                timestamp: formatTimestamp(),
              });
            } catch (e) {
              console.error("Failed to write log:", e.message || e);
            }
          }
        }

        socket.write("ACK\n");
      }
    });

    socket.on("close", () => {
      if (printer) delete clients[printer.id];
    });

    socket.on("error", () => {
      if (printer) delete clients[printer.id];
      socket.destroy();
    });
  });

  server.listen(TCP_PORT, () => {
    console.log(`TCP server listening on port ${TCP_PORT}`);
  });
}

function startWsServer() {
  const wss = new WebSocket.Server({ port: WS_PORT });

  wss.on("connection", (ws, req) => {
    const remoteIp = normalizeIp(req.socket.remoteAddress);
    console.log(`WS connected from ${remoteIp}`);

    const printer = findPrinterByIp(remoteIp);
    if (printer) {
      clients[printer.id] = ws;
      console.log(`Linked WS to printer ${printer.name}`);
    }

    ws.on("message", (msg) => {
      const text = String(msg).trim();
      if (!text) return;

      // First, try parse as JSON (frontend may send JSON logs/messages)
      let handled = false;
      try {
        const json = JSON.parse(text);
        // attach the JSON message to the matched printer record
        if (json) {
          const target =
            printer ||
            printerRecords.find(
              (p) => p.ipAddress === remoteIp || String(p.id) === json.id || p.sensorId === json.id
            );

          if (target) {
            // keep a small last-message slot and optional log array
            target.latestWsMessage = json;
            if (!Array.isArray(target.wsMessages)) target.wsMessages = [];
            target.wsMessages.push({ payload: json, ts: formatTimestamp(json.ts) });
            if (target.wsMessages.length > 50) target.wsMessages.shift();
            try {
              Logs.create({
                level: json.level || json.levels || "info",
                source: target.name || `printer-${target.id}`,
                message: json.msg || json.message || JSON.stringify(json),
                timestamp: (function(){
                  if (!json.ts) return formatTimestamp();
                  const n = Number(json.ts);
                  if (Number.isNaN(n)) return formatTimestamp();
                  const date = n < 1e12 ? new Date(n * 1000) : new Date(n);
                  return formatTimestamp(date);
                })(),
              });
            } catch (e) {
              console.error("Failed to write WS JSON log:", e.message || e);
            }

            // If the message contains print progress, update printer status in DB
            try {
              const progressRaw = json.currentPrintProgress ?? json.current_print_progress ?? json.progress ?? json.currentPrintProgressPercentage;
              const pausedRaw = json.paused ?? json.isPaused ?? json.pausedState;
              if (pausedRaw !== undefined) {
                const paused = pausedRaw === true || String(pausedRaw) === "true" || Number(pausedRaw) === 1;
                try {
                  if (paused) {
                    Printer.update(target.id, { status: "paused" });
                  } else {
                    // if unpaused and progress present, fall through to progress logic
                  }
                } catch (err) {
                  console.error("Failed to update printer paused status:", err.message || err);
                }
              }

              if (progressRaw !== undefined) {
                const p = Number(progressRaw);
                if (!Number.isNaN(p)) {
                  // only set active/idle when not paused
                  const current = Printer.getById(target.id);
                  const currentlyPaused = current && current.status === "paused";
                  if (!currentlyPaused) {
                    const newStatus = p > 0 ? "active" : "idle";
                    try {
                      Printer.update(target.id, { status: newStatus });
                    } catch (err) {
                      console.error("Failed to update printer status:", err.message || err);
                    }
                  }
                }
              }

              // If message contains resin percent, update printer resinLevel
              const resinPercentRaw = json.resinPercent ?? json.resin_percent ?? json.percent ?? json.resinLevel;
              if (resinPercentRaw !== undefined) {
                const rp = Number(resinPercentRaw);
                if (!Number.isNaN(rp)) {
                  try {
                    // store as integer percent (0-100)
                    Printer.update(target.id, { resinLevel: Math.round(rp) });
                  } catch (err) {
                    console.error("Failed to update printer resin level:", err.message || err);
                  }
                }
              }
            } catch (err) {
              console.error("Error handling printer state update:", err.message || err);
            }
          }

          // also print a short line for operator visibility
          if (json.level && json.msg) {
            console.log(`WS ${remoteIp} [${json.level}]: ${json.msg}`);
          } else {
            console.log(`WS ${remoteIp} JSON:`, json);
          }

          handled = true;
        }
      } catch (err) {
        // not JSON — fall through to legacy parser
      }

      if (!handled) {
        const parsed = parseMeasurementLine(text);
        if (parsed) {
          const target =
            printer ||
            printerRecords.find(
              (p) =>
                p.ipAddress === remoteIp ||
                String(p.id) === parsed.id ||
                p.sensorId === parsed.id
            );

          if (target) {
            const fillPercent = pfToFillPercent(parsed.value);
            target.latestResinVolume = {
              volume: parsed.value,
              percent: fillPercent,
              timestamp: formatTimestamp(),
            };

            console.log(`${target.name}: ${parsed.value.toFixed(4)} pF (${fillPercent}%)`);
            try {
              Logs.create({
                level: "info",
                source: target.name || `printer-${target.id}`,
                message: `resin measurement: ${parsed.value.toFixed(4)} pF (${fillPercent}%)`,
                timestamp: formatTimestamp(),
              });
            } catch (e) {
              console.error("Failed to write WS measurement log:", e.message || e);
            }
          }
        }
      }

      try {
        ws.send("ACK\n");
      } catch (e) {
        // ignore send errors
      }
    });

    ws.on("close", () => {
      if (printer) delete clients[printer.id];
    });

    ws.on("error", () => {
      if (printer) delete clients[printer.id];
      try {
        ws.terminate();
      } catch (e) {}
    });
  });

  wss.on("listening", () => {
    console.log(`WS server listening on port ${WS_PORT}`);
  });
}

// --------------------
// LOAD PRINTERS
// --------------------

async function initPrinters() {
  if (!apiToken) {
    console.warn("No API token yet, retrying...");
    return setTimeout(initPrinters, 3000);
  }

  try {
    const res = await fetch(`${API_BASE_URL}/printers`, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Fetch printers failed: ${res.status}`);
    }

    const printers = await res.json();

    printers.forEach((p) => {
      if (!printerRecords.find((x) => x.id === p.id)) {
        printerRecords.push(p);
      }
    });

    console.log(`Loaded ${printerRecords.length} printers`);
  } catch (err) {
    console.error("Printer fetch failed:", err.message);
    setTimeout(initPrinters, 5000);
  }
}

// --------------------
// PUBLIC API
// --------------------

function getLatestResinVolume(printerId) {
  const p = printerRecords.find((p) => p.id === printerId);
  return p ? p.latestResinVolume : null;
}

function getAllResinVolumes() {
  return printerRecords.map((p) => ({
    id: p.id,
    name: p.name,
    ipAddress: p.ipAddress,
    latestResinVolume: p.latestResinVolume || null,
  }));
}

// --------------------
// STARTUP FLOW
// --------------------

(async () => {
  await loginServiceAccount();
  await initPrinters();
  startTcpServer();
  startWsServer();
})();

module.exports = {
  getLatestResinVolume,
  getAllResinVolumes,
  printerRecords,
};
