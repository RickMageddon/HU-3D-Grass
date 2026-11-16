import { useState } from "react";
import { useEffect } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./ui/alert-dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Printer, Activity, AlertTriangle, Plus, Pencil, Trash2, MapPin, KeyRound, Copy } from "lucide-react";
import { getAuthHeaders, getUser } from "../lib/auth";
import { API_BASE_URL } from "../lib/api";
import {
  DEFAULT_ENABLED_SENSORS,
  normalizeEnabledSensors,
  SensorType,
} from "../types/printers";

type PrinterStatus = "idle" | "printing" | "paused" | "error" | "maintenance";

interface PrinterData {
  id: string;
  name: string;
  model: string;
  status: PrinterStatus;
  location: string;
  serialNumber: string;
  addedDate: string;
  lastMaintenance: string;
  ipAddress: string;
  sensorIp?: string;
  raspberryPiIp?: string;
  enabledSensors: SensorType[];
  smartModuleAuthConfigured?: boolean;
  resinType: string;
  resinLevel: number;
}

const printerModels = [
  "DLP STATION 5-405",
  "DLP STATION 5-365 EXZ",
  "DLP STATION 5-405 EXZ",
];

const resinTypes = [
  "Heat resistant (> 280 °C)",
  "Flame retardant (UL94-V0)",
  "Engineering (ABS/PP/PC-like)",
  "Elastomeric (Silicone-like)",
  "Elastomeric (Hard rubber-like)",
  "Ceramic-filled (High stiffness)",
  "Electro Static Discharge (ESD)",
  "Wear resistant",
  "Chemical resistant",
  "Generic use",
];

const statusColors: Record<PrinterStatus, string> = {
  idle: "bg-slate-100 text-slate-700",
  printing: "bg-green-100 text-green-700",
  paused: "bg-yellow-100 text-yellow-700",
  error: "bg-red-100 text-red-700",
  maintenance: "bg-orange-100 text-orange-700",
};

const sensorOptions: Array<{
  type: SensorType;
  label: string;
  description: string;
}> = [
  {
    type: "bme280",
    label: "BME280",
    description: "Temperature, humidity and pressure",
  },
  {
    type: "pir",
    label: "PIR",
    description: "Motion detection",
  },
  {
    type: "mcp3008",
    label: "MCP3008",
    description: "Eight analog channels",
  },
];

