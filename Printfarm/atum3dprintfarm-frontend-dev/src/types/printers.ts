export const SENSOR_TYPES = ["bme280", "pir", "mcp3008"] as const;

export type SensorType = (typeof SENSOR_TYPES)[number];

export const DEFAULT_ENABLED_SENSORS: SensorType[] = [...SENSOR_TYPES];

export function normalizeEnabledSensors(value: unknown): SensorType[] {
  if (
    !Array.isArray(value) ||
    value.some(
      (sensor) =>
        typeof sensor !== "string" ||
        !SENSOR_TYPES.includes(sensor as SensorType),
    ) ||
    new Set(value).size !== value.length
  ) {
    return [...DEFAULT_ENABLED_SENSORS];
  }

  return SENSOR_TYPES.filter((sensor) => value.includes(sensor));
}

export interface PrinterSummary {
  id: string;
  name: string;
  model?: string;
  status: "printing" | "idle" | "error" | "paused" | "maintenance";
  location?: string;
  moduleId?: string;
  serialNumber?: string;
  ipAddress?: string;
  raspberryPiIp?: string;
  enabledSensors: SensorType[];
  smartModuleAuthConfigured?: boolean;
  resinType?: string;
  resinLevel?: number;
  [key: string]: any;
}

export default PrinterSummary;
