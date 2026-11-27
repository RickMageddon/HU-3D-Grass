import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "../../ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "../../ui/dialog";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { priorityConfig } from "../lib/robotArmData";
import type { RobotArmQueuePriority } from "../types/robotArm";
import type { AddTaskDialogProps } from "../types/robotArmProps";

const supportedExtensions = [".stl", ".step", ".stp", ".3mf", ".obj", ".gcode", ".sl1", ".ctb", ".photon"];
const priorities: RobotArmQueuePriority[] = ["low", "normal", "high"];

export function AddTaskDialog({ armName, printers }: AddTaskDialogProps) {
    const [open, setOpen] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [printerId, setPrinterId] = useState("");
    const [quantity, setQuantity] = useState("1");
    const [priority, setPriority] = useState<RobotArmQueuePriority>("normal");

    const handleOpenChange = (next: boolean) => {
        setOpen(next);
        if (!next) {
            setFile(null);
            setPrinterId("");
            setQuantity("1");
            setPriority("normal");
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button className="cursor-pointer gap-2 bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] text-white">
                    <Plus className="w-4 h-4" />
                    Taak toevoegen
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Nieuwe taak toevoegen</DialogTitle>
                    <DialogDescription>Voeg een nieuwe taak toe aan de wachtrij van {armName}.</DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 gap-4 py-2">
                    <div className="space-y-2">
                        <Label htmlFor="task-file">Printbestand</Label>
                        <Input
                            id="task-file"
                            type="file"
                            accept={supportedExtensions.join(",")}
                            className="cursor-pointer"
                            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                        />
                        <p className="text-xs text-slate-500">
                            Taaknaam, printduur en andere printgegevens worden automatisch uit het bestand gehaald.
                        </p>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500" style={{ flexWrap: "wrap" }}>
                            <span>Ondersteund:</span>
                            {supportedExtensions.map((ext) => (
                                <span key={ext} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-700">
                                    {ext}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="task-printer">Gekoppelde printer</Label>
                        <Select value={printerId} onValueChange={setPrinterId}>
                            <SelectTrigger id="task-printer" className="w-full cursor-pointer">
                                <SelectValue placeholder="Selecteer een printer..." />
                            </SelectTrigger>
                            <SelectContent>
                                {printers.map((p) => (
                                    <SelectItem key={p.id} value={String(p.id)}>
                                        {p.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="task-quantity">Aantal</Label>
                            <Input
                                id="task-quantity"
                                type="number"
                                min={1}
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                            />
                            <p className="text-xs text-slate-500">Aantal prints om te verwerken</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="task-priority">Prioriteit</Label>
                            <Select value={priority} onValueChange={(v: string) => setPriority(v as RobotArmQueuePriority)}>
                                <SelectTrigger id="task-priority" className="w-full cursor-pointer">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {priorities.map((p) => (
                                        <SelectItem key={p} value={p}>
                                            {priorityConfig[p].label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-slate-500">Bepaalt de positie in de wachtrij</p>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" className="cursor-pointer" onClick={() => handleOpenChange(false)}>
                        Annuleren
                    </Button>
                    <Button
                        className="cursor-pointer bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] text-white"
                        disabled={!file || !printerId}
                        onClick={() => handleOpenChange(false)}
                    >
                        Taak toevoegen
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
