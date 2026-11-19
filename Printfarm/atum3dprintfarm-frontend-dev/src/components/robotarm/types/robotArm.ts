export type RobotArmOperationalStatus = "idle" | "active" | "paused" | "error";
export type RobotArmConnectionStatus = "connected" | "disconnected" | "error";

export interface RobotArm {
    id: number;
    name: string;
    brand: string;
    model: string;
    serialNumber: string;
    firmwareVersion: string;
    ipAddress: string;
    location: string;
    connectionStatus: RobotArmConnectionStatus;
    operationalStatus: RobotArmOperationalStatus;
    lastSeenAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export type RobotArmTaskType =
    | "pick_and_place"
    | "build_platform_swap"
    | "resin_cartridge_replace"
    | "emergency_stop_recovery";
export type RobotArmQueueStatus = "queued" | "active" | "paused" | "completed" | "failed" | "cancelled";
export type RobotArmQueuePriority = "low" | "normal" | "high";

export interface RobotArmQueueItem {
    id: number;
    robotArmId: number;
    printJobId: number | null;
    printerId: number | null;
    taskType: RobotArmTaskType;
    status: RobotArmQueueStatus;
    priority: RobotArmQueuePriority;
    quantity: number;
    estimatedDuration: number;
    startedAt: string | null;
    completedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export type PrintJobStatus = "queued" | "printing" | "paused" | "completed" | "failed" | "cancelled";

export interface PrintJob {
    id: number;
    printerId: number | null;
    userId: number | null;
    fileName: string;
    filePath: string;
    fileSize: string;
    status: PrintJobStatus;
    progress: number | null;
    timeRemaining: string | null;
    timeElapsed: string | null;
    startedAt: string | null;
    completedAt: string | null;
    queuePosition: number | null;
    estimatedTime: string | null;
    material: string | null;
    currentLayer: number | null;
    totalLayers: number | null;
    volume: number | null;
    createdAt: string;
    updatedAt: string;
}

export interface PrinterSummary {
    id: number;
    name: string;
    model: string;
    status: string;
    location: string;
}

export interface RobotArmData {
    robotArms: RobotArm[];
    printers: PrinterSummary[];
    printJobs: PrintJob[];
    robotArmQueue: RobotArmQueueItem[];
}
