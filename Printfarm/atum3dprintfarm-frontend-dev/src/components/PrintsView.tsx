import { useEffect, useState } from "react";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Play, Clock, CheckCircle2, XCircle, FileText, Printer, TrendingUp } from "lucide-react";
import { Progress } from "./ui/progress";
import { API_BASE_URL } from "../lib/api";

interface PrintJob {
  id: string;
  fileName: string;
  printerName: string;
  status: "queued" | "printing" | "completed" | "failed";
  progress?: number;
  timeRemaining?: string;
  timeElapsed?: string;
  startedAt?: string;
  completedAt?: string;
  queuePosition?: number;
  estimatedTime?: string;
  fileSize: string;
  material: string;
}

export function PrintsView() {
  const [printJobs, setPrintJobs] = useState<PrintJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notLoggedIn, setNotLoggedIn] = useState(false);

  // Fetch print jobs from backend
useEffect(() => {
  async function loadPrints() {
    try {
      const token = localStorage.getItem("token");

      const res = await fetch(`${API_BASE_URL}/print-jobs`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          setNotLoggedIn(true);
          setPrintJobs([]);
          setError(null);
          return;
        }
        const errData = await res.json().catch(() => null);
        const msg = errData?.message || `Failed to fetch prints (${res.status})`;
        setError(msg);
        setPrintJobs([]);
        return;
      }

      const data = await res.json().catch(() => null);
      const jobs = Array.isArray(data)
        ? data
        : (data && Array.isArray((data as any).printJobs) ? (data as any).printJobs : []);
      setPrintJobs(jobs);
      setNotLoggedIn(false);
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  loadPrints();

  const onAuthChange = () => {
    setLoading(true);
    loadPrints();
  };

  window.addEventListener("authChanged", onAuthChange);
  return () => window.removeEventListener("authChanged", onAuthChange);
}, []);


  const activePrints = printJobs.filter(job => job.status === "printing");
  const queuedPrints = printJobs.filter(job => job.status === "queued");

  // Client-side computed queue order for display when backend doesn't provide positions
  const queuedSorted = queuedPrints.slice().sort((a, b) => {
    const aPos = a.queuePosition ?? 0;
    const bPos = b.queuePosition ?? 0;

    // Prefer explicit queuePosition when present
    if (aPos && bPos) return aPos - bPos;
    if (aPos && !bPos) return -1;
    if (!aPos && bPos) return 1;

    // Fallback to createdAt if available
    const aCreated = (a as any).createdAt;
    const bCreated = (b as any).createdAt;
    if (aCreated && bCreated) return new Date(aCreated).getTime() - new Date(bCreated).getTime();

    // Last fallback: keep current array order
    return 0;
  });
  const completedPrints = printJobs.filter(job => job.status === "completed");
  const failedPrints = printJobs.filter(job => job.status === "failed");

  const getStatusBadge = (status: PrintJob["status"]) => {
    switch (status) {
      case "printing":
        return <Badge className="bg-green-100 text-green-700">Printing</Badge>;
      case "queued":
        return <Badge className="bg-[var(--brand-blue-light)] text-[var(--brand-blue-dark)]">Queued</Badge>;
      case "completed":
        return <Badge className="bg-slate-100 text-slate-700">Completed</Badge>;
      case "failed":
        return <Badge className="bg-red-100 text-red-700">Failed</Badge>;
    }
  };

  if (loading) return <p className="text-slate-500">Loading print jobs…</p>;

  return (
    <div>
      {notLoggedIn && (
        <Card className="mb-6 p-4 border border-yellow-200 bg-yellow-50">
          <div className="text-yellow-800">You are not logged in. Sign in to view and manage prints.</div>
        </Card>
      )}
      {error && !notLoggedIn && (
        <Card className="mb-6 p-4 border border-red-200 bg-red-50">
          <div className="text-red-800">Error loading prints: {error}</div>
        </Card>
      )}
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-[var(--brand-blue-light)] rounded-lg">
              <Clock className="w-6 h-6 text-[var(--brand-blue)]" />
            </div>
            <div>
              <p className="text-sm text-slate-600">In Queue</p>
              <p className="text-2xl text-slate-900">{queuedPrints.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <Play className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Printing</p>
              <p className="text-2xl text-slate-900">{activePrints.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-100 rounded-lg">
              <CheckCircle2 className="w-6 h-6 text-slate-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Completed</p>
              <p className="text-2xl text-slate-900">{completedPrints.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-100 rounded-lg">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">Failed</p>
              <p className="text-2xl text-slate-900">{failedPrints.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Active Prints */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Play className="w-5 h-5 text-slate-600" />
          <h2 className="text-slate-900">Active Prints</h2>
        </div>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File Name</TableHead>
                <TableHead>Printer</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Time Elapsed</TableHead>
                <TableHead>Time Remaining</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activePrints.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-slate-500 py-8">
                    No active prints
                  </TableCell>
                </TableRow>
              ) : (
                activePrints.map(job => (
                  <TableRow key={job.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-900">{job.fileName}</span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2 text-slate-600">
                        <Printer className="w-4 h-4" />
                        {job.printerName}
                      </div>
                    </TableCell>

                    <TableCell className="text-slate-600">{job.material}</TableCell>

                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Progress value={job.progress ?? 0} className="w-24" />
                        <span className="text-sm text-slate-600">{job.progress ?? 0}%</span>
                      </div>
                    </TableCell>

                    <TableCell className="text-slate-600">{job.timeElapsed}</TableCell>
                    <TableCell className="text-slate-600">{job.timeRemaining}</TableCell>
                    <TableCell className="text-slate-600">{job.startedAt}</TableCell>

                    <TableCell>{getStatusBadge(job.status)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Queue */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-slate-600" />
          <h2 className="text-slate-900">Print Queue</h2>
        </div>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Position</TableHead>
                <TableHead>File Name</TableHead>
                <TableHead>Printer</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>File Size</TableHead>
                <TableHead>Est. Time</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queuedPrints.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-500 py-8">
                    Queue is empty
                  </TableCell>
                </TableRow>
              ) : (
                queuedSorted.map((job, idx) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      <div className="w-6 h-6 rounded-full bg-[var(--brand-blue-light)] text-[var(--brand-blue-dark)] flex items-center justify-center text-sm">
                        {job.queuePosition && job.queuePosition > 0 ? job.queuePosition : idx + 1}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-900">{job.fileName}</span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2 text-slate-600">
                        <Printer className="w-4 h-4" />
                        {job.printerName}
                      </div>
                    </TableCell>

                    <TableCell className="text-slate-600">{job.material}</TableCell>
                    <TableCell className="text-slate-600">{job.fileSize}</TableCell>
                    <TableCell className="text-slate-600">{job.estimatedTime}</TableCell>
                    <TableCell>{getStatusBadge(job.status)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Completed + Failed */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-slate-600" />
          <h2 className="text-slate-900">Recent Prints</h2>
        </div>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File Name</TableHead>
                <TableHead>Printer</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...completedPrints, ...failedPrints].map(job => (
                <TableRow key={job.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-900">{job.fileName}</span>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-2 text-slate-600">
                      <Printer className="w-4 h-4" />
                      {job.printerName}
                    </div>
                  </TableCell>

                  <TableCell className="text-slate-600">{job.material}</TableCell>
                  <TableCell className="text-slate-600">{job.timeElapsed}</TableCell>
                  <TableCell className="text-slate-600">{job.completedAt}</TableCell>

                  <TableCell>{getStatusBadge(job.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
