import { useEffect, useRef, useState } from "react";
import { Activity, AlertTriangle, ArrowLeft, Camera, CheckCircle2, Eye, WifiOff } from "lucide-react";
import { Card } from "./ui/card";
import { PrinterSelector } from "./PrinterSelector";
import { PrinterSummary } from "../types/printers";
import { logEvent } from "../lib/logEvent";
import { asFiniteNumber, isRecord } from "../lib/smartModule";
import { API_BASE_URL } from "../lib/api";
import { getAuthHeaders } from "../lib/auth";

const CAM_W = 640;
const CAM_H = 480;
const POLL_MS = 500;
const REQUEST_TIMEOUT_MS = 4_000;
const TRACK_CONFIRMATION_POLLS = 2;
const TRACK_MISSING_POLLS = 3;

interface CameraStreamSession {
  streamUrl: string;
  expiresAt: number;
}

// Kept in module memory so navigating within the SPA cannot silently start a
// second one-hour session. A full browser refresh clears this state.
const pageStreamSessions = new Map<string, CameraStreamSession>();
const expiredPageStreamSessions = new Set<string>();

type DetectionStatus = "clear" | "warning" | "alert";

interface Detection {
  id: string;
  sourceId?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  conf: number;
  zone: string;
  status: DetectionStatus;
}

interface DetectionEvent {
  id: string;
  time: string;
  zone: string;
  track: string;
  conf: number;
  status: "Warning" | "Clear" | "Alert";
}

interface PiDetection {
  bbox: [number, number, number, number];
  confidence: number;
  label: string;
  trackId?: string;
}

interface PiData {
  timestamp: number;
  personCount: number;
  fps: number;
  detections: PiDetection[];
}

interface Track {
  detection: Detection;
  hits: number;
  misses: number;
  announced: boolean;
}

function nowStr() {
  return new Date().toTimeString().slice(0, 8);
}

function zoneFromX(centerXPct: number): string {
  if (centerXPct < 33) return "Zone A";
  if (centerXPct < 66) return "Zone B";
  return "Zone C";
}

function parseTrackId(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const id = String(value).trim();
  if (!id) return undefined;
  return id.toUpperCase().startsWith("TRK-") ? id : `TRK-${id}`;
}

function parsePiData(value: unknown): PiData | null {
  if (!isRecord(value) || !Array.isArray(value.detections)) return null;

  const timestamp = asFiniteNumber(value.timestamp);
  const personCount = asFiniteNumber(value.person_count);
  const fps = asFiniteNumber(value.fps);
  if (timestamp === null || personCount === null || fps === null) return null;

  const detections: PiDetection[] = [];
  for (const item of value.detections) {
    if (!isRecord(item) || !Array.isArray(item.bbox) || item.bbox.length !== 4) return null;

    const bboxValues = item.bbox.map(asFiniteNumber);
    const confidence = asFiniteNumber(item.confidence);
    if (bboxValues.some((coordinate) => coordinate === null) || confidence === null) return null;

    detections.push({
      bbox: bboxValues as [number, number, number, number],
      confidence: Math.max(0, Math.min(1, confidence)),
      label: typeof item.label === "string" ? item.label : "person",
      trackId: parseTrackId(item.track_id ?? item.trackId ?? item.id),
    });
  }

  return {
    timestamp,
    personCount: Math.max(0, Math.floor(personCount)),
    fps: Math.max(0, fps),
    detections,
  };
}

function mapPiDetection(detection: PiDetection): Omit<Detection, "id"> {
  const [x1, y1, x2, y2] = detection.bbox;
  const x = Math.max(0, Math.min(100, (x1 / CAM_W) * 100));
  const y = Math.max(0, Math.min(100, (y1 / CAM_H) * 100));
  const w = Math.max(0, Math.min(100 - x, ((x2 - x1) / CAM_W) * 100));
  const h = Math.max(0, Math.min(100 - y, ((y2 - y1) / CAM_H) * 100));
  const area = w * h;
  const status: DetectionStatus =
    area > 900 ? "alert" : detection.confidence >= 0.65 ? "warning" : "clear";

  return {
    sourceId: detection.trackId,
    x,
    y,
    w,
    h,
    conf: detection.confidence,
    zone: zoneFromX(x + w / 2),
    status,
  };
}

