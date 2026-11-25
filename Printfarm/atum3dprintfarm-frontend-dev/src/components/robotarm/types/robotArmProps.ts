import type { ReactNode } from "react";
import type { Badge, QueueEntry, QueueRow, RobotArmConnectionStatus, RobotArmQueueItem } from "./robotArm";

export interface StatCardProps {
    icon: ReactNode;
    color: string;
    title: string;
    value: string;
}

export interface TaskProgressProps {
    item: RobotArmQueueItem;
}

export interface BadgeLabelProps {
    badge: Badge;
    withDot?: boolean;
}

export interface ConnectionLabelProps {
    connection: RobotArmConnectionStatus;
}

export interface QueueTableProps {
    rows: QueueRow[];
    emptyText: string;
}

export interface InfoRowProps {
    label: string;
    children: ReactNode;
}

export interface InfoTileProps {
    label: string;
    value: string;
}

export interface CurrentTaskCardProps {
    task: QueueEntry | undefined;
}

export interface CurrentTaskDetailsProps {
    task: QueueEntry;
}

export interface RobotArmViewProps {
    armId: number;
    onBack: () => void;
}

export interface RobotArmHomepageProps {
    onSelectArm: (armId: number) => void;
}
