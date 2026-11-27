import DataTable, { type TableColumn, type TableStyles } from "react-data-table-component";
import { Trash2 } from "lucide-react";
import { Card } from "../../ui/card";
import { BadgeLabel } from "./RobotArmBadges";
import {
    describeTask,
    formatDuration,
    priorityConfig,
    priorityRank,
    queueStatusConfig,
    taskTypeLabels,
} from "../lib/robotArmData";
import type { QueueRow } from "../types/robotArm";
import type { QueueTableProps } from "../types/robotArmProps";

export const tableStyles: TableStyles = {
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

const queueColumns: TableColumn<QueueRow>[] = [
    { name: "#", selector: (row) => row.item.id, width: "64px" },
    {
        name: "Taak",
        selector: (row) => taskTypeLabels[row.item.taskType],
        cell: (row) => (
            <div>
                <div className="text-slate-900">{taskTypeLabels[row.item.taskType]}</div>
                {row.armName && <div className="text-xs text-slate-500">{row.armName}</div>}
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

const armQueueStyles: TableStyles = {
    table: { style: { backgroundColor: "transparent" } },
    rows: {
        style: {
            minHeight: "64px",
            fontSize: "14px",
            backgroundColor: "#f8fafc",
            border: "1px solid #f1f5f9",
            borderRadius: "12px",
            marginBottom: "8px",
        },
    },
};

function describeQueueDetails(row: QueueRow): string {
    return [
        row.printer?.name ?? "Geen printer",
        `${row.item.quantity}×`,
        formatDuration(row.item.estimatedDuration),
        `Prioriteit: ${priorityConfig[row.item.priority].label}`,
    ].join(" · ");
}

const armQueueColumns: TableColumn<QueueRow>[] = [
    {
        name: "#",
        cell: (_row, index) => <span className="text-slate-400">{index + 1}</span>,
        width: "56px",
        center: true,
    },
    {
        name: "Taak",
        cell: (row) => (
            <div className="min-w-0 py-2">
                <div className="text-base text-slate-900">{describeTask(row)}</div>
                <div className="text-sm text-slate-500">{describeQueueDetails(row)}</div>
            </div>
        ),
        grow: 1,
    },
    {
        name: "Status",
        cell: (row) => <BadgeLabel badge={queueStatusConfig[row.item.status]} withDot={false} />,
        width: "140px",
        right: true,
    },
    {
        name: "Acties",
        cell: (row) => (
            <button
                type="button"
                aria-label={`Verwijder taak ${row.item.id}`}
                className="cursor-pointer rounded-md p-2 text-red-600 hover:bg-slate-100"
            >
                <Trash2 className="w-4 h-4" />
            </button>
        ),
        width: "64px",
        center: true,
    },
];

export function ArmQueueTable({ rows, emptyText }: QueueTableProps) {
    return (
        <DataTable
            columns={armQueueColumns}
            data={rows}
            keyField="id"
            customStyles={armQueueStyles}
            noTableHead
            noDataComponent={<div className="p-6 text-slate-500">{emptyText}</div>}
        />
    );
}

export function QueueTable({ rows, emptyText }: QueueTableProps) {
    return (
        <Card className="overflow-hidden">
            <DataTable
                columns={queueColumns}
                data={rows}
                keyField="id"
                customStyles={tableStyles}
                highlightOnHover
                noDataComponent={<div className="p-6 text-slate-500">{emptyText}</div>}
            />
        </Card>
    );
}
