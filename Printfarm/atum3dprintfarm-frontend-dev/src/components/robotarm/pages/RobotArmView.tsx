import { useEffect, useMemo, useState } from "react";
import DataTable, { type TableColumn, type TableStyles } from "react-data-table-component";
import { Activity, AlertTriangle, Bot, Clock, Filter, ListOrdered, MapPin, Search, Wifi, WifiOff } from "lucide-react";
import StatsCard from "../components/StatsCard";
import { Card } from "../../ui/card";
import { Input } from "../../ui/input";
import { Progress } from "../../ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import type {
    PrintJob,
    PrinterSummary,
    RobotArm,
    RobotArmConnectionStatus,
    RobotArmData,
    RobotArmOperationalStatus,
    RobotArmQueueItem,
    RobotArmQueuePriority,
    RobotArmQueueStatus,
    RobotArmTaskType,
} from "../types/robotArm";
import robotArmData from "../data/robotArms.json";

const data = robotArmData as RobotArmData;

type Badge = { label: string; color: string; bg: string; dot: string };

const statusConfig: Record<RobotArmOperationalStatus, Badge> = {
    active: { label: "Active", color: "#15803d", bg: "#f0fdf4", dot: "#22c55e" },
    idle: { label: "Idle", color: "#475569", bg: "#f1f5f9", dot: "#94a3b8" },
    paused: { label: "Paused", color: "#b45309", bg: "#fffbeb", dot: "#f59e0b" },
    error: { label: "Error", color: "#b91c1c", bg: "#fef2f2", dot: "#ef4444" },
};

const queueStatusConfig: Record<RobotArmQueueStatus, Badge> = {
    queued: { label: "In wachtrij", color: "#1d4ed8", bg: "#eff6ff", dot: "#3b82f6" },
    active: { label: "Bezig", color: "#15803d", bg: "#f0fdf4", dot: "#22c55e" },
    paused: { label: "Gepauzeerd", color: "#b45309", bg: "#fffbeb", dot: "#f59e0b" },
    completed: { label: "Voltooid", color: "#475569", bg: "#f1f5f9", dot: "#94a3b8" },
    failed: { label: "Mislukt", color: "#b91c1c", bg: "#fef2f2", dot: "#ef4444" },
    cancelled: { label: "Geannuleerd", color: "#475569", bg: "#f1f5f9", dot: "#cbd5e1" },
};

const priorityConfig: Record<RobotArmQueuePriority, Badge> = {
    high: { label: "Hoog", color: "#b91c1c", bg: "#fef2f2", dot: "#ef4444" },
    normal: { label: "Normaal", color: "#475569", bg: "#f1f5f9", dot: "#94a3b8" },
    low: { label: "Laag", color: "#64748b", bg: "#f8fafc", dot: "#cbd5e1" },
};

const taskTypeLabels: Record<RobotArmTaskType, string> = {
    pick_and_place: "Pick & Place",
    build_platform_swap: "Bouwplaat wisselen",
    resin_cartridge_replace: "Resincartridge vervangen",
    emergency_stop_recovery: "Herstel na noodstop",
};

const priorityRank: Record<RobotArmQueuePriority, number> = { high: 0, normal: 1, low: 2 };

interface QueueEntry {
    item: RobotArmQueueItem;
    job: PrintJob | undefined;
    printer: PrinterSummary | undefined;
}

interface ArmRow {
    id: number;
    arm: RobotArm;
    currentTask: QueueEntry | undefined;
    upcoming: QueueEntry[];
    doneCount: number;
    totalCount: number;
}

const jobsById = new Map(data.printJobs.map((j) => [j.id, j]));
const printersById = new Map(data.printers.map((p) => [p.id, p]));

function toEntry(item: RobotArmQueueItem): QueueEntry {
    return {
        item,
        job: item.printJobId != null ? jobsById.get(item.printJobId) : undefined,
        printer: item.printerId != null ? printersById.get(item.printerId) : undefined,
    };
}

function buildRow(arm: RobotArm): ArmRow {
    const queue = data.robotArmQueue.filter((q) => q.robotArmId === arm.id);
    const current = queue.find((q) => q.status === "active") ?? queue.find((q) => q.status === "paused");
    const upcoming = queue
        .filter((q) => q.status === "queued")
        .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || a.createdAt.localeCompare(b.createdAt))
        .map(toEntry);
    const relevant = queue.filter((q) => q.status !== "cancelled");
    return {
        id: arm.id,
        arm,
        currentTask: current ? toEntry(current) : undefined,
        upcoming,
        doneCount: relevant.filter((q) => q.status === "completed").length,
        totalCount: relevant.length,
    };
}

