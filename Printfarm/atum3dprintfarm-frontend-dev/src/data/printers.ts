
import { PrinterSummary } from "../types/printers";

export const PRINTERS: PrinterSummary[] = [
  {
    id: "1",
    name: "Printer 01",
    model: "DLP STATION 5-405",
    status: "idle",
    location: "Lab A - Station 1",
    moduleId: "MOD-01",
    serialNumber: "DLP-5405-2024-001",
    ipAddress: "192.168.1.101",
    enabledSensors: ["bme280", "pir", "mcp3008"],
    resinType: "Generic",
    resinLevel: 78,
  },
  {
    id: "2",
    name: "Printer 02",
    model: "DLP STATION 5-365 EXZ",
    status: "printing",
    location: "Lab B - Station 2",
    moduleId: "MOD-02",
    serialNumber: "DLP-5365-2024-002",
    ipAddress: "192.168.1.102",
    enabledSensors: ["bme280", "pir", "mcp3008"],
    resinType: "Wear resistant",
    resinLevel: 42,
  },
];

export default PRINTERS;
