import { useMemo, useState } from "react";
import DataTable, { type TableColumn } from "react-data-table-component";
import { Activity, AlertTriangle, Bot, Clock, Filter, ListOrdered, MapPin, Search } from "lucide-react";
import StatsCard from "../components/StatsCard";
import { BadgeLabel, ConnectionLabel, TaskProgress } from "../components/RobotArmBadges";
import { QueueTable, tableStyles } from "../components/QueueTable";
import { Card } from "../../ui/card";
import { Input } from "../../ui/input";
import { Progress } from "../../ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import type { ArmRow, QueueRow, RobotArmOperationalStatus } from "../types/robotArm";
import type { RobotArmHomepageProps } from "../types/robotArmProps";
import {
    buildRow,
    data,
    describeTask,
    formatDuration,
    formatTime,
    priorityConfig,
    queueStatusConfig,
    statusConfig,
    taskTypeLabels,
} from "../lib/robotArmData";

function queuePercent(row: ArmRow): number {
    return row.totalCount ? Math.round((row.doneCount / row.totalCount) * 100) : 0;
}

function buildArmColumns(onSelectArm: (armId: number) => void): TableColumn<ArmRow>[] {
    return [
        {
            name: "Naam / Serienummer",
            selector: (row) => row.arm.name,
            cell: (row) => (
                <button type="button" className="text-left" onClick={() => onSelectArm(row.arm.id)}>
                    <div className="text-[var(--brand-blue)] hover:underline">{row.arm.name}</div>
                    <div className="text-xs text-slate-500">{row.arm.serialNumber}</div>
                </button>
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
}

export const RobotArmHomepage = ({ onSelectArm }: RobotArmHomepageProps) => {
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<RobotArmOperationalStatus | "all">("all");

    const rows = useMemo(() => data.robotArms.map(buildRow), []);
    const armColumns = useMemo(
        () => buildArmColumns(onSelectArm).map((col) => ({ ...col, sortable: true })),
        [onSelectArm],
    );

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
                    columns={armColumns}
                    data={filteredRows}
                    keyField="id"
                    customStyles={tableStyles}
                    highlightOnHover
                    pointerOnHover
                    onRowClicked={(row) => onSelectArm(row.arm.id)}
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
                                    <button type="button" className="text-left" onClick={() => onSelectArm(arm.id)}>
                                        <div className="text-[var(--brand-blue)] hover:underline">{arm.name}</div>
                                        <div className="text-xs text-slate-500">
                                            {arm.serialNumber} · {arm.location}
                                        </div>
                                    </button>
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
            <QueueTable rows={queueRows} emptyText="Geen taken in de wachtrij" />
        </div>
    );
};
