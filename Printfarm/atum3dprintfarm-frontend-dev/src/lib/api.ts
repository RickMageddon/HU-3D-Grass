const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

export const API_BASE_URL = (
  configuredBaseUrl || `http://${window.location.hostname}:3000`
).replace(/\/+$/, "");
