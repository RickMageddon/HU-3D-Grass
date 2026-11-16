const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const PrintJob = require("../models/printModel");

exports.uploadFile = (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const originalName = req.file.originalname;
    const ext = path.extname(originalName).toLowerCase();
    const isZip = ext === ".zip";

    // map incoming form fields to model fields, converting units when needed
    const body = req.body || {};
    const parseNumber = v => {
      if (v === undefined || v === null || v === "") return null;
      const n = Number(v);
      return Number.isNaN(n) ? null : n;
    };

    // prefer explicit fields, but accept alternate names from frontend
    const fileNameFromBody = body.fileName || body.name || null;
    const printerName = body.printerName || body.printer || "unassigned";
    const status = body.status || "queued";
    const progress = parseNumber(body.progress) ?? 0;

    // estimated time: frontend may send minutes under estimatedTimeMinutes
    const estimatedTime = parseNumber(body.estimatedTime) ?? parseNumber(body.estimatedTimeMinutes) ?? null;
    const timeElapsed = parseNumber(body.timeElapsed) ?? parseNumber(body.timeElapsedMinutes) ?? null;
    const timeRemaining = parseNumber(body.timeRemaining) ?? null;

    // file size: prefer actual uploaded file size (bytes); accept fileSizeMb if provided
    let fileSize = req.file.size ?? null;
    if ((!fileSize || fileSize === 0) && body.fileSizeMb) {
      const mb = parseNumber(body.fileSizeMb);
      if (mb !== null) fileSize = Math.round(mb * 1024 * 1024);
    }

    const material = body.material || body.resinType || null;
    const queuePosition = parseNumber(body.queuePosition) ?? null;
    const startedAt = body.startedAt || null;
    const completedAt = body.completedAt || null;

    // choose initial filename (may be replaced later if zip contains a CAD file)
    let jobFileName = fileNameFromBody || originalName;

    // Create initial job record using real data from the form
    const job = PrintJob.add({
      fileName: jobFileName,
      printerName,
      status,
      progress,
      timeRemaining,
      timeElapsed,
      startedAt,
      completedAt,
      queuePosition,
      estimatedTime,
      fileSize,
      material,
    });

    //Create folder for the job
    const jobDir = path.join("uploads/printjobs", String(job.id));
    fs.mkdirSync(jobDir, { recursive: true });

    // Handle ZIP
    if (isZip) {
      const zip = new AdmZip(req.file.path);
      const entries = zip.getEntries();

      let firstCADFile = null;
      const validExtensions = /\.(stl|stp|step|sldprt|3dm)$/i;

      for (const entry of entries) {
        if (entry.isDirectory) continue;
        const entryPath = entry.entryName;

        // Security: avoid path traversal
        if (entryPath.includes("..") || path.isAbsolute(entryPath)) {
          fs.unlinkSync(req.file.path);
          return res.status(400).json({ message: "Invalid ZIP structure" });
        }

        const basename = path.basename(entryPath);
        // store the entryPath (preserve relative path inside the zip) so downstream
        // consumers can locate the actual unpacked file. Normalize separators.
        const normalizedEntryPath = entryPath.split(/\\|\//).join("/");
        if (!firstCADFile && validExtensions.test(basename)) {
          firstCADFile = normalizedEntryPath;
        }

        zip.extractEntryTo(entry, jobDir, true, true);
      }

      fs.unlinkSync(req.file.path);

      // collect list of extracted files (relative paths)
      function walkDir(dir, base) {
        const results = [];
        for (const name of fs.readdirSync(dir)) {
          const full = path.join(dir, name);
          const rel = base ? `${base}/${name}` : name;
          if (fs.statSync(full).isDirectory()) {
            results.push(...walkDir(full, rel));
          } else {
            results.push(rel);
          }
        }
        return results;
      }

      const extractedFiles = walkDir(jobDir, "");

      if (firstCADFile) {
        // Save the relative path of the unpacked file as the job fileName
        PrintJob.update(job.id, { fileName: firstCADFile });
      }

      // refresh job from DB so we return the current values
      const refreshed = PrintJob.getById(job.id);
      if (refreshed) job = refreshed;

      // include the list of extracted files in response
      res.json({
        message: "File uploaded successfully",
        job,
        filesStoredIn: jobDir,
        extractedFiles,
      });
      return;
    } else {
      // Single file
      const destName = fileNameFromBody || originalName;
      const destPath = path.join(jobDir, destName);
      fs.copyFileSync(req.file.path, destPath);
      fs.unlinkSync(req.file.path);
    }
    // for single-file uploads, refresh and return the job similarly
    const refreshedSingle = PrintJob.getById(job.id);
    if (refreshedSingle) job = refreshedSingle;

    res.json({
      message: "File uploaded successfully",
      job,
      filesStoredIn: jobDir,
    });
  } catch (err) {
    console.error("Upload error:", err);
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ message: "Upload failed", error: err.message });
  }
};