function centerDistance(
  a: Pick<Detection, "x" | "y" | "w" | "h">,
  b: Pick<Detection, "x" | "y" | "w" | "h">,
) {
  return Math.hypot(
    a.x + a.w / 2 - (b.x + b.w / 2),
    a.y + a.h / 2 - (b.y + b.h / 2),
  );
}

function reconcileTracks(
  previous: Map<string, Track>,
  incoming: Array<Omit<Detection, "id">>,
  nextLocalId: () => string,
) {
  const next = new Map<string, Track>();
  const matchedPreviousIds = new Set<string>();
  const entered: Detection[] = [];
  const left: Detection[] = [];

  for (const candidate of incoming) {
    let existing: Track | undefined;
    if (candidate.sourceId) {
      existing = previous.get(candidate.sourceId);
    } else {
      existing = [...previous.values()]
        .filter((track) => !matchedPreviousIds.has(track.detection.id))
        .map((track) => ({ track, distance: centerDistance(track.detection, candidate) }))
        .filter(({ distance }) => distance <= 18)
        .sort((a, b) => a.distance - b.distance)[0]?.track;
    }

    const id = candidate.sourceId ?? existing?.detection.id ?? nextLocalId();
    if (existing) matchedPreviousIds.add(existing.detection.id);

    const detection: Detection = { ...candidate, id };
    const hits = existing ? existing.hits + 1 : 1;
    const track: Track = {
      detection,
      hits,
      misses: 0,
      announced: existing?.announced ?? false,
    };
    if (!track.announced && hits >= TRACK_CONFIRMATION_POLLS) {
      track.announced = true;
      entered.push(detection);
    }
    next.set(id, track);
  }

  for (const [id, track] of previous) {
    if (matchedPreviousIds.has(id) || next.has(id)) continue;
    const missedTrack = { ...track, misses: track.misses + 1 };
    if (missedTrack.misses >= TRACK_MISSING_POLLS) {
      if (missedTrack.announced) left.push(missedTrack.detection);
    } else {
      next.set(id, missedTrack);
    }
  }

  return {
    tracks: next,
    visible: [...next.values()]
      .filter((track) => track.misses === 0)
      .map((track) => track.detection),
    entered,
    left,
  };
}

