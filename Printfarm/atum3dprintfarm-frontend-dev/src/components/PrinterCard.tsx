import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { Droplet, Clock, Layers } from "lucide-react";

export interface Printer {
  id: string;
  name: string;
  status: "printing" | "idle" | "error" | "paused";
  currentJob?: string;
  progress?: number;
  timeRemaining?: string;
  resinLevel?: number;
  resinType?: string;
  layer?: string;
  currentlayer?: number;
  currentLayer?: number;
  totallayers?: number;
  totalLayers?: number;
  model?: string;
  sensorIp?: string | null;
}

interface PrinterCardProps {
  printer: Printer;
  onNameClick?: () => void;
}

export function PrinterCard({ printer, onNameClick }: PrinterCardProps) {
  const layerText = (() => {
    const current = printer.currentlayer ?? printer.currentLayer;
    const total = printer.totallayers ?? printer.totalLayers;
    if (current !== undefined && total !== undefined) return `${current}/${total}`;
    if (current !== undefined) return `${current}`;
    return printer.layer || "--";
  })();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "printing":
        return "bg-green-500";
      case "idle":
        return "bg-slate-400";
      case "error":
        return "bg-red-500";
      case "paused":
        return "bg-yellow-500";
      default:
        return "bg-slate-400";
    }
  };

  const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "printing":
        return "default";
      case "error":
        return "destructive";
      default:
        return "secondary";
    }
  };

  return (
    <Card className="p-6 h-full flex flex-col">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className={`w-3 h-3 rounded-full ${getStatusColor(printer.status)}`}></div>
            <h3 
              className={`text-slate-900 ${onNameClick ? 'cursor-pointer hover:text-[var(--brand-blue)] transition-colors' : ''}`}
              onClick={onNameClick}
            >
              {printer.name}
            </h3>
          </div>
          <p className="text-sm text-slate-500">{printer.model || "DLP STATION 5-405"}</p>
        </div>
        <Badge variant={getStatusBadgeVariant(printer.status)} className={`capitalize ${printer.status === 'printing' ? 'bg-[#0082be] hover:bg-[#0082be]' : ''}`}>
          {printer.status}
        </Badge>
      </div>

      <div className="flex-1 flex flex-col justify-between">
        {printer.status === "printing" && (
          <>
            {printer.currentJob ? (
              <div className="mb-4">
                <p className="text-sm text-slate-600 mb-2">{printer.currentJob}</p>
                <Progress value={printer.progress || 0} className="h-2" />
                <p className="text-sm text-slate-500 mt-1">{printer.progress}% complete</p>
              </div>
            ) : (
              <div className="py-6 text-center flex-1 flex items-center justify-center">
                <p className="text-slate-400">Printing</p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 pt-4 border-t border-slate-200">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-slate-500">Time Left</p>
                    <p className="text-sm text-slate-900">{printer.timeRemaining || "--"}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-slate-500">Layer</p>
                    <p className="text-sm text-slate-900">{layerText}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Droplet className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-500">Resin</p>
                  <p className="text-sm text-slate-900 truncate">
                    {printer.resinType ? `${printer.resinType}/${printer.resinLevel}%` : (printer.resinLevel !== undefined ? `${printer.resinLevel}%` : "Unknown")}
                    {(!printer.sensorIp) && printer.resinLevel !== undefined && (
                      <span className="ml-2 text-xs text-yellow-700 italic">(from DB)</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {printer.status === "idle" && (
          <>
            <div className="py-6 text-center flex-1 flex items-center justify-center">
              <p className="text-slate-400">Ready for next job</p>
            </div>
            {printer.resinType && printer.resinLevel !== undefined && (
              <div className="flex items-center gap-2 pt-4 border-t border-slate-200">
                <Droplet className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">Resin</p>
                  <p className="text-sm text-slate-900">{printer.resinType}/{printer.resinLevel}%{(!printer.sensorIp) && (
                    <span className="ml-2 text-xs text-yellow-700 italic">(from DB)</span>
                  )}</p>
                </div>
              </div>
            )}
          </>
        )}

        {printer.status === "error" && (
          <>
            <div className="flex-1 flex flex-col justify-center">
              <div className="py-4 px-4 bg-red-50 rounded-lg mb-4">
                <p className="text-sm text-red-800">Error: Connection lost. Please check printer.</p>
              </div>
            </div>
            {printer.resinType && printer.resinLevel !== undefined && (
              <div className="flex items-center gap-2 pt-4 border-t border-slate-200">
                <Droplet className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">Resin</p>
                  <p className="text-sm text-slate-900">{printer.resinType}/{printer.resinLevel}%{(!printer.sensorIp) && (
                    <span className="ml-2 text-xs text-yellow-700 italic">(from DB)</span>
                  )}</p>
                </div>
              </div>
            )}
          </>
        )}

        {printer.status === "paused" && (
          <>
            {printer.currentJob ? (
              <div className="mb-4">
                <p className="text-sm text-slate-600 mb-2">{printer.currentJob}</p>
                <Progress value={printer.progress || 0} className="h-2" />
                <p className="text-sm text-slate-500 mt-1">{printer.progress}% complete</p>
              </div>
            ) : (
              <div className="py-6 text-center flex-1 flex items-center justify-center">
                <p className="text-yellow-700">Print paused</p>
              </div>
            )}

            <div className="py-3 px-4 bg-yellow-50 rounded-lg mb-4">
              <p className="text-sm text-yellow-800">Print paused. Resume to continue.</p>
            </div>

            <div className="grid grid-cols-1 gap-4 pt-4 border-t border-slate-200">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-slate-500">Time Left</p>
                    <p className="text-sm text-slate-900">{printer.timeRemaining || "--"}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-slate-500">Layer</p>
                    <p className="text-sm text-slate-900">{layerText}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Droplet className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-500">Resin</p>
                  <p className="text-sm text-slate-900 truncate">
                    {printer.resinType ? `${printer.resinType}/${printer.resinLevel}%` : (printer.resinLevel !== undefined ? `${printer.resinLevel}%` : "Unknown")}
                    {(!printer.sensorIp) && printer.resinLevel !== undefined && (
                      <span className="ml-2 text-xs text-yellow-700 italic">(from DB)</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}