import { useId, useState } from "react";
import {
  Thermometer,
  Wind,
  Radio,
  Zap,
  Wifi,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowLeft,
  Gauge,
} from "lucide-react";

import { Card } from "./ui/card";
import { Progress } from "./ui/progress";
import { PrinterSelector } from "./PrinterSelector";
import {
  normalizeEnabledSensors,
  PrinterSummary,
  SensorType,
} from "../types/printers";
import {
  Sensor,
  SensorStatus,
  TrendPoint,
  useSensorReadings,
} from "./hooks/useSensorReadings";

import {
  AreaChart,
  Area,
  Tooltip,
  ResponsiveContainer,
} from "recharts";


// Status styles
const STATUS_DOT: Record<
  SensorStatus,
  string
> = {
  Normal: "bg-green-500",
  Warning: "bg-yellow-500",
  Critical: "bg-red-500",
  Unavailable: "bg-slate-400",
};


const STATUS_BADGE: Record<
  SensorStatus,
  string
> = {
  Normal:
    "bg-green-100 text-green-700 border-green-200",

  Warning:
    "bg-yellow-100 text-yellow-700 border-yellow-200",

  Critical:
    "bg-red-100 text-red-700 border-red-200",

  Unavailable:
    "bg-slate-100 text-slate-600 border-slate-200",
};


const STATUS_AREA: Record<
  SensorStatus,
  string
> = {
  Normal: "#0082be",
  Warning: "#d97706",
  Critical: "#dc2626",
  Unavailable: "#94a3b8",
};

function getSensorType(sensor: Sensor): SensorType {
  if (sensor.id === "pir") return "pir";
  if (sensor.id.startsWith("analog")) return "mcp3008";
  return "bme280";
}


// ─────────────────────────────────────────────────────────────
// Mini Chart
// ─────────────────────────────────────────────────────────────

function MiniChart({
  trend,
  status,
}: {
  trend: TrendPoint[];
  status: SensorStatus;
}) {

  const gradientId = useId().replace(/:/g, "");

  const color =
    STATUS_AREA[status];


  return (
    <ResponsiveContainer
      width="100%"
      height={52}
    >
      <AreaChart
        data={trend}
        margin={{
          top: 2,
          right: 0,
          left: 0,
          bottom: 0,
        }}
      >

        <defs>

          <linearGradient
            id={gradientId}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >

            <stop
              offset="5%"
              stopColor={color}
              stopOpacity={0.15}
            />

            <stop
              offset="95%"
              stopColor={color}
              stopOpacity={0}
            />

          </linearGradient>

        </defs>


        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#${gradientId})`}
          dot={false}
          isAnimationActive={false}
        />


        <Tooltip
          contentStyle={{
            background: "#fff",
            border:
              "1px solid #e2e8f0",
            borderRadius: 6,
            fontSize: 11,
            padding: "2px 8px",
          }}
          formatter={(value: number) => [
            value,
            "",
          ]}
          labelFormatter={() => ""}
        />

      </AreaChart>
    </ResponsiveContainer>
  );
}


// ─────────────────────────────────────────────────────────────
// Sensor Card
// ─────────────────────────────────────────────────────────────

