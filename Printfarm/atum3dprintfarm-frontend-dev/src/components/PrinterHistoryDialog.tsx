import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import { Calendar, Clock, Droplet, FileText, CheckCircle2, XCircle } from "lucide-react";

export interface PrintHistory {
  id: string;
  fileName: string;
  startDate: string;
  endDate: string;
  duration: string;
  status: "completed" | "failed" | "cancelled";
  resinUsed: number;
  resinType: string;
  layers: string;
}

interface PrinterHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  printerName: string;
  printerModel: string;
  printHistory: PrintHistory[];
}

export function PrinterHistoryDialog({ 
  open, 
  onOpenChange, 
  printerName, 
  printerModel,
  printHistory 
}: PrinterHistoryDialogProps) {
  const getStatusBadge = (status: PrintHistory["status"]) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100"><CheckCircle2 className="w-3 h-3 mr-1" />Completed</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case "cancelled":
        return <Badge variant="secondary">Cancelled</Badge>;
    }
  };

  const completedPrints = printHistory.filter(p => p.status === "completed").length;
  const totalResinUsed = printHistory
    .filter(p => p.status === "completed")
    .reduce((sum, p) => sum + p.resinUsed, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl">{printerName} - Print History</DialogTitle>
          <DialogDescription>
            {printerModel} • {completedPrints} completed prints • {totalResinUsed.toFixed(1)}% total resin used
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-4 my-6">
          <div className="bg-slate-50 p-4 rounded-lg">
            <div className="flex items-center gap-2 text-slate-600 mb-1">
              <FileText className="w-4 h-4" />
              <p className="text-sm">Total Prints</p>
            </div>
            <p className="text-2xl text-slate-900">{printHistory.length}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center gap-2 text-green-600 mb-1">
              <CheckCircle2 className="w-4 h-4" />
              <p className="text-sm">Completed</p>
            </div>
            <p className="text-2xl text-slate-900">{completedPrints}</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center gap-2 text-[var(--brand-blue-dark)] mb-1">
              <Droplet className="w-4 h-4" />
              <p className="text-sm">Resin Used</p>
            </div>
            <p className="text-2xl text-slate-900">{totalResinUsed.toFixed(1)}%</p>
          </div>
        </div>

        <div className="rounded-md border overflow-hidden">
          <ScrollArea className="h-[450px]">
            <div className="min-w-full">
              <Table className="table-fixed w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[220px] py-4">File Name</TableHead>
                    <TableHead className="w-[130px] py-4">Date</TableHead>
                    <TableHead className="w-[110px] py-4">Duration</TableHead>
                    <TableHead className="w-[240px] py-4">Resin</TableHead>
                    <TableHead className="w-[90px] py-4">Layers</TableHead>
                    <TableHead className="w-[140px] py-4">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {printHistory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-slate-400 py-8">
                        No print history available
                      </TableCell>
                    </TableRow>
                  ) : (
                    printHistory.map((print) => (
                      <TableRow key={print.id}>
                        <TableCell className="font-medium py-4" title={print.fileName}>
                          <div className="truncate">{print.fileName}</div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap py-4">
                          <div className="flex items-center gap-1.5 text-sm text-slate-600">
                            <Calendar className="w-4 h-4 shrink-0" />
                            <span>{new Date(print.startDate).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}</span>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap py-4">
                          <div className="flex items-center gap-1.5 text-sm text-slate-600">
                            <Clock className="w-4 h-4 shrink-0" />
                            <span>{print.duration}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="overflow-hidden">
                            <div className="text-slate-600 truncate text-sm leading-snug" title={print.resinType}>
                              {print.resinType}
                            </div>
                            <div className="text-slate-900 mt-1 text-sm">{print.resinUsed}%</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-slate-600 text-center py-4">{print.layers}</TableCell>
                        <TableCell className="py-4">{getStatusBadge(print.status)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
