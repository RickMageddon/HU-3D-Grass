import React, { useMemo } from "react";
import { ArrowRight, MapPin, Cpu } from "lucide-react";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { PrinterSummary } from "../types/printers";
import { usePrinters } from "../components/hooks/usePrinters";

const STATUS_DOT: Record<string, string> = {
  printing: "bg-green-500",
  idle: "bg-slate-400",
  error: "bg-red-500",
  paused: "bg-yellow-500",
  maintenance: "bg-blue-500",
};

const STATUS_BADGE: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  printing: "default",
  idle: "secondary",
  error: "destructive",
  paused: "secondary",
  maintenance: "outline",
};

interface PrinterSelectorProps {
  title: string;
  description: string;
  onSelect: (printer: PrinterSummary) => void;
  printers?: PrinterSummary[];
}

export function PrinterSelector({
  title,
  description,
  onSelect,
  printers,
}: PrinterSelectorProps) {
  const {
    printers: fetchedPrinters,
    loading,
    error,
  } = usePrinters(printers === undefined);

  const usesProvidedPrinters = printers !== undefined;
  const printersToUse = usesProvidedPrinters ? printers : fetchedPrinters;

  const locations = useMemo(() => {
    return Array.from(
      new Set(printersToUse.map((p) => p.location))
    );
  }, [printersToUse]);

  if (!usesProvidedPrinters && loading) {
    return <div className="text-slate-500">Loading printers…</div>;
  }

  if (!usesProvidedPrinters && error) {
    return <div className="text-red-500">{error}</div>;
  }

  if (!printersToUse.length) {
    return <div className="text-slate-500">Geen printers gevonden.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-slate-600 mb-2">{description}</p>
      </div>

      {locations.map((loc) => (
        <section key={loc} className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-4 h-4 text-slate-400" />
            <h3 className="text-slate-600 text-sm font-medium">{loc}</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {printersToUse
              .filter((p) => p.location === loc)
              .map((printer) => (
                <button
                  key={printer.id}
                  onClick={() => onSelect(printer)}
                  className="text-left w-full p-0 focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue)] rounded-md"
                >
                  <Card className="p-4 md:p-5 h-full hover:border-[var(--brand-blue)] hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between">
                    <div className="mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[printer.status]}`}
                        />
                        <h3 className="text-slate-900 group-hover:text-[var(--brand-blue)] transition-colors text-sm md:text-base font-medium truncate">
                          {printer.name}
                        </h3>

                        <div className="ml-auto">
                          <Badge
                            variant={STATUS_BADGE[printer.status]}
                            className={`capitalize text-xs ${
                              printer.status === "printing"
                                ? "bg-[#0082be] hover:bg-[#0082be]"
                                : ""
                            }`}
                          >
                            {printer.status}
                          </Badge>
                        </div>
                      </div>

                      <p className="text-sm text-slate-500 mt-3 truncate">
                        {printer.model}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-6 md:pt-4 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        <Cpu className="w-3.5 h-5 md:w-4 md:h-4 text-slate-400" />
                        <span className="text-xs md:text-sm text-slate-400 truncate">
                          {printer.moduleId}
                        </span>
                      </div>

                      <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[var(--brand-blue)] group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </Card>
                </button>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
