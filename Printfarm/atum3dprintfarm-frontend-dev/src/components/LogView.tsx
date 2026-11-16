import { useEffect, useState } from "react";
import { getUser } from "../lib/auth";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { Search, Info, AlertTriangle, XCircle, CheckCircle2, HelpCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { API_BASE_URL } from "../lib/api";

const PAGE_SIZE = 50;

type LogLevel = "info" | "warning" | "error" | "success";

interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  source: string;
  message: string;
}

const levelConfig: Record<
  LogLevel,
  { icon: any; color: string; bgColor: string; label: string }
> = {
  info: {
    icon: Info,
    color: "text-[var(--brand-blue-dark)]",
    bgColor: "bg-[var(--brand-blue-light)]",
    label: "Info",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-yellow-600",
    bgColor: "bg-yellow-100",
    label: "Warning",
  },
  error: {
    icon: XCircle,
    color: "text-red-600",
    bgColor: "bg-red-100",
    label: "Error",
  },
  success: {
    icon: CheckCircle2,
    color: "text-green-600",
    bgColor: "bg-green-100",
    label: "Success",
  },
};

export function LogView() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLevel, setSelectedLevel] = useState<LogLevel | "all">("all");
  const [notLoggedIn, setNotLoggedIn] = useState(false);
  const [notAuthorized, setNotAuthorized] = useState(false);

  const [currentUser, setCurrentUser] = useState(() => getUser());
  const isLoggedIn = !!currentUser;
  const isAdmin = currentUser?.role === "admin";

  useEffect(() => {
    const onAuth = () => setCurrentUser(getUser());
    window.addEventListener("authChanged", onAuth);
    return () => window.removeEventListener("authChanged", onAuth);
  }, []);

  // Fetch logs on mount
useEffect(() => {
  async function fetchLogs() {
    // If not logged in show banner
    if (!isLoggedIn) {
      setNotLoggedIn(true);
      setLoading(false);
      return;
    }

    // If logged in but not admin, show permission banner and don't fetch
    if (!isAdmin) {
      setNotAuthorized(true);
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem("token");

      const res = await fetch(`${API_BASE_URL}/logs`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          setNotLoggedIn(true);
          setLogs([]);
          setLoading(false);
          return;
        }
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.message || `Failed to fetch logs (${res.status})`);
      }

      const data = await res.json().catch(() => null);
      const list = Array.isArray(data) ? data : (Array.isArray((data as any).logs) ? (data as any).logs : []);
      setLogs(list);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || "Unknown error");
      setLoading(false);
    }
  }

  fetchLogs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);


  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.source.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLevel = selectedLevel === "all" || log.level === selectedLevel;
    return matchesSearch && matchesLevel;
  });

  // Pagination
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 100;
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));

  // Reset to first page when filters/search change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, selectedLevel]);

  const visibleLogs = filteredLogs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const logCounts = {
    all: logs.length,
    info: logs.filter((l) => l.level === "info").length,
    warning: logs.filter((l) => l.level === "warning").length,
    error: logs.filter((l) => l.level === "error").length,
    success: logs.filter((l) => l.level === "success").length,
  };

  if (loading) return <p className="text-slate-500">Loading logs...</p>;

  return (
    <div>
      {notLoggedIn && (
        <Card className="mb-6 p-4 border border-yellow-200 bg-yellow-50">
          <div className="text-yellow-800">You are not logged in. Sign in to view system logs.</div>
        </Card>
      )}
      {notAuthorized && (
        <Card className="mb-6 p-4 border border-red-200 bg-red-50">
          <div className="text-red-800">You do not have permission to view system logs.</div>
        </Card>
      )}
      <div className="mb-8">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="text-slate-400 hover:text-slate-600 transition-colors">
                <HelpCircle className="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-sm p-4">
              <div className="space-y-2">
                <p className="font-medium text-sm text-white">How to use System Logs:</p>
                <ul className="text-sm space-y-1.5 text-white/90">
                  <li>• Filter logs by clicking the log type cards</li>
                  <li>• Use the search bar to find specific messages</li>
                  <li>• Log levels include Info, Success, Warning, and Error</li>
                  <li>• Timestamps show when each event occurred</li>
                  <li>• Source identifies which device or component created the log</li>
                </ul>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <p className="text-slate-600">View and monitor system activity and events</p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        {(["all", "info", "success", "warning", "error"] as const).map((lvl) => (
          <Card key={lvl} className="p-4">
            <button
              onClick={() => { setSelectedLevel(lvl); setCurrentPage(1); }}
              className={`w-full text-left ${
                selectedLevel === lvl ? "opacity-100" : "opacity-60"
              }`}
            >
              {lvl === "all" ? (
                <>
                  <p className="text-sm text-slate-600 mb-1">All Logs</p>
                  <p className="text-2xl text-slate-900">{logCounts.all}</p>
                </>
                ) : (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    {(() => {
                      const cfg = (levelConfig as any)[lvl] ?? levelConfig.info;
                      const Icon = cfg.icon ?? Info;
                      return <Icon className={`w-4 h-4 ${cfg.color}`} />;
                    })()}
                    <p className="text-sm text-slate-600">
                      {(levelConfig as any)[lvl]?.label ?? levelConfig.info.label}
                    </p>
                  </div>
                  <p className="text-2xl text-slate-900">{logCounts[lvl]}</p>
                </>
              )}
            </button>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search logs by message or source..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="pl-10"
          />
        </div>
      </div>

      {/* Logs Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">Timestamp</TableHead>
              <TableHead className="w-[120px]">Level</TableHead>
              <TableHead className="w-[200px]">Source</TableHead>
              <TableHead>Message</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {visibleLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-slate-500 py-8">
                  No logs found matching your criteria
                </TableCell>
              </TableRow>
            ) : (
              visibleLogs.map((log) => {
                const config = levelConfig[log.level as LogLevel] ?? levelConfig.info;
                const Icon = config.icon ?? Info;

                return (
                  <TableRow key={log.id}>
                    <TableCell className="text-slate-600 text-sm font-mono">
                      {log.timestamp}
                    </TableCell>
                    <TableCell>
                      <Badge className={`${config.bgColor} ${config.color}`}>
                        <Icon className="w-3 h-3 mr-1" />
                        {config.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-900">{log.source}</TableCell>
                    <TableCell className="text-slate-600">{log.message}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {filteredLogs.length > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <div>
            Showing {(page - 1) * PAGE_SIZE + 1} - {Math.min(page * PAGE_SIZE, filteredLogs.length)} of {filteredLogs.length} log entries
          </div>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1 bg-slate-100 rounded disabled:opacity-50"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Previous
            </button>
            <span>Page {page} / {totalPages}</span>
            <button
              className="px-3 py-1 bg-slate-100 rounded disabled:opacity-50"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