function SensorConfiguration({
  idPrefix,
  enabledSensors,
  onChange,
}: {
  idPrefix: string;
  enabledSensors: SensorType[];
  onChange: (sensors: SensorType[]) => void;
}) {
  const toggleSensor = (sensorType: SensorType, enabled: boolean) => {
    onChange(
      enabled
        ? normalizeEnabledSensors([
            ...enabledSensors.filter((type) => type !== sensorType),
            sensorType,
          ])
        : enabledSensors.filter((type) => type !== sensorType),
    );
  };

  return (
    <div className="col-span-2 space-y-3 rounded-lg border border-slate-200 p-4">
      <div>
        <p className="text-sm font-medium text-slate-900">Dashboard Sensors</p>
        <p className="text-xs text-slate-500">
          Choose which Smart Module readings are visible for this printer.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {sensorOptions.map((sensor) => {
          const id = `${idPrefix}-${sensor.type}`;
          const isEnabled = enabledSensors.includes(sensor.type);
          return (
            <button
              type="button"
              key={sensor.type}
              id={id}
              aria-pressed={isEnabled}
              onClick={() => toggleSensor(sensor.type, !isEnabled)}
              className={`w-full rounded-md border p-3 text-left transition-colors ${
                isEnabled
                  ? "bg-[var(--brand-blue-light)]"
                  : "border-slate-200 bg-slate-50"
              }`}
              style={{
                borderColor: isEnabled ? "var(--brand-blue)" : undefined,
                borderWidth: "2px",
              }}
            >
              <span className="block text-sm text-slate-900">{sensor.label}</span>
              <span className="block text-xs font-normal text-slate-500">
                {sensor.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function createInitialFormData() {
  return {
    name: "",
    model: printerModels[0],
    status: "idle" as PrinterStatus,
    location: "",
    serialNumber: "",
    ipAddress: "",
    sensorIp: "",
    raspberryPiIp: "",
    enabledSensors: [...DEFAULT_ENABLED_SENSORS],
    addedDate: "",
    lastMaintenance: "",
    resinType: resinTypes[0],
    resinLevel: 100,
  };
}

export function PrintersView() {
  const [printers, setPrinters] = useState<PrinterData[]>([]);
  const [notLoggedIn, setNotLoggedIn] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isCredentialDialogOpen, setIsCredentialDialogOpen] = useState(false);
  const [selectedPrinter, setSelectedPrinter] = useState<PrinterData | null>(null);
  const [generatedModuleKey, setGeneratedModuleKey] = useState("");
  const [credentialError, setCredentialError] = useState("");
  const [isRotatingCredential, setIsRotatingCredential] = useState(false);
  const [formData, setFormData] = useState(createInitialFormData);

  const isAdmin = getUser()?.role === "admin";

  
useEffect(() => {
  async function loadPrinters() {
    try {
      const token = localStorage.getItem("token");

      const res = await fetch(`${API_BASE_URL}/printers`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        // If unauthorized, mark notLoggedIn and keep printers as empty array
        if (res.status === 401) {
          setNotLoggedIn(true);
          setPrinters([]);
          return;
        }
        // Other non-ok responses: try to parse and fall back
        const errData = await res.json().catch(() => null);
        console.error("Failed to load printers:", res.status, errData);
        setPrinters([]);
        return;
      }

      const data = await res.json().catch(() => null);
      // backend may return an array or an object with `printers` key
      const printersData = Array.isArray(data) ? data : (data && Array.isArray((data as any).printers) ? (data as any).printers : []);
      setPrinters(
        printersData.map((printer: PrinterData) => ({
          ...printer,
          enabledSensors: normalizeEnabledSensors(printer.enabledSensors),
        })),
      );
      setNotLoggedIn(false);
    } catch (err) {
      console.error("Failed to load printers:", err);
    }
  }

  loadPrinters();

  const onAuthChange = () => {
    loadPrinters();
  };

  window.addEventListener("authChanged", onAuthChange);
  return () => window.removeEventListener("authChanged", onAuthChange);
}, []);


  const activePrinters = printers.filter(p => p.status === "printing").length;
  const idlePrinters = printers.filter(p => p.status === "idle").length;
  const errorPrinters = printers.filter(p => p.status === "error" || p.status === "paused").length;

const handleAddPrinter = async () => {
  const token = localStorage.getItem("token");

  try {
    const response = await fetch(`${API_BASE_URL}/printers`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(formData),
    });

    const created = await response.json();
    if (!response.ok) {
      throw new Error(created?.message || `Failed to create printer: ${response.status}`);
    }
    setPrinters((current) => [
      ...current,
      {
        ...created,
        enabledSensors: normalizeEnabledSensors(created.enabledSensors),
      },
    ]);
    setIsAddDialogOpen(false);
  } catch (error) {
    console.error("Failed to create printer:", error);
  }
};



const handleEditPrinter = async () => {
  if (!selectedPrinter) return;
  if (!isAdmin) {
    console.warn("Edit action blocked: user is not an admin");
    return;
  }
  const token = localStorage.getItem("token");

  try {
    const response = await fetch(`${API_BASE_URL}/printers/${selectedPrinter.id}`, {
      method: "PUT",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(formData),
    });

    const updated = await response.json();
    if (!response.ok) {
      throw new Error(updated?.message || `Failed to update printer: ${response.status}`);
    }
    const normalizedUpdated = {
      ...updated,
      enabledSensors: normalizeEnabledSensors(updated.enabledSensors),
    };
    setPrinters((current) =>
      current.map((printer) =>
        printer.id === normalizedUpdated.id ? normalizedUpdated : printer,
      ),
    );
    setIsEditDialogOpen(false);
  } catch (error) {
    console.error("Failed to update printer:", error);
  }
};



const handleDeletePrinter = async () => {
  if (!selectedPrinter) return;
  if (!isAdmin) {
    console.warn("Delete action blocked: user is not an admin");
    return;
  }
  const token = localStorage.getItem("token");

  try {
    await fetch(`${API_BASE_URL}/printers/${selectedPrinter.id}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    });

    setPrinters(printers.filter(p => p.id !== selectedPrinter.id));
    setIsDeleteDialogOpen(false);
  } catch (error) {
    console.error("Failed to delete printer:", error);
  }
};

  const openCredentialDialog = (printer: PrinterData) => {
    if (!isAdmin) return;
    setSelectedPrinter(printer);
    setGeneratedModuleKey("");
    setCredentialError("");
    setIsCredentialDialogOpen(true);
  };

  const handleRotateCredential = async () => {
    if (!selectedPrinter || !isAdmin || isRotatingCredential) return;
    setIsRotatingCredential(true);
    setCredentialError("");
    try {
      const response = await fetch(
        `${API_BASE_URL}/printers/${encodeURIComponent(selectedPrinter.id)}/smart-module/credentials/rotate`,
        {
          method: "POST",
          headers: getAuthHeaders(),
        },
      );
      const data = await response.json().catch(() => null);
      if (!response.ok || typeof data?.apiKey !== "string") {
        throw new Error(data?.message || `Credential rotation failed: ${response.status}`);
      }
      setGeneratedModuleKey(data.apiKey);
      setPrinters((current) =>
        current.map((printer) =>
          printer.id === selectedPrinter.id
            ? { ...printer, smartModuleAuthConfigured: true }
            : printer,
        ),
      );
    } catch (error) {
      setCredentialError(error instanceof Error ? error.message : "Credential rotation failed");
    } finally {
      setIsRotatingCredential(false);
    }
  };



  const openEditDialog = (printer: PrinterData) => {
    if (!isAdmin) return;
    setSelectedPrinter(printer);
    setFormData({
      name: printer.name,
      model: printer.model,
      status: printer.status,
      location: printer.location,
      serialNumber: printer.serialNumber,
      ipAddress: printer.ipAddress,
      sensorIp: printer.sensorIp || "",
      raspberryPiIp: printer.raspberryPiIp || "",
      enabledSensors: normalizeEnabledSensors(printer.enabledSensors),
      addedDate: printer.addedDate || "",
      lastMaintenance: printer.lastMaintenance || "",
      resinType: printer.resinType,
      resinLevel: printer.resinLevel,
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (printer: PrinterData) => {
    if (!isAdmin) return;
    setSelectedPrinter(printer);
    setIsDeleteDialogOpen(true);
  };

  return (
    <div>
      {notLoggedIn && (
        <Card className="mb-6 p-4 border border-yellow-200 bg-yellow-50">
          <div className="text-yellow-800">You are not logged in. Sign in to view and manage printers.</div>
        </Card>
      )}
      <div className="flex items-center justify-end mb-8">
            <Dialog
              open={isAddDialogOpen}
              onOpenChange={(open) => {
                if (open) setFormData(createInitialFormData());
                setIsAddDialogOpen(open);
              }}
            >
              {isAdmin ? (
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="w-4 h-4" />
                    Add Printer
                  </Button>
                </DialogTrigger>
              ) : (
                <Button className="gap-2" disabled>
                  <Plus className="w-4 h-4" />
                  Add Printer
                </Button>
              )}
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Printer</DialogTitle>
              <DialogDescription>
                Register a new 3D printer to your print farm management system.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="add-name">Printer Name</Label>
                <Input
                  id="add-name"
                  placeholder="e.g., Printer 09"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-model">Model</Label>
                <Select value={formData.model} onValueChange={(value) => setFormData({ ...formData, model: value })}>
                  <SelectTrigger id="add-model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {printerModels.map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-location">Location</Label>
                <Input
                  id="add-location"
                  placeholder="e.g., Lab A - Station 1"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-serial">Serial Number</Label>
                <Input
                  id="add-serial"
                  placeholder="e.g., DLP-5405-2024-009"
                  value={formData.serialNumber}
                  onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-ip">IP Address</Label>
                <Input
                  id="add-ip"
                  placeholder="e.g., 192.168.1.109"
                  value={formData.ipAddress}
                  onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-sensor-ip">Sensor IP</Label>
                <Input
                  id="add-sensor-ip"
                  placeholder="e.g., 192.168.1.150"
                  value={formData.sensorIp}
                  onChange={(e) => setFormData({ ...formData, sensorIp: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-pi-ip">Raspberry Pi IP</Label>
                <Input
                  id="add-pi-ip"
                  placeholder="e.g., 192.168.1.200"
                  value={formData.raspberryPiIp}
                  onChange={(e) => setFormData({ ...formData, raspberryPiIp: e.target.value })}
                />
              </div>
              <SensorConfiguration
                idPrefix="add-sensor"
                enabledSensors={formData.enabledSensors}
                onChange={(enabledSensors) =>
                  setFormData({ ...formData, enabledSensors })
                }
              />
              <div className="space-y-2">
                <Label htmlFor="add-status">Initial Status</Label>
                <Select value={formData.status} onValueChange={(value: PrinterStatus) => setFormData({ ...formData, status: value })}>
                  <SelectTrigger id="add-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="idle">Idle</SelectItem>
                    <SelectItem value="printing">Printing</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-added-date">Added Date</Label>
                <Input
                  id="add-added-date"
                  type="date"
                  value={formData.addedDate}
                  onChange={(e) => setFormData({ ...formData, addedDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-last-maintenance">Last Maintenance</Label>
                <Input
                  id="add-last-maintenance"
                  type="date"
                  value={formData.lastMaintenance}
                  onChange={(e) => setFormData({ ...formData, lastMaintenance: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-resin-type">Resin Type</Label>
                <Select value={formData.resinType} onValueChange={(value) => setFormData({ ...formData, resinType: value })}>
                  <SelectTrigger id="add-resin-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {resinTypes.map((resin) => (
                      <SelectItem key={resin} value={resin}>
                        {resin}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-resin-level">Resin Level (%)</Label>
                <Input
                  id="add-resin-level"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="100"
                  value={formData.resinLevel}
                  onChange={(e) => setFormData({ ...formData, resinLevel: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={handleAddPrinter}
                disabled={!formData.name || !formData.location || !formData.serialNumber || !formData.ipAddress}
              >
                Add Printer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-[var(--brand-blue-light)] rounded-lg">
              <Printer className="w-6 h-6 text-[var(--brand-blue)]" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Total Printers</p>
              <p className="text-2xl text-slate-900">{printers.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <Activity className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Active</p>
              <p className="text-2xl text-slate-900">{activePrinters}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-100 rounded-lg">
              <Printer className="w-6 h-6 text-slate-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Idle</p>
              <p className="text-2xl text-slate-900">{idlePrinters}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Issues</p>
              <p className="text-2xl text-slate-900">{errorPrinters}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Resin</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Serial Number</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>Sensor IP</TableHead>
                <TableHead>Raspberry Pi IP</TableHead>
                <TableHead>Module Auth</TableHead>
                <TableHead>Sensors</TableHead>
              <TableHead>Last Maintenance</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {printers.map((printer) => (
              <TableRow key={printer.id}>
                <TableCell className="text-slate-900">{printer.name}</TableCell>
                <TableCell className="text-slate-600">{printer.model}</TableCell>
                <TableCell>
                  <Badge className={statusColors[printer.status] + " capitalize"}>
                    {printer.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-slate-600">
                  {printer.resinType}/{printer.resinLevel}%
                </TableCell>
                <TableCell className="text-slate-600">
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {printer.location}
                  </div>
                </TableCell>
                <TableCell className="text-slate-600 text-sm">{printer.serialNumber}</TableCell>
                <TableCell className="text-slate-600 text-sm">{printer.ipAddress}</TableCell>
                <TableCell className="text-slate-600 text-sm">{printer.sensorIp || '-'}</TableCell>
                <TableCell className="text-slate-600 text-sm">{printer.raspberryPiIp || '-'}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={printer.smartModuleAuthConfigured ? "border-green-300 text-green-700" : "border-amber-300 text-amber-700"}
                  >
                    {printer.smartModuleAuthConfigured ? "Configured" : "Not configured"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex min-w-32 flex-wrap gap-1">
                    {printer.enabledSensors.length > 0 ? (
                      printer.enabledSensors.map((sensor) => (
                        <Badge key={sensor} variant="outline" className="uppercase">
                          {sensor}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-slate-400">None</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-slate-600">{printer.lastMaintenance}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      title="Generate or rotate Smart Module key"
                      onClick={() => openCredentialDialog(printer)}
                      disabled={!isAdmin}
                    >
                      <KeyRound className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(printer)}
                      disabled={!isAdmin}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openDeleteDialog(printer)}
                      disabled={!isAdmin}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Edit Printer Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Printer</DialogTitle>
            <DialogDescription>
              Update printer information and configuration.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Printer Name</Label>
              <Input
                id="edit-name"
                placeholder="e.g., Printer 09"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-model">Model</Label>
              <Select value={formData.model} onValueChange={(value) => setFormData({ ...formData, model: value })}>
                <SelectTrigger id="edit-model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {printerModels.map((model) => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-location">Location</Label>
              <Input
                id="edit-location"
                placeholder="e.g., Lab A - Station 1"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-serial">Serial Number</Label>
              <Input
                id="edit-serial"
                placeholder="e.g., DLP-5405-2024-009"
                value={formData.serialNumber}
                onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-ip">IP Address</Label>
              <Input
                id="edit-ip"
                placeholder="e.g., 192.168.1.109"
                value={formData.ipAddress}
                onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-sensor-ip">Sensor IP</Label>
              <Input
                id="edit-sensor-ip"
                placeholder="e.g., 192.168.1.150"
                value={formData.sensorIp}
                onChange={(e) => setFormData({ ...formData, sensorIp: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-pi-ip">Raspberry Pi IP</Label>
              <Input
                id="edit-pi-ip"
                placeholder="e.g., 192.168.1.200"
                value={formData.raspberryPiIp}
                onChange={(e) => setFormData({ ...formData, raspberryPiIp: e.target.value })}
              />
            </div>
            <SensorConfiguration
              idPrefix="edit-sensor"
              enabledSensors={formData.enabledSensors}
              onChange={(enabledSensors) =>
                setFormData({ ...formData, enabledSensors })
              }
            />
            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select value={formData.status} onValueChange={(value: PrinterStatus) => setFormData({ ...formData, status: value })}>
                <SelectTrigger id="edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="idle">Idle</SelectItem>
                  <SelectItem value="printing">Printing</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-added-date">Added Date</Label>
              <Input
                id="edit-added-date"
                type="date"
                value={formData.addedDate}
                onChange={(e) => setFormData({ ...formData, addedDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-last-maintenance">Last Maintenance</Label>
              <Input
                id="edit-last-maintenance"
                type="date"
                value={formData.lastMaintenance}
                onChange={(e) => setFormData({ ...formData, lastMaintenance: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-resin-type">Resin Type</Label>
              <Select value={formData.resinType} onValueChange={(value) => setFormData({ ...formData, resinType: value })}>
                <SelectTrigger id="edit-resin-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {resinTypes.map((resin) => (
                    <SelectItem key={resin} value={resin}>
                      {resin}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-resin-level">Resin Level (%)</Label>
              <Input
                id="edit-resin-level"
                type="number"
                min="0"
                max="100"
                placeholder="100"
                value={formData.resinLevel}
                onChange={(e) => setFormData({ ...formData, resinLevel: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleEditPrinter}
              disabled={!formData.name || !formData.location || !formData.serialNumber || !formData.ipAddress}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Printer Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <span className="text-slate-900">{selectedPrinter?.name}</span> ({selectedPrinter?.model}) from your print farm.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePrinter} className="bg-red-600 hover:bg-red-700">
              Delete Printer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={isCredentialDialogOpen}
        onOpenChange={(open) => {
          setIsCredentialDialogOpen(open);
          if (!open) {
            setGeneratedModuleKey("");
            setCredentialError("");
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Smart Module authentication</DialogTitle>
            <DialogDescription>
              Generate a unique key for {selectedPrinter?.name}. Rotating an existing key disconnects that module until the new value is installed on its Raspberry Pi.
            </DialogDescription>
          </DialogHeader>

          {generatedModuleKey ? (
            <div className="space-y-4 py-2">
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                This key is shown once. Copy it into <code>/etc/atum3d/smart-module.env</code> for both module services, then restart them.
              </div>
              <div className="flex gap-2">
                <Input value={generatedModuleKey} readOnly className="font-mono" aria-label="Generated Smart Module key" />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void navigator.clipboard.writeText(generatedModuleKey)}
                  title="Copy key"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 py-2">
              <p className="text-sm text-slate-600">
                The backend stores only an encrypted copy. The unencrypted key cannot be retrieved after this dialog is closed.
              </p>
              {credentialError && <p className="text-sm text-red-600">{credentialError}</p>}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCredentialDialogOpen(false)}>
              {generatedModuleKey ? "Done" : "Cancel"}
            </Button>
            {!generatedModuleKey && (
              <Button onClick={handleRotateCredential} disabled={isRotatingCredential}>
                {isRotatingCredential ? "Generating…" : selectedPrinter?.smartModuleAuthConfigured ? "Rotate key" : "Generate key"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
