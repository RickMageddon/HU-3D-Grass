import { useEffect, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { Progress } from "../../ui/progress";
import type { RobotArmQueueItem } from "../types/robotArm";
import type { BadgeLabelProps, ConnectionLabelProps, TaskProgressProps } from "../types/robotArmProps";
import { formatDuration } from "../lib/robotArmData";

function useNow(intervalMs = 1000): number {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), intervalMs);
        return () => clearInterval(id);
    }, [intervalMs]);
    return now;
}

/** Live voortgang van een taak op basis van startedAt en estimatedDuration. */
export function useTaskProgress(item: RobotArmQueueItem) {
    const now = useNow();
    if (!item.startedAt) return null;
    const until = item.status === "paused" ? Date.parse(item.updatedAt) : now;
    const elapsed = Math.max(0, Math.floor((until - Date.parse(item.startedAt)) / 1000));
    const percent = Math.min(100, Math.round((elapsed / item.estimatedDuration) * 100));
    return { percent, remaining: item.estimatedDuration - elapsed };
}

export function TaskProgress({ item }: TaskProgressProps) {
    const progress = useTaskProgress(item);
    if (!progress) return null;
    const { percent, remaining } = progress;
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

export function BadgeLabel({ badge, withDot = true }: BadgeLabelProps) {
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

export function ConnectionLabel({ connection }: ConnectionLabelProps) {
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
