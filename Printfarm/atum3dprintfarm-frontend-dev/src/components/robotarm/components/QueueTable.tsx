import DataTable, { type TableColumn, type TableStyles } from "react-data-table-component";
import { Card } from "../../ui/card";
import { BadgeLabel } from "./RobotArmBadges";
import {
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