function SensorCard({
  sensor,
}: {
  sensor: Sensor;
}) {

  const statusDot =
    STATUS_DOT[sensor.status];

  const statusBadge =
    STATUS_BADGE[sensor.status];


  const Icon =
    sensor.id === "temp"
      ? Thermometer

      : sensor.id === "humidity"
        ? Wind

        : sensor.id === "pressure"
          ? Gauge

          : sensor.id === "pir"
            ? Radio

            : Zap;


  const iconBg =
    sensor.status === "Unavailable"
      ? "bg-slate-100"

      : sensor.status === "Warning"
      ? "bg-yellow-100"

      : sensor.status === "Critical"
        ? "bg-red-100"

        : "bg-[var(--brand-blue-light)]";


  const iconColor =
    sensor.status === "Unavailable"
      ? "text-slate-500"

      : sensor.status === "Warning"
      ? "text-yellow-600"

      : sensor.status === "Critical"
        ? "text-red-600"

        : "text-[var(--brand-blue)]";


  return (

    <Card className="p-6 flex flex-col gap-4">

      {/* Header */}

      <div className="flex items-start justify-between">

        <div className="flex items-center gap-3">

          <div
            className={`p-2.5 rounded-lg ${iconBg}`}
          >

            <Icon
              className={`w-4 h-4 ${iconColor}`}
            />

          </div>


          <div>

            <div className="flex items-center gap-2">

              <div
                className={`w-2.5 h-2.5 rounded-full ${statusDot}`}
              />

              <h3 className="text-slate-900 text-base">
                {sensor.label}
              </h3>

            </div>


            {sensor.id.startsWith(
              "analog",
            ) && (

              <p className="text-xs text-slate-400 mt-0.5">
                MCP3008 ADC
              </p>

            )}

          </div>

        </div>


        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusBadge}`}
        >
          {sensor.status}
        </span>

      </div>


      {/* PIR */}

      {sensor.isPir ? (

        <div
          className={`rounded-lg px-4 py-3 ${
            sensor.status === "Unavailable"
              ? "bg-slate-50"
              : sensor.pirActive
              ? "bg-yellow-50"
              : "bg-slate-50"
          }`}
        >

          <p
            className={`text-sm font-medium ${
              sensor.status === "Unavailable"
                ? "text-slate-500"
                : sensor.pirActive
                ? "text-yellow-800"
                : "text-slate-600"
            }`}
          >

            {sensor.status === "Unavailable"
              ? "Sensor unavailable"
              : sensor.pirActive
              ? "Motion detected"
              : "No motion detected"}

          </p>

        </div>

      ) : (

        <div>

          <div className="flex items-baseline gap-1">

            <span className="text-3xl text-slate-900 font-light">
              {sensor.status === "Unavailable" && sensor.updatedAt === "-"
                ? "—"
                : sensor.value}
            </span>

            <span className="text-base text-slate-500">
              {sensor.unit}
            </span>

          </div>


          {sensor.showProgress && sensor.status !== "Unavailable" && (

            <div className="mt-2">

              <Progress
                value={sensor.value}
                className="h-1.5"
              />

            </div>

          )}

        </div>

      )}


      {/* Graph */}

      {!sensor.isPir && (

        <div className="-mx-1">

          <MiniChart
            trend={sensor.trend}
            status={sensor.status}
          />

        </div>

      )}


      {/* Footer */}

      <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100">

        <Clock className="w-3 h-3 text-slate-400" />

        <p className="text-xs text-slate-400">
          {sensor.status === "Unavailable" ? "Last valid update" : "Updated"} {sensor.updatedAt}
        </p>

      </div>

    </Card>
  );
}


// ─────────────────────────────────────────────────────────────
// Module Status
// ─────────────────────────────────────────────────────────────

function ModuleStatusCard({
  connected,
  lastSeen,
  printerName,
  moduleId,
  ip,
  safetyStatus,
  printerStatus,
}: {
  connected: boolean;

  lastSeen: string;

  printerName?: string;
  moduleId?: string;
  ip?: string;

  safetyStatus: string;
  printerStatus: string;
}) {

  return (

    <Card className="p-6">

      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">

        <div className="flex items-center gap-4 flex-1">

          <div
            className={`p-3 rounded-lg ${
              connected
                ? "bg-[var(--brand-blue-light)]"
                : "bg-red-100"
            }`}
          >

            <Wifi
              className={`w-5 h-5 ${
                connected
                  ? "text-[var(--brand-blue)]"
                  : "text-red-600"
              }`}
            />

          </div>


          <div>

            <div className="flex items-center gap-2 mb-0.5">

              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  connected
                    ? "bg-green-500"
                    : "bg-red-500"
                }`}
              />

              <h3 className="text-slate-900">

                Smart Module —{" "}
                {printerName ?? "Printer"}

              </h3>

            </div>


            <p className="text-sm text-slate-500">

              {ip ?? "No IP"}

              {" · "}

              {moduleId ?? "No Module ID"}

            </p>

          </div>

        </div>


        <div className="grid grid-cols-3 gap-6 text-center">

          <div>

            <p className="text-xs text-slate-500">
              Safety
            </p>

            <p className="text-sm text-slate-900">
              {safetyStatus}
            </p>

          </div>


          <div>

            <p className="text-xs text-slate-500">
              Printer
            </p>

            <p className="text-sm text-slate-900">
              {printerStatus}
            </p>

          </div>


          <div>

            <p className="text-xs text-slate-500">
              Last seen
            </p>

            <p className="text-sm text-slate-900">
              {lastSeen}
            </p>

          </div>

        </div>


        <div className="hidden sm:block">

          {connected ? (

            <div className="flex items-center gap-1.5 text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">

              <CheckCircle2 className="w-4 h-4" />

              <span className="text-sm font-medium">
                Online
              </span>

            </div>

          ) : (

            <div className="flex items-center gap-1.5 text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">

              <XCircle className="w-4 h-4" />

              <span className="text-sm font-medium">
                Offline
              </span>

            </div>

          )}

        </div>

      </div>

    </Card>
  );
}


// ─────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────

