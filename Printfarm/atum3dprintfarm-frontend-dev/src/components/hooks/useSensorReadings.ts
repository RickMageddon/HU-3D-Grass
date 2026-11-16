import { useEffect, useState } from "react";
import { API_BASE_URL } from "../../lib/api";
import { getAuthHeaders } from "../../lib/auth";
import { asFiniteNumber, asString, isRecord } from "../../lib/smartModule";

const POLL_MS = 1_000;
const REQUEST_TIMEOUT_MS = 4_000;
const TREND_LENGTH = 20;

export type SensorStatus = "Normal" | "Warning" | "Critical" | "Unavailable";

export interface TrendPoint {
  t: number;
  v: number;
}

export interface Sensor {
  id: string;
  label: string;
  value: number;
  unit: string;
  status: SensorStatus;
  min: number;
  max: number;
  warnLow?: number;
  warnHigh?: number;
  critLow?: number;
  critHigh?: number;
  trend: TrendPoint[];
  updatedAt: string;
  showProgress?: boolean;
  isPir?: boolean;
  pirActive?: boolean;
}

interface SmartModuleSnapshot {
  bme280: {
    connected: boolean;
    temperature: number | null;
    pressure: number | null;
    humidity: number | null;
  };
  pir: {
    connected: boolean;
    ready: boolean;
    motion: boolean | null;
  };
  mcp3008: {
    connected: boolean;
    voltages: Record<string, number | null>;
  };
  safetyStatus: string;
  printerStatus: string;
}

function nowStr() {
  return new Date().toTimeString().slice(0, 8);
}

export function buildInitialSensors(): Sensor[] {
  const sensors: Sensor[] = [
    {
      id: "temp",
      label: "Temperature",
      value: 0,
      unit: "°C",
      status: "Unavailable",
      min: 0,
      max: 50,
      warnHigh: 35,
      critHigh: 42,
      trend: [],
      updatedAt: "-",
    },
    {
      id: "humidity",
      label: "Humidity",
      value: 0,
      unit: "%",
      status: "Unavailable",
      min: 0,
      max: 100,
      warnHigh: 65,
      critHigh: 80,
      trend: [],
      updatedAt: "-",
      showProgress: true,
    },
    {
      id: "pressure",
      label: "Pressure",
      value: 0,
      unit: "Pa",
      status: "Unavailable",
      min: 90000,
      max: 110000,
      trend: [],
      updatedAt: "-",
    },
    {
      id: "pir",
      label: "PIR Motion",
      value: 0,
      unit: "",
      status: "Unavailable",
      min: 0,
      max: 1,
      trend: [],
      updatedAt: "-",
      isPir: true,
      pirActive: false,
    },
  ];

  for (let channel = 0; channel < 8; channel += 1) {
    sensors.push({
      id: `analog${channel}`,
      label: `Analog CH${channel}`,
      value: 0,
      unit: "V",
      status: "Unavailable",
      min: 0,
      max: 3.3,
      warnHigh: 3,
      critHigh: 3.25,
      trend: [],
      updatedAt: "-",
    });
  }

  return sensors;
}

function getStatus(value: number, sensor: Sensor): SensorStatus {
  if (sensor.isPir) return value > 0 ? "Warning" : "Normal";
  if (sensor.critLow !== undefined && value < sensor.critLow) return "Critical";
  if (sensor.critHigh !== undefined && value > sensor.critHigh) return "Critical";
  if (sensor.warnLow !== undefined && value < sensor.warnLow) return "Warning";
  if (sensor.warnHigh !== undefined && value > sensor.warnHigh) return "Warning";
  return "Normal";
}

function parseSmartModuleSnapshot(value: unknown): SmartModuleSnapshot | null {
  if (!isRecord(value) || !isRecord(value.sensors) || !isRecord(value.safety) || !isRecord(value.printer)) {
    return null;
  }

  const bme280 = value.sensors.bme280;
  const pir = value.sensors.pir;
  const mcp3008 = value.sensors.mcp3008;
  if (!isRecord(bme280) || !isRecord(pir) || !isRecord(mcp3008) || !isRecord(mcp3008.channels)) {
    return null;
  }
  if (typeof bme280.connected !== "boolean" || typeof pir.connected !== "boolean" ||
      typeof pir.ready !== "boolean" || typeof mcp3008.connected !== "boolean") {
    return null;
  }

  const voltages: Record<string, number | null> = {};
  for (let channel = 0; channel < 8; channel += 1) {
    const channelData = mcp3008.channels[`ch${channel}`];
    voltages[`ch${channel}`] = isRecord(channelData)
      ? asFiniteNumber(channelData.voltage)
      : null;
  }

  const safetyStatus = asString(value.safety.status);
  const printerStatus = asString(value.printer.status);
  if (safetyStatus === null || printerStatus === null) return null;

  return {
    bme280: {
      connected: bme280.connected,
      temperature: asFiniteNumber(bme280.temperature),
      pressure: asFiniteNumber(bme280.pressure),
      humidity: asFiniteNumber(bme280.humidity),
    },
    pir: {
      connected: pir.connected,
      ready: pir.ready,
      motion: typeof pir.motion === "boolean" ? pir.motion : null,
    },
    mcp3008: { connected: mcp3008.connected, voltages },
    safetyStatus,
    printerStatus,
  };
}

