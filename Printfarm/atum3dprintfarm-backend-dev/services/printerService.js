const Printer = require("../models/printerModel");
const PrintJob = require("../models/printModel");
const Logs = require("../models/logsModel");

const API_BASE_URL = process.env.API_BASE_URL;
const SERVICE_EMAIL = process.env.SERVICE_EMAIL;
const SERVICE_PASSWORD = process.env.SERVICE_PASSWORD;
const DEFAULT_POLL_INTERVAL = Number(process.env.PRINTER_POLL_INTERVAL_MS || 5000);

let apiToken = null;
let printerRecords = [];
let intervalId = null;

const LOG_THROTTLE_MS = 30_000;
const lastLogTime = new Map();

function throttledLog(key, logData) {
  const now = Date.now();
  if (now - (lastLogTime.get(key) ?? 0) < LOG_THROTTLE_MS) return;
  lastLogTime.set(key, now);
  Logs.create(logData);
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

function getProgressUrlFor(printer) {
  const ip = printer.ipAddress || printer.sensorIp;
  if (!ip) return null;
  if (ip.includes(":")) return `http://${ip}/progress`;
  const port = process.env.PRINTER_DEFAULT_PORT || 5002;
  return `http://${ip}:${port}/progress`;
 
}

async function loginServiceAccount() {
  if (!API_BASE_URL || !SERVICE_EMAIL || !SERVICE_PASSWORD) return;
  try {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: SERVICE_EMAIL, password: SERVICE_PASSWORD }),
    });
    if (!res.ok) throw new Error(`Login failed: ${res.status}`);
    const data = await res.json();
    apiToken = data.token;
    console.log("PrinterService: service account logged in");
  } catch (err) {
    console.error("PrinterService login failed:", err.message || err);
    setTimeout(loginServiceAccount, 5000);
  }
}

async function initPrinters() {
  if (!apiToken) {
    return setTimeout(initPrinters, 3000);
  }

  try {
    const res = await fetch(`${API_BASE_URL}/printers`, { headers: { Authorization: `Bearer ${apiToken}` } });
    if (!res.ok) throw new Error(`Fetch printers failed: ${res.status}`);
    const printers = await res.json();
    printers.forEach((p) => {
      if (!printerRecords.find((x) => x.id === p.id)) printerRecords.push(p);
    });
    console.log(`PrinterService: loaded ${printerRecords.length} printers`);
  } catch (err) {
    console.error("PrinterService: printer fetch failed:", err.message || err);
    setTimeout(initPrinters, 5000);
  }
}

