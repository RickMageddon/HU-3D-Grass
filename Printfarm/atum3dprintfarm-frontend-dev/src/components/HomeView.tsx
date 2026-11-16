import { PrinterCard, Printer } from "./PrinterCard";
import { PrinterHistoryDialog, PrintHistory } from "./PrinterHistoryDialog";
import { Activity, Printer as PrinterIcon, CheckCircle2, AlertCircle, Box, FileText, TrendingUp, Plus, Upload, CheckCircle } from "lucide-react";
import { Card } from "./ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "./ui/dialog";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Alert, AlertDescription } from "./ui/alert";
import { useState, useEffect, useRef, ChangeEvent } from "react";
import JSZip from "jszip";
import { logEvent } from "../lib/logEvent";
import { API_BASE_URL } from "../lib/api";

export function HomeView() {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [monthlyData, setMonthlyData] = useState<Array<{ month: string; volume: number; jobs: number }>>([]);
  const [isAddJobOpen, setIsAddJobOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedPrinter, setSelectedPrinter] = useState<Printer | null>(null);
  const [newJob, setNewJob] = useState({
    fileName: "",
    printer: "",
    resinType: "",
    resinAmount: "",
    estimatedTime: "",
    backendJobId: "",
    fileSize: "",
  });
  const [printHistory, setPrintHistory] = useState<Record<string, PrintHistory[]>>({});
  const fileRef = useRef<File | null>(null);

  // Fetch printers from backend
const [loading, setLoading] = useState(true);

useEffect(() => {
  let cancelled = false;
  const POLL_INTERVAL = 5000; // ms

  async function fetchPrinters() {
    const token = localStorage.getItem("token"); // read token from login
    if (!token) {
      if (!cancelled) {
        setPrinters([]);
        setLoading(false);
      }
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/printers`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        if (!cancelled) setPrinters([]);
        return;
      }

      const data = await res.json();

      if (!cancelled) {
        if (Array.isArray(data)) {
          // Merge sensor-derived resin volumes into the printers returned from the DB.
          // We intentionally avoid falling back to DB `resinLevel` when sensor data is
          // missing — instead we clear the displayed value so the UI does not show
          // stale defaults (e.g. 100%). The `previousVolumesRef` holds the last known
          // sensor percent (number) or `null` when the sensor reported missing data.
          const merged = data.map((p: any) => {
            const sensor = previousVolumesRef.current[p.id];
            if (sensor === undefined || sensor === null) {
              // No sensor number available -> do not show DB value
              return { ...p, resinLevel: undefined };
            }
            // Sensor provided a numeric percent -> use it
            return { ...p, resinLevel: sensor };
          });

          setPrinters(merged);
        } else {
          console.error("Unexpected printer data:", data);
          setPrinters([]);
        }
      }
    } catch (err) {
      console.error("Failed to fetch printers:", err);
      if (!cancelled) setPrinters([]);
    } finally {
      if (!cancelled) setLoading(false);
    }
  }

  // initial load + start polling
  fetchPrinters();
  const intervalId = window.setInterval(fetchPrinters, POLL_INTERVAL);

  return () => {
    cancelled = true;
    clearInterval(intervalId as number);
  };
}, []);
const previousVolumesRef = useRef<Record<string, number | null>>({});

useEffect(() => {
  let interval: NodeJS.Timeout;

  async function pollResinVolumes() {
    try {
      const res = await fetch(`${API_BASE_URL}/resin/volumes`);
      const data = await res.json();

      if (!Array.isArray(data)) return;

       setPrinters(prevPrinters => {
        return prevPrinters.map(printer => {
          const updated = data.find(p => p.id === printer.id);
          if (!updated) return printer;

          const rawVolume = updated.latestResinVolume?.percent;
          const newVolume = typeof rawVolume === 'number' ? rawVolume : null;
          const prevVolume = previousVolumesRef.current[printer.id];

          // volume changed → info log (handles null/number differences)
          if (prevVolume !== undefined && prevVolume !== newVolume) {
            logEvent(
              "info",
              "ResinSensor",
              `Resin volume changed for ${printer.name}: ${prevVolume}% → ${newVolume}%`
            );
          }

          // If sensor didn't return a numeric value, clear the sensor-derived resinLevel
          // instead of leaving/ reverting to any previous DB value. This prevents the UI
          // from falling back to stale database values when the sensor reports missing data.
          if (newVolume === null) {
            previousVolumesRef.current[printer.id] = null;
            return {
              ...printer,
              resinLevel: undefined,
            };
          }

          // store new numeric volume and update printer
          previousVolumesRef.current[printer.id] = newVolume;

          return {
            ...printer,
            resinLevel: newVolume,
          };
        });
      });
    } catch (err) {
      logEvent("error", "ResinSensor", "Failed to poll resin volumes");
      console.error(err);
    }
  }

  interval = setInterval(pollResinVolumes, 2000);
  pollResinVolumes(); // immediate first run

  return () => clearInterval(interval);
}, []);



  // Fetch monthly stats
  useEffect(() => {
    fetch(`${API_BASE_URL}/stats/monthly`)
      .then(res => res.json())
      .then(setMonthlyData)
      .catch(err => console.error("Failed to fetch monthly stats", err));
  }, []);

  const activePrinters = printers.filter(p => p.status === "printing").length;
  const idlePrinters = printers.filter(p => p.status === "idle").length;
  const errorPrinters = printers.filter(p => p.status === "error" || p.status === "paused").length;

  const currentMonth = monthlyData.length > 0 ? monthlyData[monthlyData.length - 1] : null;
  const previousMonth = monthlyData.length > 1 ? monthlyData[monthlyData.length - 2] : null;

  const volumeChange = currentMonth && previousMonth
    ? ((currentMonth.volume - previousMonth.volume) / previousMonth.volume * 100).toFixed(1)
    : "0.0";

  const jobsChange = currentMonth && previousMonth
    ? ((currentMonth.jobs - previousMonth.jobs) / previousMonth.jobs * 100).toFixed(1)
    : "0.0";

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

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Immediately set filename/size so UI can enable the Add button
    setNewJob(prev => ({
      ...prev,
      fileName: file.name,
      fileSize: `${file.size}`,
    }));

    // store the File so we can send it together with the metadata later
    fileRef.current = file;
  };

  const handlePrinterClick = (printer: Printer) => {
    setSelectedPrinter(printer);
    setHistoryDialogOpen(true);
  };

  // Find recommended printer based on resin type and amount
  const getRecommendedPrinter = () => {
    if (!newJob.resinType || !newJob.resinAmount) return null;

    const resinNeeded = parseFloat(newJob.resinAmount);
    if (isNaN(resinNeeded)) return null;

    const matchingPrinters = printers.filter(p =>
      p.resinType === newJob.resinType &&
      p.status === "idle" &&
      p.resinLevel !== undefined &&
      p.resinLevel >= resinNeeded
    );

    if (matchingPrinters.length === 0) {
      const matchingButLowResin = printers.filter(p =>
        p.resinType === newJob.resinType &&
        p.status === "idle"
      );
      if (matchingButLowResin.length > 0) return { type: "low-resin", printers: matchingButLowResin };
      return { type: "no-match" };
    }

    matchingPrinters.sort((a, b) => (b.resinLevel || 0) - (a.resinLevel || 0));
    return { type: "match", printer: matchingPrinters[0], alternatives: matchingPrinters.slice(1) };
  };

  const recommendedPrinter = getRecommendedPrinter();

  function parseEstimatedMinutes(estimated: string) {
    if (!estimated) return 0;
    // support formats like "4h 30m", "90m", "2h"
    const hMatch = estimated.match(/(\d+)\s*h/);
    const mMatch = estimated.match(/(\d+)\s*m/);
    const hours = hMatch ? parseInt(hMatch[1], 10) : 0;
    const mins = mMatch ? parseInt(mMatch[1], 10) : 0;
    if (!hMatch && !mMatch) {
      const onlyNumber = estimated.match(/^(\d+)$/);
      return onlyNumber ? parseInt(onlyNumber[1], 10) : 0;
    }
    return hours * 60 + mins;
  }

  const handleAddJob = async () => {
    const token = localStorage.getItem("token");

    const printerId = newJob.printer || (recommendedPrinter?.type === "match" ? recommendedPrinter.printer.id : "unassigned");
    const printerName = printers.find(p => p.id === printerId)?.name || (printerId === 'unassigned' ? 'unassigned' : printerId);

    const estimatedTimeMinutes = parseEstimatedMinutes(newJob.estimatedTime);

    const fileSizeBytes = typeof newJob.fileSize === 'string' ? parseInt(newJob.fileSize, 10) || 0 : (newJob.fileSize as any) || 0;
    const fileSizeMb = +(fileSizeBytes / (1024 * 1024)).toFixed(2);

      // Build multipart form data including the file (if selected)
      const formData = new FormData();
      if (fileRef.current) {
        formData.append("file", fileRef.current, fileRef.current.name);
      }
      formData.append("fileName", newJob.fileName || "");
      formData.append("printerName", printerName);
      formData.append("status", "queued");
      formData.append("progress", String(0));
      formData.append("estimatedTimeMinutes", String(estimatedTimeMinutes));
      formData.append("timeElapsedMinutes", String(0));
      formData.append("material", newJob.resinType || "resin");
      formData.append("volumeLiters", String(0));
      formData.append("queuePosition", String(0));
      formData.append("volume", String(0));
      formData.append("resinType", newJob.resinType || "");
      formData.append("resinAmount", newJob.resinAmount || "");

      try {
        const res = await fetch(`${API_BASE_URL}/print-jobs`, {
          method: "POST",
          headers: {
            ...(token ? { "Authorization": `Bearer ${token}` } : {}),
          },
          body: formData,
        });

        const result = await res.json().catch(() => ({}));

        if (!res.ok) {
          console.error("Failed to create print job:", result);
          await logEvent("error", "PrintJob", `Create failed: ${JSON.stringify(result)}`);
        } else {
          await logEvent("info", "PrintJob", `Created job ${newJob.fileName} for ${printerName}`);
        }
      } catch (err) {
        console.error("Error creating print job", err);
        await logEvent("error", "PrintJob", `Request error: ${String(err)}`);
      } finally {
        setIsAddJobOpen(false);
        setNewJob({
          fileName: "",
          printer: "",
          resinType: "",
          resinAmount: "",
          estimatedTime: "",
          backendJobId: "",
          fileSize: "",
        });
        fileRef.current = null;
      }
  };

  return (
    <div>
      {/* Add Print Job Dialog */}
      <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <Dialog open={isAddJobOpen} onOpenChange={setIsAddJobOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] text-white w-full sm:w-auto sm:ml-auto">
              <Plus className="w-4 h-4 mr-2" />
              Add Print Job
            </Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add New Print Job</DialogTitle>
              <DialogDescription>Upload a CAD file and configure your print job settings</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* File Upload */}
              <div className="space-y-2">
                <Label htmlFor="file">CAD File</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".zip,.stl,.stp,.ste,.step,.stpz,.igs,.ige,.iges,.iam,.dwg,.idw,.ipt,.ipn,.ide,.prt,.sldprt,.asm,.sldasm,.fusiondesign,.3dm"
                  onChange={handleFileUpload}
                />
                <p className="text-sm text-slate-500">
                  Supported: STL, STEP, STP, IGS, IAM, DWG, IPT, PRT, SLDPRT, ASM, FusionDesign, 3DM
                </p>
              </div>

              {/* Resin Type */}
              <div className="space-y-2">
                <Label htmlFor="resinType">Resin Type Required</Label>
                <Select
                  value={newJob.resinType}
                  onValueChange={(value) => setNewJob(prev => ({ ...prev, resinType: value }))}
                >
                  <SelectTrigger id="resinType">
                    <SelectValue placeholder="Select resin type" />
                  </SelectTrigger>
                  <SelectContent>
                    {resinTypes.map(resin => (
                      <SelectItem key={resin} value={resin}>{resin}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Resin Amount */}
              <div className="space-y-2">
                <Label htmlFor="resinAmount">Resin Amount Needed (%)</Label>
                <Input
                  id="resinAmount"
                  type="number"
                  min="1"
                  max="100"
                  placeholder="e.g., 25"
                  value={newJob.resinAmount}
                  onChange={(e) => setNewJob(prev => ({ ...prev, resinAmount: e.target.value }))}
                />
                <p className="text-sm text-slate-500">
                  Enter percentage of tank capacity required for this print
                </p>
              </div>

              {/* Recommended Printer Alert */}
              {recommendedPrinter && (
                <Alert
                  className={
                    recommendedPrinter.type === "match"
                      ? "bg-green-50 border-green-200"
                      : recommendedPrinter.type === "low-resin"
                      ? "bg-yellow-50 border-yellow-200"
                      : "bg-red-50 border-red-200"
                  }
                >
                  <div className="flex items-start gap-2">
                    {recommendedPrinter.type === "match" ? (
                      <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                    )}
                    <div className="flex-1">
                      {recommendedPrinter.type === "match" && (
                        <AlertDescription className="text-green-800">
                          <p className="font-medium mb-1">
                            Recommended: {recommendedPrinter.printer.name}
                          </p>
                          <p className="text-sm">
                            {recommendedPrinter.printer.model} • {recommendedPrinter.printer.resinType}/{recommendedPrinter.printer.resinLevel}%
                          </p>
                          {recommendedPrinter.alternatives.length > 0 && (
                            <p className="text-sm mt-1 text-green-700">
                              +{recommendedPrinter.alternatives.length} other compatible printer{recommendedPrinter.alternatives.length > 1 ? 's' : ''}
                            </p>
                          )}
                        </AlertDescription>
                      )}
                      {recommendedPrinter.type === "low-resin" && (
                        <AlertDescription className="text-yellow-800">
                          <p className="font-medium mb-1">Warning: Insufficient Resin</p>
                          <p className="text-sm">
                            Printers with {newJob.resinType} found, but resin levels are below {newJob.resinAmount}%. Please refill or select a different resin type.
                          </p>
                        </AlertDescription>
                      )}
                      {recommendedPrinter.type === "no-match" && (
                        <AlertDescription className="text-red-800">
                          <p className="font-medium mb-1">No Compatible Printer</p>
                          <p className="text-sm">
                            No idle printers found with {newJob.resinType}. Job will be queued for auto-assignment.
                          </p>
                        </AlertDescription>
                      )}
                    </div>
                  </div>
                </Alert>
              )}

              {/* Printer Select */}
              <div className="space-y-2">
                <Label htmlFor="printer">Select Printer (Optional)</Label>
                <Select
                  value={newJob.printer}
                  onValueChange={(value) => setNewJob(prev => ({ ...prev, printer: value }))}
                >
                  <SelectTrigger id="printer">
                    <SelectValue placeholder={recommendedPrinter?.type === 'match' ? `Auto-assign to ${recommendedPrinter.printer.name}` : "Add to Queue (Auto-assign)"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Add to Queue (Auto-assign)</SelectItem>
                    {printers.filter(p => p.status === "idle").map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name} - {p.model} ({p.resinType}/{p.resinLevel}%)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Estimated Time */}
              <div className="space-y-2">
                <Label htmlFor="time">Estimated Print Time</Label>
                <Input
                  id="time"
                  placeholder="e.g., 4h 30m"
                  value={newJob.estimatedTime}
                  onChange={(e) => setNewJob(prev => ({ ...prev, estimatedTime: e.target.value }))}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddJobOpen(false)}>Cancel</Button>
              <Button
                onClick={handleAddJob}
                disabled={!newJob.fileName || !newJob.resinType || !newJob.resinAmount || !newJob.estimatedTime}
                className="bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)]"
              >
                <Upload className="w-4 h-4 mr-2" />
                Add to Queue
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Printer Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-[var(--brand-blue-light)] rounded-lg">
              <PrinterIcon className="w-6 h-6 text-[var(--brand-blue)]" />
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
              <CheckCircle2 className="w-6 h-6 text-slate-600" />
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
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Issues</p>
              <p className="text-2xl text-slate-900">{errorPrinters}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Print Volume */}
        <Card className="p-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Box className="w-5 h-5 text-slate-600" />
                <h3 className="text-slate-900">Print Volume</h3>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className={`w-4 h-4 ${parseFloat(volumeChange) >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                <span className={`text-sm ${parseFloat(volumeChange) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {volumeChange}%
                </span>
              </div>
            </div>
            <div className="mb-1">
              {currentMonth ? (
                <>
                  <span className="text-3xl text-slate-900">{currentMonth.volume.toFixed(1)}</span>
                  <span className="text-sm text-slate-500 ml-2">L in {currentMonth.month}</span>
                </>
              ) : (
                <span className="text-slate-500">No data yet</span>
              )}
            </div>
            <p className="text-sm text-slate-500">Total material volume printed</p>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                formatter={(value: number) => [`${value.toFixed(1)} L`, 'Volume']}
              />
              <Bar dataKey="volume" fill="var(--brand-blue)" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Print Jobs */}
        <Card className="p-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-slate-600" />
                <h3 className="text-slate-900">Print Jobs</h3>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className={`w-4 h-4 ${parseFloat(jobsChange) >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                <span className={`text-sm ${parseFloat(jobsChange) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{jobsChange}%</span>
              </div>
            </div>
            <div className="mb-1">
              <span className="text-3xl text-slate-900">{currentMonth ? currentMonth.jobs : 0}</span>
            </div>
            <p className="text-sm text-slate-500">Completed print jobs</p>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                formatter={(value: number) => [`${value} jobs`, 'Print Jobs']}
              />
              <Line type="monotone" dataKey="jobs" stroke="var(--brand-blue)" strokeWidth={2} dot={{ fill: 'var(--brand-blue)', r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* All Printers */}
      <div className="mb-4">
        <h2 className="text-slate-900">All Printers</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {printers.map(printer => (
          <div key={printer.id}>
            <PrinterCard printer={printer} onNameClick={() => handlePrinterClick(printer)} />
          </div>
        ))}
      </div>

      {/* Print History Dialog */}
      {selectedPrinter && (
        <PrinterHistoryDialog
          open={historyDialogOpen}
          onOpenChange={setHistoryDialogOpen}
          printerName={selectedPrinter.name}
          printerModel={selectedPrinter.model || "DLP STATION"}
          printHistory={printHistory[selectedPrinter.id] || []}
        />
      )}
    </div>
  );
}
