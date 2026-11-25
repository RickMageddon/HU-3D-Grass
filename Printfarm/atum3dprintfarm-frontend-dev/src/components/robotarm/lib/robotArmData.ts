import type {
    ArmRow,
    Badge,
    QueueEntry,
    RobotArm,
    RobotArmData,
    RobotArmOperationalStatus,
    RobotArmQueueItem,
    RobotArmQueuePriority,
    RobotArmQueueStatus,
    RobotArmTaskType,
} from "../types/robotArm";
import robotArmData from "../data/robotArms.json";

export const data = robotArmData as RobotArmData;

export const statusConfig: Record<RobotArmOperationalStatus, Badge> = {
    active: { label: "Active", color: "#15803d", bg: "#f0fdf4", dot: "#22c55e" },
    idle: { label: "Idle", color: "#475569", bg: "#f1f5f9", dot: "#94a3b8" },
    paused: { label: "Paused", color: "#b45309", bg: "#fffbeb", dot: "#f59e0b" },
    error: { label: "Error", color: "#b91c1c", bg: "#fef2f2", dot: "#ef4444" },
};

export const queueStatusConfig: Record<RobotArmQueueStatus, Badge> = {
    queued: { label: "In wachtrij", color: "#1d4ed8", bg: "#eff6ff", dot: "#3b82f6" },
    active: { label: "Bezig", color: "#15803d", bg: "#f0fdf4", dot: "#22c55e" },
    paused: { label: "Gepauzeerd", color: "#b45309", bg: "#fffbeb", dot: "#f59e0b" },
    completed: { label: "Voltooid", color: "#475569", bg: "#f1f5f9", dot: "#94a3b8" },
    failed: { label: "Mislukt", color: "#b91c1c", bg: "#fef2f2", dot: "#ef4444" },
    cancelled: { label: "Geannuleerd", color: "#475569", bg: "#f1f5f9", dot: "#cbd5e1" },
};

export const priorityConfig: Record<RobotArmQueuePriority, Badge> = {
    high: { label: "Hoog", color: "#b91c1c", bg: "#fef2f2", dot: "#ef4444" },
    normal: { label: "Normaal", color: "#475569", bg: "#f1f5f9", dot: "#94a3b8" },
    low: { label: "Laag", color: "#64748b", bg: "#f8fafc", dot: "#cbd5e1" },
};

export const taskTypeLabels: Record<RobotArmTaskType, string> = {
    pick_and_place: "Pick & Place",
    build_platform_swap: "Bouwplaat wisselen",
    resin_cartridge_replace: "Resincartridge vervangen",
    emergency_stop_recovery: "Herstel na noodstop",
};

export const priorityRank: Record<RobotArmQueuePriority, number> = { high: 0, normal: 1, low: 2 };

const jobsById = new Map(data.printJobs.map((j) => [j.id, j]));
const printersById = new Map(data.printers.map((p) => [p.id, p]));

export function toEntry(item: RobotArmQueueItem): QueueEntry {
    return {
        item,
        job: item.printJobId != null ? jobsById.get(item.printJobId) : undefined,
        printer: item.printerId != null ? printersById.get(item.printerId) : undefined,
    };
}

const finishedStatuses: RobotArmQueueStatus[] = ["completed", "failed", "cancelled"];

export function buildRow(arm: RobotArm): ArmRow {
    const queue = data.robotArmQueue.filter((q) => q.robotArmId === arm.id);
    const current = queue.find((q) => q.status === "active") ?? queue.find((q) => q.status === "paused");
    const upcoming = queue
        .filter((q) => q.status === "queued")
        .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || a.createdAt.localeCompare(b.createdAt))
        .map(toEntry);
    const history = queue
        .filter((q) => finishedStatuses.includes(q.status))
        .sort((a, b) => (b.completedAt ?? b.updatedAt).localeCompare(a.completedAt ?? a.updatedAt))
        .map(toEntry);
    const relevant = queue.filter((q) => q.status !== "cancelled");
    return {
        id: arm.id,
        arm,
        currentTask: current ? toEntry(current) : undefined,
        upcoming,
        history,
        doneCount: relevant.filter((q) => q.status === "completed").length,
        totalCount: relevant.length,
    };
}

export function describeTask(entry: QueueEntry | undefined): string {
    if (!entry) return "—";
    const label = taskTypeLabels[entry.item.taskType];
    return entry.job ? `${label} — ${entry.job.fileName}` : label;
}

export function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h) return `${h}u ${m}m`;
    return s ? `${m}m ${s}s` : `${m}m`;
}

export function formatTime(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
}

export function formatDateTime(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("nl-NL", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function formatDate(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("nl-NL", { year: "numeric", month: "2-digit", day: "2-digit" });
}
