import { useMemo } from "react";
import { Activity, Bot, ChevronLeft, Cpu, Pause, Square } from "lucide-react";
import { BadgeLabel, ConnectionLabel, useTaskProgress } from "../components/RobotArmBadges";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import { Progress } from "../../ui/progress";
import { Tabs, TabsList, TabsTrigger } from "../../ui/tabs";
import {
    buildRow,
    data,
    describeTask,
    formatDate,
    formatDateTime,
    formatDuration,
    queueStatusConfig,
    statusConfig,
} from "../lib/robotArmData";
import type {
    CurrentTaskCardProps,
    CurrentTaskDetailsProps,
    InfoRowProps,
    InfoTileProps,
    RobotArmViewProps,
} from "../types/robotArmProps";

function InfoRow({ label, children }: InfoRowProps) {
    return (
        <div className="flex items-center justify-between gap-4 py-2 text-sm">
            <dt className="text-slate-600">{label}</dt>
            <dd className="text-slate-900 text-right">{children}</dd>
        </div>
    );
}

function InfoTile({ label, value }: InfoTileProps) {
    return (
        <div className="rounded-lg bg-slate-50 px-4 py-3">
            <div className="text-xs text-slate-500">{label}</div>
            <div className="text-slate-900">{value}</div>
        </div>
    );
}

function CurrentTaskCard({ task }: CurrentTaskCardProps) {
    return (
        <Card className="p-6">
            <h3 className="flex items-center gap-2 text-slate-900">
                <Activity className="w-4 h-4 text-[var(--brand-blue)]" />
                Huidige taak
            </h3>
            {task ? <CurrentTaskDetails task={task} /> : <p className="text-sm text-slate-500">Geen actieve taak</p>}
        </Card>
    );
}

function CurrentTaskDetails({ task }: CurrentTaskDetailsProps) {
    const { item, printer } = task;
    const progress = useTaskProgress(item);
    return (
        <div className="flex flex-col gap-4">
            <div>
                <div className="text-slate-900">{describeTask(task)}</div>
                <div className="text-xs text-slate-500">Printer: {printer?.name ?? "—"}</div>
            </div>
            {progress && (
                <div>
                    <div className="flex justify-between text-xs text-slate-600 mb-1">
                        <span>Voortgang</span>
                        <span>{progress.percent}%</span>
                    </div>
                    <Progress value={progress.percent} />
                </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InfoTile label="Gestart om" value={formatDateTime(item.startedAt)} />
                <InfoTile label="Geschatte duur" value={formatDuration(item.estimatedDuration)} />
            </div>
            <div>
                <BadgeLabel badge={queueStatusConfig[item.status]} withDot={false} />
            </div>
        </div>
    );
}

export const RobotArmView = ({ armId, onBack }: RobotArmViewProps) => {
    const row = useMemo(() => {
        const arm = data.robotArms.find((a) => a.id === armId);
        return arm ? buildRow(arm) : undefined;
    }, [armId]);

    const backLink = (
        <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 text-sm text-slate-700 hover:text-slate-900 mb-6"
        >
            <ChevronLeft className="w-4 h-4" />
            Terug naar overzicht
        </button>
    );

    if (!row) {
        return (
            <div>
                {backLink}
                <p className="text-sm text-slate-500">Robotarm niet gevonden</p>
            </div>
        );
    }

    const { arm, currentTask } = row;

    return (
        <div>
            {backLink}

            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-[var(--brand-blue-light)] rounded-lg">
                        <Bot className="w-6 h-6 text-[var(--brand-blue)]" />
                    </div>
                    <div>
                        <h2 className="text-xl text-slate-900">{arm.name}</h2>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                            <span>{arm.serialNumber}</span>
                            <BadgeLabel badge={statusConfig[arm.operationalStatus]} />
                            <ConnectionLabel connection={arm.connectionStatus} />
                        </div>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button variant="outline" className="cursor-pointer text-blue-600 border-blue-200 hover:text-blue-700">
                        <Pause className="w-4 h-4" />
                        Pauzeer
                    </Button>
                    <Button variant="outline" className="cursor-pointer text-red-600 border-red-200 hover:text-red-700">
                        <Square className="w-4 h-4" />
                        Stop
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="overview" className="mb-6">
                <TabsList>
                    <TabsTrigger value="overview">Overzicht</TabsTrigger>
                    <TabsTrigger value="queue" disabled>
                        Taakwachtrij
                    </TabsTrigger>
                    <TabsTrigger value="history" disabled>
                        Taakgeschiedenis
                    </TabsTrigger>
                    <TabsTrigger value="activity" disabled>
                        Activiteitenlog
                    </TabsTrigger>
                </TabsList>
            </Tabs>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-6">
                    <h3 className="flex items-center gap-2 text-slate-900">
                        <Cpu className="w-4 h-4 text-[var(--brand-blue)]" />
                        Robotarm informatie
                    </h3>
                    <dl>
                        <InfoRow label="Naam">{arm.name}</InfoRow>
                        <InfoRow label="ID">{arm.id}</InfoRow>
                        <InfoRow label="Merk">{arm.brand}</InfoRow>
                        <InfoRow label="Model">{arm.model}</InfoRow>
                        <InfoRow label="Serienummer">{arm.serialNumber}</InfoRow>
                        <InfoRow label="Firmware">{arm.firmwareVersion}</InfoRow>
                        <InfoRow label="IP-adres">{arm.ipAddress}</InfoRow>
                        <InfoRow label="Locatie">{arm.location}</InfoRow>
                        <InfoRow label="Toegevoegd op">{formatDate(arm.createdAt)}</InfoRow>
                        <InfoRow label="Verbinding">
                            <ConnectionLabel connection={arm.connectionStatus} />
                        </InfoRow>
                        <InfoRow label="Gekoppelde printer">{currentTask?.printer?.name ?? "—"}</InfoRow>
                    </dl>
                </Card>
                <CurrentTaskCard task={currentTask} />
            </div>
        </div>
    );
};
