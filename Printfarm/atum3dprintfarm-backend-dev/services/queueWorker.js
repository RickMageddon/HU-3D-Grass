const fetch = global.fetch || require('node-fetch');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const PrintJob = require('../models/printModel');
const Printer = require('../models/printerModel');
const Logs = require('../models/logsModel');

const DEFAULT_POLL_MS = Number(process.env.QUEUE_POLL_INTERVAL_MS || 3000);
const MIN_RESIN_PERCENT = Number(process.env.JOB_MIN_RESIN_PERCENT || 10);
let intervalId = null;

function formatTimestamp() { return new Date().toISOString(); }

function getPrinterSendUrl(printer) {
  const ip = printer.ipAddress || printer.sensorIp;
  if (!ip) return null;
  if (ip.includes(':')) return `http://${ip}/send`;
  const port = process.env.PRINTER_DEFAULT_PORT || 5000;
  return `http://${ip}:${port}/send`;
}

async function trySendJobToPrinter(job, printer) {
  const url = getPrinterSendUrl(printer);
  if (!url) {
    Logs.create({ level: 'warn', source: `queue`, message: `No reachable address for printer ${printer.name}`, timestamp: formatTimestamp() });
    return false;
  }

  // locate job file under uploads/printjobs/<id>
  const jobDir = path.join('uploads', 'printjobs', String(job.id));
  const jobFileRel = job.fileName || '';
  let jobFilePath = path.join(jobDir, jobFileRel);

  function walkDirCollect(dir) {
    const results = [];
    try {
      for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        try {
          if (fs.statSync(full).isDirectory()) results.push(...walkDirCollect(full)); else results.push(full);
        } catch (e) { /* ignore individual errors */ }
      }
    } catch (e) { /* ignore */ }
    return results;
  }

  // if exact path missing, try to locate file recursively using several heuristics
  if (!fs.existsSync(jobFilePath)) {
    const normalizedTarget = jobFileRel.replace(/\\/g, '/');
    const allFiles = walkDirCollect(jobDir);
    // 1) endsWith match (preserves folders inside zip)
    const endsWithMatch = allFiles.find(f => f.replace(/\\/g, '/').endsWith(normalizedTarget));
    if (endsWithMatch) jobFilePath = endsWithMatch;
    else {
      // 2) match by basename
      const targetBase = path.basename(jobFileRel);
      const baseMatch = allFiles.find(f => path.basename(f) === targetBase);
      if (baseMatch) jobFilePath = baseMatch;
      else {
        // 3) fuzzy: find file that contains most of the targetBase (ignoring spaces/diacritics is complex; use simple contains)
        const simple = targetBase.replace(/\s+/g, '').toLowerCase();
        const fuzzy = allFiles.find(f => path.basename(f).replace(/\s+/g, '').toLowerCase().includes(simple));
        if (fuzzy) jobFilePath = fuzzy;
      }
    }
  }

  if (!fs.existsSync(jobFilePath)) {
    console.log(jobFilePath)
    Logs.create({ level: 'error', source: 'queue', message: `Job file not found for job ${job.id}: ${jobFilePath}`, timestamp: formatTimestamp() });
    return false;
  }

  // send file as multipart/form-data so printers can stream
  const stream = fs.createReadStream(jobFilePath);
  const form = new FormData();
  form.append('file', stream, { filename: path.basename(jobFilePath) });
  form.append('jobId', String(job.id));
  form.append('fileName', job.fileName || '');
  try { form.append('metadata', JSON.stringify(job)); } catch (e) { form.append('metadata', '{}'); }

  try {
    const headers = form.getHeaders();
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: form,
      timeout: 20000,
    });

    if (!res.ok) {
      Logs.create({ level: 'warn', source: `printer-${printer.id}`, message: `Send failed ${res.status} for job ${job.id}`, timestamp: formatTimestamp() });
      return false;
    }

    // mark job and printer as printing, record assigned printer
    try {
      PrintJob.update(job.id, { status: 'printing', startedAt: formatTimestamp(), progress: 0, printerName: printer.name });
    } catch (e) { console.error('Failed to update job status:', e); }
    try { Printer.update(printer.id, { status: 'printing' }); } catch (e) { console.error('Failed to update printer status:', e); }

    Logs.create({ level: 'info', source: `queue`, message: `Sent job ${job.id} to printer ${printer.name}`, timestamp: formatTimestamp() });
    return true;
  } catch (err) {
    Logs.create({ level: 'error', source: `queue`, message: `Send error for job ${job.id} -> ${printer.name}: ${err.message}`, timestamp: formatTimestamp() });
    return false;
  }
}

function findSuitablePrinterFor(job) {
  const printers = Printer.getAll();
  const requiredPercent = Number(job.requiredResinPercent ?? job.requiredResin ?? MIN_RESIN_PERCENT);

  // match same resin type and idle and sufficient resin
  const candidates = printers.filter(p => {
    if (!p) return false;
    if ((p.status || '') !== 'idle') return false;
    if (job.material && p.resinType && String(p.resinType) !== String(job.material)) return false;
    const level = Number(p.resinLevel ?? 0);
    if (Number.isNaN(level)) return false;
    return level >= requiredPercent;
  });

  // Prefer highest resin level
  candidates.sort((a, b) => (Number(b.resinLevel || 0) - Number(a.resinLevel || 0)));
  return candidates.length ? candidates[0] : null;
}

async function pollOnce() {
  try {
    const queued = PrintJob.getByStatus('queued') || [];
    if (!queued.length) return;

    // order by queuePosition then id
    queued.sort((a, b) => {
      const qa = a.queuePosition ?? 0;
      const qb = b.queuePosition ?? 0;
      if (qa !== qb) return qa - qb;
      return a.id - b.id;
    });

    const job = queued[0];

    // If job has specific printer assigned (not 'unassigned' or falsy)
    if (job.printerName && String(job.printerName).toLowerCase() !== 'unassigned') {
      const printers = Printer.getAll();
      const target = printers.find(p => String(p.name) === String(job.printerName) || String(p.id) === String(job.printerName));
      if (!target) {
        Logs.create({ level: 'warn', source: 'queue', message: `Assigned printer ${job.printerName} not found for job ${job.id}`, timestamp: formatTimestamp() });
        return;
      }

      if ((target.status || '') !== 'idle') {
        // wait until printer becomes idle
        return;
      }

      await trySendJobToPrinter(job, target);
      return;
    }

    // otherwise find suitable printer
    const suitable = findSuitablePrinterFor(job);
    if (!suitable) {
      // no idle suitable printer found, do nothing
      return;
    }

    await trySendJobToPrinter(job, suitable);
  } catch (err) {
    console.error('Queue worker poll error:', err.message || err);
  }
}

function start(intervalMs = DEFAULT_POLL_MS) {
  if (intervalId) return;
  pollOnce();
  intervalId = setInterval(pollOnce, intervalMs);
  console.log(`QueueWorker: started polling every ${intervalMs}ms`);
}

function stop() { if (!intervalId) return; clearInterval(intervalId); intervalId = null; }

module.exports = { start, stop };