function describeTask(entry: QueueEntry | undefined): string {
    if (!entry) return "—";
    const label = taskTypeLabels[entry.item.taskType];
    return entry.job ? `${label} — ${entry.job.fileName}` : label;
}

function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h) return `${h}u ${m}m`;
    return s ? `${m}m ${s}s` : `${m}m`;
}

function formatTime(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
}

function useNow(intervalMs = 1000): number {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), intervalMs);
        return () => clearInterval(id);
    }, [intervalMs]);
    return now;
}

function TaskProgress({ item }: { item: RobotArmQueueItem }) {
    const now = useNow();
    if (!item.startedAt) return null;
    const until = item.status === "paused" ? Date.parse(item.updatedAt) : now;
    const elapsed = Math.max(0, Math.floor((until - Date.parse(item.startedAt)) / 1000));
    const percent = Math.min(100, Math.round((elapsed / item.estimatedDuration) * 100));
    const remaining = item.estimatedDuration - elapsed;
    return (
        <div className="w-full">
            <div className="flex justify-between gap-2 text-xs text-slate-600 mb-1">
                <span>{percent}%</span>
                <span>
                    {remaining > 0
                        ? `nog ~${formatDuration(remaining)}`
                        : `${formatDuration(-remaining)} over geschatte duur`}
                </span>
            </div>
            <Progress value={percent} />
        </div>
    );
}

function queuePercent(row: ArmRow): number {
    return row.totalCount ? Math.round((row.doneCount / row.totalCount) * 100) : 0;
}

function BadgeLabel({ badge, withDot = true }: { badge: Badge; withDot?: boolean }) {
    return (
        <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-sm whitespace-nowrap"
            style={{ color: badge.color, backgroundColor: badge.bg }}
        >
            {withDot && <span style={{ width: 6, height: 6, borderRadius: 9999, backgroundColor: badge.dot }} />}
            {badge.label}
        </span>
    );
}

function ConnectionLabel({ connection }: { connection: RobotArmConnectionStatus }) {
    const connected = connection === "connected";
    const Icon = connected ? Wifi : WifiOff;
    const label = connected ? "Connected" : connection === "error" ? "Verbindingsfout" : "Disconnected";
    return (
        <span className="inline-flex items-center gap-1 text-sm" style={{ color: connected ? "#16a34a" : "#dc2626" }}>
            <Icon className="w-4 h-4" />
            {label}
        </span>
    );
}

const armColumns: TableColumn<ArmRow>[] = [
    {
        name: "Naam / Serienummer",
        selector: (row) => row.arm.name,
        cell: (row) => (
            <div>
                <div className="text-[var(--brand-blue)]">{row.arm.name}</div>
                <div className="text-xs text-slate-500">{row.arm.serialNumber}</div>
            </div>
        ),
    },
    {
        name: "Merk & Model",
        selector: (row) => `${row.arm.brand} ${row.arm.model}`,
        cell: (row) => (
            <div>
                <div className="text-slate-900">{row.arm.brand}</div>
                <div className="text-xs text-slate-500">
                    {row.arm.model} · fw {row.arm.firmwareVersion}
                </div>
            </div>
        ),
    },
    {
        name: "Status",
        selector: (row) => row.arm.operationalStatus,
        cell: (row) => <BadgeLabel badge={statusConfig[row.arm.operationalStatus]} />,
    },
    {
        name: "Verbinding",
        selector: (row) => row.arm.connectionStatus,
        cell: (row) => <ConnectionLabel connection={row.arm.connectionStatus} />,
    },
    {
        name: "Huidige taak",
        selector: (row) => describeTask(row.currentTask),
        cell: (row) => (
            <div className="w-full py-2">
                <div className="text-slate-900 mb-1">{describeTask(row.currentTask)}</div>
                {row.currentTask && <TaskProgress item={row.currentTask.item} />}
            </div>
        ),
        grow: 2,
    },
    {
        name: "Gekoppelde printer",
        selector: (row) => row.currentTask?.printer?.name ?? "",
        cell: (row) => <span className="text-slate-900">{row.currentTask?.printer?.name ?? "—"}</span>,
    },
    {
        name: "Wachtrij",
        selector: (row) => queuePercent(row),
        cell: (row) => (
            <div className="w-full">
                <div className="text-xs text-slate-600 mb-1">
                    {row.doneCount} van {row.totalCount} taken klaar
                </div>
                <Progress value={queuePercent(row)} />
            </div>
        ),
    },
    {
        name: "Locatie",
        selector: (row) => row.arm.location,
        cell: (row) => (
            <span className="inline-flex items-center gap-1 text-slate-900">
                <MapPin className="w-3 h-3 text-slate-500" />
                {row.arm.location}
            </span>
        ),
    },
];

