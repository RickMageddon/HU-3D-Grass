import { useMemo, useState } from "react";
import { Activity, Bot, ChevronLeft, Cpu, Pause, Square } from "lucide-react";
import { BadgeLabel, ConnectionLabel, useTaskProgress } from "../components/RobotArmBadges";
import { AddTaskDialog } from "../components/AddTaskDialog";
import { ArmQueueTable } from "../components/QueueTable";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import { Progress } from "../../ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";
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
import type { QueueRow } from "../types/robotArm";
import type {
    CurrentTaskCardProps,
    CurrentTaskDetailsProps,
    InfoRowProps,
    InfoTileProps,
    RobotArmViewProps,
} from "../types/robotArmProps";

function tabTriggerClass(active: boolean): string {
    const base = "cursor-pointer px-3 transition-colors";
    return active
        ? `${base} bg-[var(--brand-blue)] text-white shadow-sm`
        : `${base} text-slate-600 hover:bg-slate-100 hover:text-[var(--brand-blue)]`;
}

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
    const [activeTab, setActiveTab] = useState("overview");

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

    const { arm, currentTask, upcoming } = row;
    const queueRows: QueueRow[] = [...(currentTask ? [currentTask] : []), ...upcoming].map((entry) => ({
        ...entry,
        id: entry.item.id,
    }));

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

            <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-6">
                <TabsList>
                    <TabsTrigger value="overview" className={tabTriggerClass(activeTab === "overview")}>
                        Overzicht
                    </TabsTrigger>
                    <TabsTrigger value="queue" className={tabTriggerClass(activeTab === "queue")}>
                        Taakwachtrij ({queueRows.length})
                    </TabsTrigger>
                    <TabsTrigger value="history" className={tabTriggerClass(false)} disabled>
                        Taakgeschiedenis
                    </TabsTrigger>
                    <TabsTrigger value="activity" className={tabTriggerClass(false)} disabled>
                        Activiteitenlog
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="overview">
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
                </TabsContent>

                <TabsContent value="queue">
                    <Card className="p-6">
                        <div className="flex items-start justify-between gap-4 mb-2">
                            <div>
                                <h3 className="text-lg text-slate-900">Taakwachtrij</h3>
                                <p className="text-sm text-slate-500">
                                    De volgorde wordt automatisch bepaald op basis van prioriteit.
                                </p>
                            </div>
                            <AddTaskDialog armName={arm.name} printers={data.printers} />
                        </div>
                        <ArmQueueTable rows={queueRows} emptyText="Geen taken in de wachtrij" />
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
};