function updateReading(sensor: Sensor, value: number, timestamp: string): Sensor {
  const decimals = sensor.id === "pressure" ? 0 : 3;
  const roundedValue = Number(value.toFixed(decimals));
  const updated: Sensor = {
    ...sensor,
    value: roundedValue,
    trend: sensor.isPir
      ? sensor.trend
      : [...sensor.trend, { t: Date.now(), v: roundedValue }].slice(-TREND_LENGTH),
    updatedAt: timestamp,
    pirActive: sensor.isPir ? value > 0 : sensor.pirActive,
  };
  return { ...updated, status: getStatus(value, updated) };
}

function markUnavailable(sensors: Sensor[]): Sensor[] {
  return sensors.map((sensor) => ({ ...sensor, status: "Unavailable" }));
}

function applySnapshot(sensors: Sensor[], snapshot: SmartModuleSnapshot): Sensor[] {
  const timestamp = nowStr();
  return sensors.map((sensor) => {
    let value: number | null = null;
    let available = false;

    if (sensor.id === "temp") {
      available = snapshot.bme280.connected;
      value = snapshot.bme280.temperature;
    } else if (sensor.id === "humidity") {
      available = snapshot.bme280.connected;
      value = snapshot.bme280.humidity;
    } else if (sensor.id === "pressure") {
      available = snapshot.bme280.connected;
      value = snapshot.bme280.pressure;
    } else if (sensor.id === "pir") {
      available = snapshot.pir.connected && snapshot.pir.ready;
      value = snapshot.pir.motion === null ? null : snapshot.pir.motion ? 1 : 0;
    } else if (sensor.id.startsWith("analog")) {
      available = snapshot.mcp3008.connected;
      value = snapshot.mcp3008.voltages[`ch${sensor.id.replace("analog", "")}`] ?? null;
    }

    if (!available || value === null) return { ...sensor, status: "Unavailable" };
    return updateReading(sensor, value, timestamp);
  });
}

export function useSensorReadings(printerId: string | null) {
  const [sensors, setSensors] = useState<Sensor[]>(buildInitialSensors);
  const [connected, setConnected] = useState(false);
  const [lastSeen, setLastSeen] = useState("-");
  const [safetyStatus, setSafetyStatus] = useState("UNKNOWN");
  const [printerStatus, setPrinterStatus] = useState("UNKNOWN");

  useEffect(() => {
    let disposed = false;
    let pollTimer: number | undefined;
    let activeController: AbortController | undefined;

    setSensors(buildInitialSensors());
    setConnected(false);
    setLastSeen("-");
    setSafetyStatus("UNKNOWN");
    setPrinterStatus(printerId ? "UNKNOWN" : "OFFLINE");

    async function poll() {
      if (!printerId || disposed) return;

      const controller = new AbortController();
      activeController = controller;
      const requestTimer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(
          `${API_BASE_URL}/printers/${encodeURIComponent(printerId)}/smart-module/status`,
          {
            signal: controller.signal,
            cache: "no-store",
            headers: getAuthHeaders(),
          },
        );
        if (!response.ok) throw new Error(`Smart Module returned HTTP ${response.status}`);

        const snapshot = parseSmartModuleSnapshot(await response.json());
        if (!snapshot) throw new Error("Smart Module returned invalid data");
        if (disposed) return;

        setConnected(true);
        setLastSeen(nowStr());
        setSafetyStatus(snapshot.safetyStatus);
        setPrinterStatus(snapshot.printerStatus);
        setSensors((previous) => applySnapshot(previous, snapshot));
      } catch {
        if (!disposed) {
          setConnected(false);
          setSafetyStatus("UNKNOWN");
          setPrinterStatus("OFFLINE");
          setSensors(markUnavailable);
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

  return { sensors, connected, lastSeen, safetyStatus, printerStatus };
}
