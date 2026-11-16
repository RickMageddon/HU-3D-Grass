import { useEffect, useState } from "react";
import {
  normalizeEnabledSensors,
  PrinterSummary,
} from "../../types/printers";
import { API_BASE_URL } from "../../lib/api";

export function usePrinters(enabled = true) {
  const [printers, setPrinters] = useState<PrinterSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let disposed = false;

    async function loadPrinters() {
      try {
        setLoading(true);
        setError(null);

        const token = localStorage.getItem("token");

        const res = await fetch(`${API_BASE_URL}/printers`, {
          signal: controller.signal,
          headers: token
            ? { Authorization: `Bearer ${token}` }
            : undefined,
        });

        if (!res.ok) {
          throw new Error(`Failed to fetch printers: ${res.status}`);
        }

        const data = (await res.json()) as PrinterSummary[];
        if (!Array.isArray(data)) throw new Error("Invalid printers response");
        if (!disposed) {
          setPrinters(
            data.map((printer) => ({
              ...printer,
              enabledSensors: normalizeEnabledSensors(printer.enabledSensors),
            })),
          );
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Error fetching printers:", err);
        if (!disposed) {
          setError(err instanceof Error ? err.message : "Failed to load printers");
        }
      } finally {
        if (!disposed) setLoading(false);
      }
    }

    void loadPrinters();

    return () => {
      disposed = true;
      controller.abort();
    };
  }, [enabled]);

  return { printers, loading, error };
}