function SummaryStrip({
  sensors,
}: {
  sensors: Sensor[];
}) {

  const normal =
    sensors.filter(
      (sensor) =>
        sensor.status === "Normal",
    ).length;


  const warnings =
    sensors.filter(
      (sensor) =>
        sensor.status === "Warning",
    ).length;


  const critical =
    sensors.filter(
      (sensor) =>
        sensor.status === "Critical",
    ).length;


  const unavailable =
    sensors.filter(
      (sensor) =>
        sensor.status === "Unavailable",
    ).length;


  return (

    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 pt-4">

      <Card className="p-5">

        <div className="flex items-center gap-4">

          <div className="p-3 bg-green-100 rounded-lg">

            <CheckCircle2 className="w-5 h-5 text-green-600" />

          </div>

          <div>

            <p className="text-sm text-slate-500">
              Normal
            </p>

            <p className="text-2xl text-slate-900">
              {normal}
            </p>

          </div>

        </div>

      </Card>


      <Card className="p-5">

        <div className="flex items-center gap-4">

          <div className="p-3 bg-yellow-100 rounded-lg">

            <AlertTriangle className="w-5 h-5 text-yellow-600" />

          </div>

          <div>

            <p className="text-sm text-slate-500">
              Warnings
            </p>

            <p className="text-2xl text-slate-900">
              {warnings}
            </p>

          </div>

        </div>

      </Card>


      <Card className="p-5">

        <div className="flex items-center gap-4">

          <div className="p-3 bg-red-100 rounded-lg">

            <XCircle className="w-5 h-5 text-red-600" />

          </div>

          <div>

            <p className="text-sm text-slate-500">
              Critical
            </p>

            <p className="text-2xl text-slate-900">
              {critical}
            </p>

          </div>

        </div>

      </Card>


      <Card className="p-5">

        <div className="flex items-center gap-4">

          <div className="p-3 bg-slate-100 rounded-lg">

            <Wifi className="w-5 h-5 text-slate-500" />

          </div>

          <div>

            <p className="text-sm text-slate-500">
              Unavailable
            </p>

            <p className="text-2xl text-slate-900">
              {unavailable}
            </p>

          </div>

        </div>

      </Card>

    </div>
  );
}


// ─────────────────────────────────────────────────────────────
// Sensor Detail
// ─────────────────────────────────────────────────────────────

function SensorsDetail({
  printer,
  onBack,
}: {
  printer: PrinterSummary;
  onBack: () => void;
}) {

  const {
    sensors,
    connected,
    lastSeen,
    safetyStatus,
    printerStatus,
  } = useSensorReadings(String(printer.id));
  const enabledSensors = normalizeEnabledSensors(printer.enabledSensors);
  const visibleSensors = sensors.filter((sensor) =>
    enabledSensors.includes(getSensorType(sensor)),
  );
  return (

    <div className="space-y-8 pt-6">

      {/* Navigation */}

      <div className="flex items-center gap-3">

        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 transition-colors"
        >

          <ArrowLeft className="w-4 h-4" />

          <span className="text-sm">
            All Printers
          </span>

        </button>


        <span className="text-slate-300">
          /
        </span>


        <span className="text-sm text-slate-900 font-medium">
          {printer.name}
        </span>


        <span className="text-slate-300">
          —
        </span>


        <span className="text-sm text-slate-500">

          {printer.location}

          {" · "}

          {printer.moduleId}

        </span>

      </div>


      {/* Smart Module status */}

      <ModuleStatusCard
        connected={connected}
        lastSeen={lastSeen}
        printerName={printer.name}
        moduleId={printer.moduleId}
        ip={printer.raspberryPiIp}
        safetyStatus={safetyStatus}
        printerStatus={printerStatus}
      />


      {/* Summary */}

      <SummaryStrip
        sensors={visibleSensors}
      />


      {/* Sensors */}

      <div>

        <h2 className="text-slate-900 mb-4">
          Live Sensor Readings
        </h2>


        {visibleSensors.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

            {visibleSensors.map(
              (sensor) => (

                <div key={sensor.id}>

                  <SensorCard
                    sensor={sensor}
                  />

                </div>

              ),
            )}

          </div>
        ) : (
          <Card className="p-8 text-center">
            <p className="text-slate-900">No dashboard sensors enabled</p>
            <p className="mt-1 text-sm text-slate-500">
              Enable a sensor in this printer&apos;s configuration to show its readings here.
            </p>
          </Card>
        )}

      </div>

    </div>
  );
}


// ─────────────────────────────────────────────────────────────
// Public View
// ─────────────────────────────────────────────────────────────

export function SensorsView() {

  const [
    selected,
    setSelected,
  ] =
    useState<PrinterSummary | null>(
      null,
    );


  if (!selected) {

    return (

      <PrinterSelector
        title="Sensor Monitoring"
        description="Select a printer to view its Smart Module sensor readings."
        onSelect={setSelected}
      />

    );
  }


  return (

    <SensorsDetail
      printer={selected}
      onBack={() =>
        setSelected(null)
      }
    />

  );
}
