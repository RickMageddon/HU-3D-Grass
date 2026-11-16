import { API_BASE_URL } from "./api";

function getNLTimestamp() {
  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) =>
    parts.find(p => p.type === type)?.value;

  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

export async function logEvent(
  level: "info" | "warning" | "error" | "success",
  source: string,
  message: string
): Promise<void> {
  try {
    const token = localStorage.getItem("token");
    await fetch(`${API_BASE_URL}/logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        timestamp: getNLTimestamp(),
        level,
        source,
        message,
      }),
    });
  } catch (err) {
    console.error("Failed to send log", err);
  }
}
