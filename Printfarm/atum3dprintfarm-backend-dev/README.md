# Atum3D Print Farm — Backend

Small Express-based backend for a networked resin print farm (Atum3D).

**Quick summary**
- Node.js + Express app using SQLite (`better-sqlite3`) for storage.
- Provides REST API for printers, print jobs, logs, stats, notifications and authentication.
- Background services: printer polling (`services/printerService.js`), resin TCP/WS receiver (`services/resinService.js`), and a queue worker for sending jobs to printers (`services/queueWorker.js`).

**Prerequisites**
- Node.js 18+ recommended
- On-device network access to printers and optional serial/WS/TCP sensors

**Install**
```bash
npm install
```

**Environment**
Create a `.env` file (or set env vars) — important variables used by the app:

- `PORT` (default 3000 in `server.js`)
- `JWT_SECRET` — JWT signing secret
- `DASHBOARD_ORIGIN` — the only browser origin allowed by CORS
- `CAMERA_STREAM_TICKET_SECRET` — separate signing secret for one-hour camera tickets
- `SMART_MODULE_KEY_ENCRYPTION_KEY` — base64-encoded 32-byte key used to encrypt per-printer module keys
- `SMART_MODULE_ALLOWED_CIDRS` — comma-separated IPv4 networks containing Smart Modules
- `SMART_MODULE_HTTP_PORT` — fixed Nginx port on each module (default `5443`)
- `DEFAULT_ADMIN_NAME`, `DEFAULT_ADMIN_EMAIL`, `DEFAULT_ADMIN_PASSWORD` — created on startup if no admin exists
- `API_BASE_URL`, `SERVICE_EMAIL`, `SERVICE_PASSWORD` — used by `printerService` and `resinService` to log in as a service account
- `PRINTER_POLL_INTERVAL_MS`, `QUEUE_POLL_INTERVAL_MS` — poll intervals
- `PRINTER_DEFAULT_PORT` — default port for contacting printers
- `WS_PORT`, `TCP_PORT` — used by `resinService` for incoming printer sensor connections
- `JOB_MIN_RESIN_PERCENT` / `NOTIFY_RESIN_PERCENT` — thresholds for job scheduling and alerts
- `NOTIFY_DEDUP_MINUTES` — notification dedup interval

The project already references `.env` via `dotenv` inside some services (for local dev).

**Run**
```bash
node server.js
```
The server listens on port `3000` by default. `server.js` attaches routes and boots background services (`printerService`, `queueWorker`) at startup.

**Database**
- Uses `better-sqlite3` and `database.sqlite` stored in the project root.
- Tables are created/altered automatically by `models/db.js` on startup: `printers`, `print_jobs`, `logs`, `users`, `notifications`.

**Uploads**
- Uploaded print job files are stored under `uploads/printjobs/<jobId>/`.
- `controllers/uploadController.js` accepts a single file (supports ZIP extraction of CAD files) and creates a `print_jobs` record.

**API Overview**
All API endpoints are under `server.js` route mounts.

- Auth: `/auth`
  - `POST /auth/signup` — register, returns JWT
  - `POST /auth/login` — login, returns JWT
  - `GET /auth/users` — list users (admin only)
  - `PUT /auth/users/:id` — update user (admin only)
  - `DELETE /auth/users/:id` — delete user (admin only)

- Print Jobs: `/print-jobs` (JWT required via `Authorization: Bearer <token>`)
  - `POST /print-jobs/` — file upload form (field `file`) handled by `uploadController` (multipart)
  - `GET /print-jobs/` — list jobs
  - `GET /print-jobs/:id` — get job
  - `GET /print-jobs/status/:status` — jobs by status
  - `PUT /print-jobs/:id` — update job
  - `DELETE /print-jobs/:id` — delete job

- Printers: `/printers` (JWT required)
  - `GET /printers/` — list printers
  - `POST /printers/` — add printer
  - `PUT /printers/:id` — update printer
  - `DELETE /printers/:id` — remove printer
  - `POST /printers/:id/smart-module/credentials/rotate` — generate a one-time module key (admin only)
  - `GET /printers/:id/smart-module/status` — authenticated sensor proxy
  - `GET /printers/:id/smart-module/camera/detections` — authenticated detection proxy
  - `POST /printers/:id/smart-module/camera/stream-ticket` — issue a one-hour camera ticket

- Logs: `/logs` (JWT required)
  - `GET /logs/` — list logs
  - `POST /logs/` — add log
  - `DELETE /logs/` — clear logs

- Notifications: `/notifications` (JWT required)
  - `GET /notifications/` — list notifications
  - `POST /notifications/` — add notification
  - `PATCH /notifications/:id/read` — mark read
  - `DELETE /notifications/` — clear

- Stats: `/stats`
  - `GET /stats/monthly` — monthly aggregated stats from `models/statsModel.js`

- Resin service: `/resin`
  - `GET /resin/volumes` — returns latest resin volumes for all printers (populated by `services/resinService.js` which listens on TCP/WS and polls API)

**Auth & Middleware**
- `middleware/auth.js` validates JWT and sets `req.user`.
- `middleware/isAdmin.js` restricts admin endpoints.
- `middleware/logger.js` logs each request.

**Background services**
- `services/printerService.js` — logs into API (if configured), loads printers and polls each printer `/progress` endpoint to update printer and job state. It also exposes an internal endpoint `/printer-logs` used by printers to POST logs.
- `services/resinService.js` — runs a TCP and WebSocket server to receive resin sensor measurements and JSON messages from printers; converts pF readings to percent and writes logs.
- `services/queueWorker.js` — polls queued jobs and sends the CAD file via multipart/form-data to printers' `/send` endpoint, updates job/printer status.

**Developer notes**
- Database access is synchronous via `better-sqlite3`. Keep long-running tasks off the main request thread.
- `uploadController` unpacks ZIPs; it avoids path-traversal by rejecting entries with `..` or absolute paths.
- `printerService` and `resinService` expect printers to expose simple HTTP endpoints (e.g., `/progress`, `/send`) or connect via TCP/WS to report sensor data.

**Common env examples**
```env
JWT_SECRET=replace-with-a-long-random-secret
CAMERA_STREAM_TICKET_SECRET=replace-with-another-long-random-secret
SMART_MODULE_KEY_ENCRYPTION_KEY=replace-with-base64-encoded-32-byte-key
SMART_MODULE_ALLOWED_CIDRS=192.168.0.0/16
DEFAULT_ADMIN_NAME=Admin
DEFAULT_ADMIN_EMAIL=admin@example.com
DEFAULT_ADMIN_PASSWORD=replace-with-a-strong-password
API_BASE_URL=http://localhost:3000
SERVICE_EMAIL=service@example.com
SERVICE_PASSWORD=servicepwd
PRINTER_DEFAULT_PORT=5000
WS_PORT=6000
TCP_PORT=5000
```

**Troubleshooting**
- If printers aren't updating: ensure `PRINTER_DEFAULT_PORT` matches printer HTTP server port and that `ipAddress`/`sensorIp` fields on `printers` are correct.
- If resin readings don't appear: check `resinService` ports (`TCP_PORT`/`WS_PORT`) and sensor connections; logs are recorded in the `logs` table.
- To reset DB while developing: stop server and remove `database.sqlite` (data loss) then restart to recreate tables.

**Where to look in code**
- Main entry: `server.js`
- Routes: `routes/` — see individual route files
- Controllers: `controllers/` — behavior for API endpoints
- Models: `models/` — DB access via `db.js` and models like `printModel.js`, `printerModel.js`
- Services: `services/` — background workers and sensor listeners
