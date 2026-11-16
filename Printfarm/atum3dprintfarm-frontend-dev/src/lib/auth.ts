export interface StoredUser {
  name: string;
  email: string;
  role: "admin" | "user";
}

export const TOKEN_KEY = "token";
export const USER_KEY = "user";

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getAuthHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function setUser(user: StoredUser) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new CustomEvent("authChanged", { detail: { user } }));
    } catch (e) {
      // ignore
    }
  }
}

export function getUser(): StoredUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch (e) {
    console.error("Failed to parse stored user", e);
    return null;
  }
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new CustomEvent("authChanged", { detail: { user: null } }));
    } catch (e) {
      // ignore
    }
  }
}

export function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  // Try to decode JWT payload if present
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false; // can't determine
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (payload && typeof payload.exp === "number") {
      return Date.now() / 1000 > payload.exp;
    }
    return false;
  } catch (e) {
    return false;
  }
}