const STATUS_STYLES: Record<DetectionStatus, {
  border: string;
  labelBg: string;
  labelText: string;
  badge: string;
  dot: string;
}> = {
  warning: { border: "#d97706", labelBg: "#d97706", labelText: "#fff", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  alert: { border: "#dc2626", labelBg: "#dc2626", labelText: "#fff", badge: "bg-red-100 text-red-700", dot: "bg-red-500" },
  clear: { border: "#16a34a", labelBg: "#16a34a", labelText: "#fff", badge: "bg-green-100 text-green-700", dot: "bg-green-500" },
};

function BoundingBox({ det }: { det: Detection }) {
  const styles = STATUS_STYLES[det.status];
  return (
    <div
      className="absolute transition-all duration-500 ease-linear"
      style={{
        left: `${det.x}%`, top: `${det.y}%`, width: `${det.w}%`, height: `${det.h}%`,
        border: `2px solid ${styles.border}`, borderRadius: 2,
      }}
    >
      <div
        className="absolute flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap rounded-sm"
        style={{ bottom: "calc(100% + 3px)", left: -2, background: styles.labelBg, color: styles.labelText, fontSize: 10, letterSpacing: "0.04em" }}
      >
        PERSON &nbsp;{det.conf.toFixed(2)}
      </div>
      <div
        className="absolute text-[9px] font-mono px-1"
        style={{ top: "calc(100% + 3px)", left: -2, color: styles.border, fontSize: 9 }}
      >
        {det.id}
      </div>
    </div>
  );
}

function CameraDetail({ printer, onBack }: { printer: PrinterSummary; onBack: () => void }) {
  const printerId = String(printer.id);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [events, setEvents] = useState<DetectionEvent[]>([]);
  const [fps, setFps] = useState(0);
  const [systemTime, setSystemTime] = useState(nowStr());
  const [detectionConnected, setDetectionConnected] = useState(false);
  const [videoConnected, setVideoConnected] = useState(false);
  const [streamKey, setStreamKey] = useState(0);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [streamExpired, setStreamExpired] = useState(false);

  const eventIdRef = useRef(0);
  const localTrackIdRef = useRef(0);
  const tracksRef = useRef<Map<string, Track>>(new Map());
  const streamRetryTimerRef = useRef<number>();
  const streamRetryDelayRef = useRef(2_000);

  useEffect(() => {
    const timer = window.setInterval(() => setSystemTime(nowStr()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let disposed = false;
    let pollTimer: number | undefined;
    let activeController: AbortController | undefined;

    tracksRef.current = new Map();
    setDetections([]);
    setFps(0);
    setDetectionConnected(false);

    async function poll() {
      if (disposed) return;

      const controller = new AbortController();
      activeController = controller;
      const requestTimer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(
          `${API_BASE_URL}/printers/${encodeURIComponent(printerId)}/smart-module/camera/detections`,
          {
            signal: controller.signal,
            cache: "no-store",
            headers: getAuthHeaders(),
          },
        );
        if (!response.ok) throw new Error(`Detection API returned HTTP ${response.status}`);

        const data = parsePiData(await response.json());
        if (!data) throw new Error("Detection API returned invalid data");
        if (disposed) return;

        const tracking = reconcileTracks(
          tracksRef.current,
          data.detections.map(mapPiDetection),
          () => `TRK-${String(++localTrackIdRef.current).padStart(3, "0")}`,
        );
        tracksRef.current = tracking.tracks;
        setDetections(tracking.visible);
        setFps(data.fps);
        setDetectionConnected(true);

        const newEvents: DetectionEvent[] = [
          ...tracking.entered.map((detection) => ({
            id: `e${++eventIdRef.current}`,
            time: nowStr(), zone: detection.zone, track: detection.id, conf: detection.conf,
            status: detection.status === "alert" ? "Alert" as const : "Warning" as const,
          })),
          ...tracking.left.map((detection) => ({
            id: `e${++eventIdRef.current}`,
            time: nowStr(), zone: detection.zone, track: detection.id, conf: detection.conf,
            status: "Clear" as const,
          })),
        ];
        if (newEvents.length > 0) {
          setEvents((previous) => [...newEvents, ...previous].slice(0, 50));
        }

        tracking.entered.forEach((detection) => {
          void logEvent(
            detection.status === "alert" ? "error" : "warning",
            "Camera",
            `Persoon gedetecteerd in ${detection.zone} (${detection.id}, conf: ${detection.conf.toFixed(2)})`,
          );
        });
        tracking.left.forEach((detection) => {
          void logEvent("info", "Camera", `Persoon verliet het beeld (${detection.id})`);
        });
      } catch {
        if (!disposed) {
          setDetectionConnected(false);
          setDetections([]);
          setFps(0);
        }
      } finally {
        window.clearTimeout(requestTimer);
        if (activeController === controller) activeController = undefined;
        if (!disposed) pollTimer = window.setTimeout(poll, POLL_MS);
      }
    }

    void poll();
    return () => {
      disposed = true;
      activeController?.abort();
      if (pollTimer !== undefined) window.clearTimeout(pollTimer);
    };
  }, [printerId]);

  useEffect(() => {
    let disposed = false;
    let expiryTimer: number | undefined;

    const expireSession = () => {
      expiredPageStreamSessions.add(printerId);
      setStreamExpired(true);
      setStreamUrl(null);
      setVideoConnected(false);
    };

    const applySession = (session: CameraStreamSession) => {
      const remainingMs = session.expiresAt - Date.now();
      if (remainingMs <= 0) {
        expireSession();
        return;
      }
      setStreamUrl(session.streamUrl);
      setStreamExpired(false);
      expiryTimer = window.setTimeout(expireSession, remainingMs);
    };

    const existing = pageStreamSessions.get(printerId);
    if (expiredPageStreamSessions.has(printerId)) {
      expireSession();
    } else if (existing) {
      applySession(existing);
    } else {
      void (async () => {
        try {
          const response = await fetch(
            `${API_BASE_URL}/printers/${encodeURIComponent(printerId)}/smart-module/camera/stream-ticket`,
            {
              method: "POST",
              headers: getAuthHeaders(),
            },
          );
          if (!response.ok) throw new Error(`Stream ticket returned HTTP ${response.status}`);
          const data = await response.json();
          const expiresAt = Date.parse(data.expiresAt);
          if (typeof data.streamUrl !== "string" || !Number.isFinite(expiresAt)) {
            throw new Error("Stream ticket response is invalid");
          }
          const session = {
            streamUrl: new URL(data.streamUrl, `${API_BASE_URL}/`).toString(),
            expiresAt,
          };
          pageStreamSessions.set(printerId, session);
          if (!disposed) applySession(session);
        } catch {
          if (!disposed) {
            setStreamUrl(null);
            setVideoConnected(false);
          }
        }
      })();
    }

    return () => {
      disposed = true;
      if (expiryTimer !== undefined) window.clearTimeout(expiryTimer);
    };
  }, [printerId]);

  useEffect(() => {
    setVideoConnected(false);
    setStreamKey((key) => key + 1);
    streamRetryDelayRef.current = 2_000;
    return () => {
      if (streamRetryTimerRef.current !== undefined) {
        window.clearTimeout(streamRetryTimerRef.current);
        streamRetryTimerRef.current = undefined;
      }
    };
  }, [streamUrl]);

  const handleStreamLoad = () => {
    setVideoConnected(true);
    streamRetryDelayRef.current = 2_000;
    if (streamRetryTimerRef.current !== undefined) {
      window.clearTimeout(streamRetryTimerRef.current);
      streamRetryTimerRef.current = undefined;
    }
  };

  const handleStreamError = () => {
    setVideoConnected(false);
    if (!streamUrl || streamExpired || streamRetryTimerRef.current !== undefined) return;
    const delay = streamRetryDelayRef.current;
    streamRetryTimerRef.current = window.setTimeout(() => {
      streamRetryTimerRef.current = undefined;
      setStreamKey((key) => key + 1);
    }, delay);
    streamRetryDelayRef.current = Math.min(delay * 2, 30_000);
  };

  const warningCount = detections.filter((detection) => detection.status === "warning").length;
  const alertCount = detections.filter((detection) => detection.status === "alert").length;
  const clearCount = detections.filter((detection) => detection.status === "clear").length;

  const renderTrack = (detection: Detection) => {
    const styles = STATUS_STYLES[detection.status];
    return (
      <div key={detection.id} className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${styles.dot}`} />
        <span className="text-sm font-mono text-slate-700 flex-1">{detection.id}</span>
        <span className="text-sm text-slate-500">{detection.zone}</span>
        <span className="text-sm font-mono text-slate-700">{detection.conf.toFixed(2)}</span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles.badge}`}>
          {detection.status.charAt(0).toUpperCase() + detection.status.slice(1)}
        </span>
      </div>
    );
  };

  const renderEvent = (event: DetectionEvent, index: number) => {
    const statusColor = event.status === "Warning" ? "text-amber-600" : event.status === "Alert" ? "text-red-600" : "text-green-600";
    const dotColor = event.status === "Warning" ? "bg-amber-400" : event.status === "Alert" ? "bg-red-500" : "bg-green-500";
    return (
      <div key={event.id} className="flex items-start gap-3" style={{ opacity: Math.max(0.3, 1 - index * 0.045) }}>
        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${dotColor}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={`text-sm font-medium ${statusColor}`}>{event.status}</span>
            <span className="text-xs text-slate-400 font-mono flex-shrink-0">{event.time}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-slate-500">{event.zone}</span><span className="text-slate-300">·</span>
            <span className="text-xs font-mono text-slate-500">{event.track}</span><span className="text-slate-300">·</span>
            <span className="text-xs font-mono text-slate-500">{event.conf.toFixed(2)}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 transition-colors">
          <ArrowLeft className="w-4 h-4" /><span className="text-sm">All Printers</span>
        </button>
        <span className="text-slate-300">/</span><span className="text-sm text-slate-900 font-medium">{printer.name}</span>
        <span className="text-slate-300">—</span><span className="text-sm text-slate-500">{printer.location} · {printer.moduleId}</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-10">
        <Card className="p-5"><div className="flex items-center gap-4"><div className="p-3 bg-[var(--brand-blue-light)] rounded-lg"><Eye className="w-5 h-5 text-[var(--brand-blue)]" /></div><div><p className="text-sm text-slate-500">Tracked</p><p className="text-2xl text-slate-900">{detections.length}</p></div></div></Card>
        <Card className="p-5"><div className="flex items-center gap-4"><div className="p-3 bg-green-100 rounded-lg"><CheckCircle2 className="w-5 h-5 text-green-600" /></div><div><p className="text-sm text-slate-500">Clear</p><p className="text-2xl text-slate-900">{clearCount}</p></div></div></Card>
        <Card className="p-5"><div className="flex items-center gap-4"><div className="p-3 bg-amber-100 rounded-lg"><AlertTriangle className="w-5 h-5 text-amber-600" /></div><div><p className="text-sm text-slate-500">Warnings</p><p className="text-2xl text-slate-900">{warningCount}</p></div></div></Card>
        <Card className="p-5"><div className="flex items-center gap-4"><div className="p-3 bg-red-100 rounded-lg"><Activity className="w-5 h-5 text-red-600" /></div><div><p className="text-sm text-slate-500">Alerts</p><p className="text-2xl text-slate-900">{alertCount}</p></div></div></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 overflow-hidden p-4">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
            <div className="flex items-center gap-3"><Camera className="w-5 h-5 text-slate-600" /><div><h3 className="text-slate-900">CAM-{printer.id} — {printer.location}</h3><p className="text-sm text-slate-500">{printer.moduleId} · Persoonsdetectie</p></div></div>
            <div className="flex items-center gap-3">
              {videoConnected ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-100 text-red-700 text-xs font-medium"><span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />Live</span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-xs font-medium"><WifiOff className="w-3 h-3" />Offline</span>
              )}
              <span className="text-sm text-slate-400">{detectionConnected && fps > 0 ? `${fps} fps` : "— fps"}</span>
            </div>
          </div>
          <div className="p-2">
            <div className="relative bg-slate-800 overflow-hidden rounded-sm" style={{ width: 1280, height: 720 }}>
              {streamUrl && !streamExpired && <img key={streamKey} src={streamUrl} referrerPolicy="no-referrer" alt="Live camera feed" className="absolute inset-0 w-full h-full" style={{ objectFit: "fill" }} onError={handleStreamError} onLoad={handleStreamLoad} />}
              {!videoConnected && <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-800"><WifiOff className="w-8 h-8 text-slate-500" /><p className="text-sm text-slate-400">{streamExpired ? "Streamsessie verlopen" : "Verbinding maken met camera…"}</p><p className="text-xs text-slate-500">{streamExpired ? "Vernieuw de pagina om opnieuw verbinding te maken." : "De beveiligde camerastream is nog niet beschikbaar."}</p></div>}
              {videoConnected && detections.map((detection) => <BoundingBox key={detection.id} det={detection} />)}
              {videoConnected && <div className="absolute bottom-3 left-3 flex flex-col items-start gap-0.5 pointer-events-none"><span className="text-xs font-mono text-white/60">{systemTime}</span><span className="text-xs font-mono text-white/60">{fps > 0 ? `${fps} fps` : ""}</span></div>}
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-1 overflow-hidden p-4 flex flex-col">
          <div className="px-4 py-3 border-b border-slate-200 flex-shrink-0"><h3 className="text-slate-900">Detection Log</h3><p className="text-sm text-slate-500 mt-0.5">{events.length} events recorded</p></div>
          <div className="px-4 py-3 border-b border-slate-100 flex-shrink-0"><p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Active Tracks</p>{detections.length === 0 ? <p className="text-xs text-slate-400 italic">Geen personen gedetecteerd</p> : <div className="space-y-2">{detections.map(renderTrack)}</div>}</div>
          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}><div className="px-4 py-3"><p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Recent Events</p>{events.length === 0 ? <p className="text-xs text-slate-400 italic">Geen events</p> : <div className="space-y-3">{events.map(renderEvent)}</div>}</div></div>
        </Card>
      </div>
    </div>
  );
}

export function CameraView() {
  const [selected, setSelected] = useState<PrinterSummary | null>(null);
  if (!selected) {
    return <PrinterSelector title="Camera View" description="Select a printer to view its live camera feed." onSelect={setSelected} />;
  }
  return <CameraDetail printer={selected} onBack={() => setSelected(null)} />;
}
