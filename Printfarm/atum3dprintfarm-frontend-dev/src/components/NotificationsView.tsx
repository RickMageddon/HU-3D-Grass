import React, { useEffect, useState } from "react";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  Bell,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Droplet,
  Printer,
  PlayCircle,
  Trash2,
  X
} from "lucide-react";
import { API_BASE_URL } from "../lib/api";

type NotificationType = "resin-low" | "printer-error" | "print-finished" | "print-started" | "warning" | "info";

interface Notification {
  id: string;
  type: NotificationType;
  timestamp: string;
  title: string;
  message: string;
  printerName?: string;
  fileName?: string;
  isRead: boolean;
}

const notificationConfig: Record<NotificationType, { icon: any; color: string; bgColor: string }> = {
  "resin-low": { icon: Droplet, color: "text-yellow-600", bgColor: "bg-yellow-100" },
  "printer-error": { icon: XCircle, color: "text-red-600", bgColor: "bg-red-100" },
  "print-finished": { icon: CheckCircle2, color: "text-green-600", bgColor: "bg-green-100" },
  "print-started": { icon: PlayCircle, color: "text-[var(--brand-blue-dark)]", bgColor: "bg-[var(--brand-blue-light)]" },
  "warning": { icon: AlertTriangle, color: "text-orange-600", bgColor: "bg-orange-100" },
  "info": { icon: Bell, color: "text-slate-600", bgColor: "bg-slate-100" },
};

function getAuthHeaders() {
  const token = localStorage.getItem("token"); // adapt if you store auth differently
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function NotificationsView() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [loading, setLoading] = useState(false);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/notifications`, { headers: getAuthHeaders() });
      if (!res.ok) {
        console.warn("Failed to fetch notifications", res.status);
        return;
      }
      const data = await res.json();
      // backend returns array
      if (Array.isArray(data)) {
        // normalize to `isRead` boolean if backend uses `read` numeric flag
        const normalized: Notification[] = data.map((n: any) => ({
          id: String(n.id),
          type: (n.type as NotificationType) || ("info" as NotificationType),
          timestamp: n.timestamp || n.createdAt || "",
          title: n.title || n.message || "",
          message: n.message || "",
          printerName: n.printerName,
          fileName: n.fileName,
          isRead: !!(n.isRead || n.read),
        }));
        setNotifications(normalized);
      } else {
        setNotifications([]);
      }
    } catch (err) {
      console.error("Error fetching notifications", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAsRead = async (id: string) => {
  try {
    const res = await fetch(`${API_BASE_URL}/notifications/${id}/read`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    });

    if (!res.ok) {
      console.warn("Failed to mark notification read", id, res.status);
      return;
    }

    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, isRead: true } : n)));
  } catch (err) {
    console.error("Error marking notification read", err);
  }
};

const markAllAsRead = async () => {
  const unread = notifications.filter(n => !n.isRead).map(n => n.id);
  try {
    await Promise.all(unread.map(async id => {
      const res = await fetch(`${API_BASE_URL}/notifications/${id}/read`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      });
      if (!res.ok) console.warn("markAllAsRead failed for", id, res.status);
    }));
    // After all requests attempted, refetch to ensure server state
    await fetchNotifications();
  } catch (err) {
    console.error("Error in markAllAsRead", err);
  }
};

  const deleteNotification = (id: string) => {
    // backend currently has no DELETE /notifications/:id in this project,
    // so perform optimistic UI remove. If you add the backend endpoint,
    // replace with a DELETE request and refetch.
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAll = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/notifications`, { method: "DELETE", headers: getAuthHeaders() });
      if (!res.ok) {
        console.warn("Failed to clear notifications", res.status);
      }
    } catch (err) {
      console.error("Error clearing notifications", err);
    } finally {
      setNotifications([]);
    }
  };

  const filteredNotifications = notifications.filter(notification => {
    if (filter === "unread") return !notification.isRead;
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-end mb-8 gap-2">
        {unreadCount > 0 && (
          <Button variant="outline" onClick={markAllAsRead}>
            Mark All as Read
          </Button>
        )}
        {notifications.length > 0 && (
          <Button variant="outline" onClick={clearAll}>
            <Trash2 className="w-4 h-4 mr-2" />
            Clear All
          </Button>
        )}
      </div>

      <div className="flex gap-2 mb-6">
        <Button variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>
          All ({notifications.length})
        </Button>
        <Button variant={filter === "unread" ? "default" : "outline"} onClick={() => setFilter("unread")}>
          Unread ({unreadCount})
        </Button>
      </div>

      <div className="space-y-3">
        {loading && notifications.length === 0 ? (
          <Card className="p-6 text-center">Loading...</Card>
        ) : filteredNotifications.length === 0 ? (
          <Card className="p-12 text-center">
            <Bell className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">
              {filter === "unread" ? "No unread notifications" : "No notifications"}
            </p>
          </Card>
        ) : (
          filteredNotifications.map((notification) => {
            const config = notificationConfig[notification.type] ?? notificationConfig['info'];
            const Icon = config.icon ?? Bell;

            return (
              <Card
                key={notification.id}
                className={`p-4 transition-colors ${notification.isRead ? "bg-white" : "bg-[var(--brand-blue-light)] border-[var(--brand-blue-light)]"}`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${config.bgColor} flex-shrink-0`}>
                    <Icon className={`w-5 h-5 ${config.color}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-1">
                      <h3 className="text-slate-900">{notification.title}</h3>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm text-slate-500">{notification.timestamp}</span>
                        <Button variant="ghost" size="sm" onClick={() => deleteNotification(notification.id)} className="h-8 w-8 p-0">
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {notification.printerName && (
                      <div className="flex items-center gap-1 mb-2">
                        <Printer className="w-3 h-3 text-slate-500" />
                        <span className="text-sm text-slate-600">{notification.printerName}</span>
                      </div>
                    )}

                    <p className="text-slate-600 mb-2">{notification.message}</p>

                    {notification.fileName && (
                      <div className="flex items-center gap-2 mb-3">
                        <Badge variant="outline" className="text-xs">
                          {notification.fileName}
                        </Badge>
                      </div>
                    )}

                    {!notification.isRead && (
                      <Button variant="outline" size="sm" onClick={() => markAsRead(notification.id)}>
                        Mark as Read
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