interface QueueRow extends QueueEntry {
    id: number;
    armName: string;
}

const queueColumns: TableColumn<QueueRow>[] = [
    { name: "#", selector: (row) => row.item.id, width: "64px" },
    {
        name: "Taak",
        selector: (row) => taskTypeLabels[row.item.taskType],
        cell: (row) => (
            <div>
                <div className="text-slate-900">{taskTypeLabels[row.item.taskType]}</div>
                <div className="text-xs text-slate-500">{row.armName}</div>
            </div>
        ),
        grow: 2,
    },
    {
        name: "Printjob",
        selector: (row) => row.job?.fileName ?? "",
        cell: (row) => <span className="text-slate-900">{row.job?.fileName ?? "—"}</span>,
        grow: 2,
    },
    {
        name: "Printer",
        selector: (row) => row.printer?.name ?? "",
        cell: (row) => <span className="text-slate-900">{row.printer?.name ?? "—"}</span>,
    },
    {
        name: "Prioriteit",
        selector: (row) => priorityRank[row.item.priority],
        cell: (row) => <BadgeLabel badge={priorityConfig[row.item.priority]} withDot={false} />,
    },
    {
        name: "Status",
        selector: (row) => row.item.status,
        cell: (row) => <BadgeLabel badge={queueStatusConfig[row.item.status]} />,
    },
    {
        name: "Geschatte duur",
        selector: (row) => row.item.estimatedDuration,
        cell: (row) => <span className="text-slate-900">{formatDuration(row.item.estimatedDuration)}</span>,
    },
];

const tableStyles: TableStyles = {
    table: { style: { backgroundColor: "#ffffff" } },
    headRow: {
        style: { minHeight: "48px", borderBottom: "1px solid #e2e8f0" },
    },
    headCells: {
        style: { fontSize: "14px", fontWeight: 500, color: "#0f172a" },
    },
    rows: {
        style: {
            minHeight: "60px",
            fontSize: "14px",
            "&:not(:last-of-type)": { borderBottom: "1px solid #e2e8f0" },
        },
        highlightOnHoverStyle: { backgroundColor: "#f8fafc", outline: "none" },
    },
    pagination: { style: { borderTop: "1px solid #e2e8f0", color: "#475569" } },
};