async function pollOnce() {
  const printers = printerRecords.length ? printerRecords : Printer.getAll();
  for (const p of printers) {
    const url = getProgressUrlFor(p);
    if (!url) continue;
    console.log(`[PrinterService] Polling: ${url}`);

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) {
        throttledLog(`warn:${p.id}:poll-failed-${res.status}`, { level: "warn", source: p.name || `printer-${p.id}`, message: `poll failed ${url}: ${res.status}`, timestamp: formatTimestamp() });        continue;
      }

      const data = await res.json();
      const pausedRaw = data.paused ?? data.isPaused ?? data.pausedState;
      const paused = pausedRaw === true || String(pausedRaw) === "true" || Number(pausedRaw) === 1;

      const prog = Number(data.currentPrintProgress ?? data.current_print_progress ?? data.progress ?? 0);
      // attempt to read layer info from various possible field names
      const curLayerRaw = data.currentLayer ?? data.current_layer ?? data.layer ?? data.layerIndex ?? data.current_slice ?? data.currentSlice ?? data.sliceIndex;
      const totalLayersRaw = data.totalLayers ?? data.total_layers ?? data.total ?? data.layers ?? data.total_slices ?? data.totalSlices;
      const curLayer = Number.isFinite(Number(curLayerRaw)) ? Number(curLayerRaw) : null;
      const totalLayers = Number.isFinite(Number(totalLayersRaw)) ? Number(totalLayersRaw) : null;
      try {
        if (paused) {
          const printerUpd = { status: "paused" };
          if (Number.isFinite(curLayer)) printerUpd.currentLayer = curLayer;
          if (Number.isFinite(totalLayers)) printerUpd.totalLayers = totalLayers;
          Printer.update(p.id, printerUpd);
          // also mark any job assigned to this printer as paused and snapshot layers
          try {
            const jobsPrinting = PrintJob.getByStatus('printing') || [];
            const assigned = jobsPrinting.find(j => String(j.printerName) === String(p.name) || String(j.printerName) === String(p.id));
            if (assigned) {
              const jobUpd = { status: 'paused' };
              if (Number.isFinite(curLayer)) jobUpd.currentLayer = curLayer;
              if (Number.isFinite(totalLayers)) jobUpd.totalLayers = totalLayers;
              PrintJob.update(assigned.id, jobUpd);
            }
          } catch (inner) { console.error('Failed to pause assigned job:', inner.message || inner); }
        } else {
          const newStatus = prog > 0 ? "printing" : "idle";
          const printerUpd = { status: newStatus };
          if (Number.isFinite(curLayer)) printerUpd.currentLayer = curLayer;
          if (Number.isFinite(totalLayers)) printerUpd.totalLayers = totalLayers;
          Printer.update(p.id, printerUpd);
          // update progress on the assigned job if any; complete job when printer goes idle
          try {
            const jobsPrinting = PrintJob.getByStatus('printing') || [];
            const assigned = jobsPrinting.find(j => String(j.printerName) === String(p.name) || String(j.printerName) === String(p.id));
            if (assigned) {
              if (newStatus === 'idle') {
                try {
                  const updateData = { status: 'completed', progress: 100, completedAt: formatTimestamp() };
                  if (Number.isFinite(totalLayers)) updateData.totalLayers = totalLayers;
                  if (Number.isFinite(curLayer)) updateData.currentLayer = Number.isFinite(totalLayers) ? totalLayers : curLayer;
                  PrintJob.update(assigned.id, updateData);
                } catch (inner2) { console.error('Failed to mark job completed:', inner2.message || inner2); }
              } else {
                try {
                  const updateData = { progress: prog };
                  if (Number.isFinite(curLayer)) updateData.currentLayer = curLayer;
                  if (Number.isFinite(totalLayers)) updateData.totalLayers = totalLayers;
                  PrintJob.update(assigned.id, updateData);
                } catch (inner2) { console.error('Failed to update job progress/layers:', inner2.message || inner2); }
              }
            }
          } catch (inner) { console.error('Failed to update job progress/completion:', inner.message || inner); }
        }
      } catch (e) { console.error("printer update failed:", e.message || e); }

      const rp = Number(data.resinPercent ?? data.resin_percent ?? data.percent ?? data.resinLevel ?? NaN);
      if (!Number.isNaN(rp)) {
        try {
          const upd = { resinLevel: Math.round(rp) };
          if (Number.isFinite(curLayer)) upd.currentLayer = curLayer;
          if (Number.isFinite(totalLayers)) upd.totalLayers = totalLayers;
          Printer.update(p.id, upd);
        } catch (e) { console.error("printer resin update failed:", e.message || e); }
      }

      try {
  throttledLog(`info:${p.id}:polled`, { level: "info", source: p.name || `printer-${p.id}`, message: `polled progress=${prog} resin=${isNaN(rp) ? 'n/a' : rp}`, timestamp: formatTimestamp() });      } catch (e) { console.error("Failed to write poll log:", e.message || e); }
    } catch (err) {
  throttledLog(`warn:${p.id}:poll-error`, { level: "warn", source: p.name || `printer-${p.id}`, message: `poll error ${err.message}`, timestamp: formatTimestamp() });    }
  }
}

function start(intervalMs = DEFAULT_POLL_INTERVAL) {
  if (intervalId) return;
  pollOnce();
  intervalId = setInterval(pollOnce, intervalMs);
  console.log(`PrinterService: started polling every ${intervalMs}ms`);
}

function stop() { if (!intervalId) return; clearInterval(intervalId); intervalId = null; }

function attachRoutes(app) {
  app.post("/printer-logs", expressJsonHandler);
}

function expressJsonHandler(req, res) {
  const body = req.body || {};
  const ip = body.ip || body.ipAddress;
  const level = body.level || "info";
  const msg = body.message || body.msg || "";
  const ts = body.ts ? formatTimestamp(body.ts) : formatTimestamp();

  const target = printerRecords.find(p => (p.ipAddress === ip) || (p.sensorIp === ip)) || Printer.getAll().find(p => (p.ipAddress === ip) || (p.sensorIp === ip) || (p.name === ip));
  const source = target ? (target.name || `printer-${target.id}`) : (body.source || "unknown");

  try { Logs.create({ level, source, message: msg, timestamp: ts }); res.json({ ok: true }); } catch (e) { res.status(500).json({ ok: false, error: e.message || e }); }
}

// initialize and start polling
// auto-start flow: login, load printers from API, then start polling
(async () => {
  await loginServiceAccount();
  await initPrinters();
  start();
})();

module.exports = { start, stop, attachRoutes };