export const RobotArmView = () => {
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<RobotArmOperationalStatus | "all">("all");

    const rows = useMemo(() => data.robotArms.map(buildRow), []);

    const overview = useMemo(
        () => ({
            total: rows.length,
            active: rows.filter((r) => r.arm.operationalStatus === "active").length,
            queued: rows.reduce((sum, r) => sum + r.upcoming.length, 0),
            attention: rows.filter(
                (r) => r.arm.operationalStatus === "error" || r.arm.connectionStatus !== "connected",
            ).length,
        }),
        [rows],
    );

    const filteredRows = rows.filter(({ arm }) => {
        const query = search.toLowerCase();
        const matchesSearch = [arm.name, arm.serialNumber, arm.brand, arm.model].some((v) =>
            v.toLowerCase().includes(query),
        );
        const matchesStatus = statusFilter === "all" || arm.operationalStatus === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const queueRows: QueueRow[] = rows.flatMap((r) => {
        const current = r.currentTask ? [r.currentTask] : [];
        return [...current, ...r.upcoming].map((entry) => ({ ...entry, id: entry.item.id, armName: r.arm.name }));
    });

    const rowsWithTask = rows.filter((r) => r.currentTask);

    return (
        <div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                <StatsCard
                    icon={<Bot className="w-6 h-6 text-[var(--brand-blue)]" />}
                    color="bg-[var(--brand-blue-light)]"
                    title="Totaal armen"
                    value={String(overview.total)}
                />
                <StatsCard
                    icon={<Activity className="w-6 h-6 text-green-600" />}
                    color="bg-green-50"
                    title="Actief"
                    value={String(overview.active)}
                />
                <StatsCard
                    icon={<ListOrdered className="w-6 h-6 text-slate-600" />}
                    color="bg-slate-100"
                    title="Taken in wachtrij"
                    value={String(overview.queued)}
                />
                <StatsCard
                    icon={<AlertTriangle className="w-6 h-6 text-red-600" />}
                    color="bg-red-50"
                    title="Aandacht vereist"
                    value={String(overview.attention)}
                />
            </div>

            <div className="flex items-center gap-4 mb-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        placeholder="Zoek op naam, serienummer, merk of model..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <div style={{ width: 220 }}>
                    <Select
                        value={statusFilter}
                        onValueChange={(v: string) => setStatusFilter(v as RobotArmOperationalStatus | "all")}
                    >
                        <SelectTrigger className="w-full">
                            <Filter className="w-4 h-4 text-slate-400" />
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Alle statussen</SelectItem>
                            <SelectItem value="active">Actief</SelectItem>
                            <SelectItem value="idle">Inactief</SelectItem>
                            <SelectItem value="paused">Gepauzeerd</SelectItem>
                            <SelectItem value="error">Fout</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <Card className="overflow-hidden mb-6">
                <DataTable
                    columns={armColumns.map((col) => ({ ...col, sortable: true }))}
                    data={filteredRows}
                    keyField="id"
                    customStyles={tableStyles}
                    highlightOnHover
                    pagination
                    paginationPerPage={10}
                    paginationRowsPerPageOptions={[10, 25, 50, 100]}
                    noDataComponent={<div className="p-6 text-slate-500">Geen robotarmen gevonden</div>}
                />
            </Card>

            <h2 className="text-lg text-slate-900 mb-4">Huidige taak</h2>
            {rowsWithTask.length === 0 ? (
                <p className="text-sm text-slate-500 mb-6">Geen actieve taken</p>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    {rowsWithTask.map(({ arm, currentTask, upcoming }) => {
                        const { item, job, printer } = currentTask!;
                        return (
                            <Card key={arm.id} className="p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-[var(--brand-blue)]">{arm.name}</div>
                                        <div className="text-xs text-slate-500">
                                            {arm.serialNumber} · {arm.location}
                                        </div>
                                    </div>
                                    <BadgeLabel badge={queueStatusConfig[item.status]} withDot={false} />
                                </div>
                                <div className="text-slate-900">{taskTypeLabels[item.taskType]}</div>
                                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                                    <dt className="text-slate-500">Printjob</dt>
                                    <dd className="text-slate-900">{job?.fileName ?? "—"}</dd>
                                    <dt className="text-slate-500">Printer</dt>
                                    <dd className="text-slate-900">{printer?.name ?? "—"}</dd>
                                    <dt className="text-slate-500">Materiaal</dt>
                                    <dd className="text-slate-900">{job?.material ?? "—"}</dd>
                                    <dt className="text-slate-500">Prioriteit</dt>
                                    <dd className="text-slate-900">{priorityConfig[item.priority].label}</dd>
                                    <dt className="text-slate-500">Gestart</dt>
                                    <dd className="text-slate-900">{formatTime(item.startedAt)}</dd>
                                    <dt className="text-slate-500">Geschatte duur</dt>
                                    <dd className="text-slate-900 inline-flex items-center gap-1">
                                        <Clock className="w-3 h-3 text-slate-500" />
                                        {formatDuration(item.estimatedDuration)}
                                    </dd>
                                </dl>
                                <div className="text-sm text-slate-500">
                                    Volgende: {upcoming[0] ? describeTask(upcoming[0]) : "geen"}
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}

            <h2 className="text-lg text-slate-900 mb-4">Wachtrij</h2>
            <Card className="overflow-hidden">
                <DataTable
                    columns={queueColumns}
                    data={queueRows}
                    keyField="id"
                    customStyles={tableStyles}
                    highlightOnHover
                    noDataComponent={<div className="p-6 text-slate-500">Geen taken in de wachtrij</div>}
                />
            </Card>
        </div>
    );
};
