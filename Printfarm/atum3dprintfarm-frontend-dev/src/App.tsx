import { useState, useEffect, useRef } from "react";
import { Navigation } from "./components/Navigation";
import { Header } from "./components/Header";
import { HomeView } from "./components/HomeView";
import { PrintersView } from "./components/PrintersView";
import { PrintsView } from "./components/PrintsView";
import { ManageUsersView } from "./components/ManageUsersView";
import { NotificationsView } from "./components/NotificationsView";
import { LogView } from "./components/LogView";
import { LoginDialog } from "./components/LoginDialog";
import { Toaster } from "./components/ui/sonner";
import { toast } from "sonner@2.0.3";
import { Bell, AlertTriangle, CheckCircle2, XCircle, Droplet, PlayCircle } from "lucide-react";
import { API_BASE_URL } from "./lib/api";

type NotifType = "resin-low" | "printer-error" | "print-finished" | "print-started" | "warning" | "info";

const toastConfig: Record<NotifType, { icon: any; iconColor: string; iconBg: string }> = {
  "resin-low": { icon: Droplet, iconColor: "text-amber-600", iconBg: "bg-amber-100" },
  "printer-error": { icon: XCircle, iconColor: "text-red-600", iconBg: "bg-red-100" },
  "print-finished": { icon: CheckCircle2, iconColor: "text-emerald-600", iconBg: "bg-emerald-100" },
  "print-started": { icon: PlayCircle, iconColor: "text-blue-600", iconBg: "bg-blue-100" },
  "warning": { icon: AlertTriangle, iconColor: "text-orange-600", iconBg: "bg-orange-100" },
  "info": { icon: Bell, iconColor: "text-slate-500", iconBg: "bg-slate-100" },
};
import { CameraView } from "./components/CameraView";
import { SensorsView } from "./components/SensorsView";
import { RobotArmHomepage } from "./components/robotarm/pages/RobotArmHomepage";
import { RobotArmView } from "./components/robotarm/pages/RobotArmView";

interface User {
  name: string;
  email: string;
  role: "admin" | "user";
}

export default function App() {
  const [activeView, setActiveView] = useState("home");
  const [user, setUser] = useState<User | null>(null);
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedRobotArmId, setSelectedRobotArmId] = useState<number | null>(null);

  const renderView = () => {
    switch (activeView) {
      case "home":
        return <HomeView />;
      case "printers":
        return <PrintersView />;
      case "prints":
        return <PrintsView />;
      case "manage-users":
        return <ManageUsersView currentUser={user} />;
      case "notifications":
        return <NotificationsView />;
      case "log":
        return <LogView />;
      case "camera":
        return <CameraView />;
      case "sensors":
        return <SensorsView />;
      case "robotarm":
        return selectedRobotArmId !== null ? (
          <RobotArmView armId={selectedRobotArmId} onBack={() => setSelectedRobotArmId(null)} />
        ) : (
          <RobotArmHomepage onSelectArm={setSelectedRobotArmId} />
        );
      default:
        return <HomeView />;
    }
  };

  const getHeaderProps = () => {
    switch (activeView) {
      case "home":
        return {
          title: "Dashboard Overview",
          subtitle: "Monitor and manage your 3D printer farm"
        };
      case "printers":
        return {
          title: "Manage Printers",
          subtitle: "Add, edit, and monitor all 3D printers in your farm"
        };
      case "prints":
        return {
          title: "Print Jobs",
          subtitle: "Manage and track all print jobs across your farm"
        };
      case "manage-users":
        return {
          title: "Manage Users",
          subtitle: "Control user access and permissions"
        };
      case "notifications":
        return {
          title: "Notifications",
          subtitle: "Stay updated on printer status and alerts"
        };
      case "log":
        return {
          title: "Activity Log",
          subtitle: "View all system activities and events"
        };
      case "robotarm":
        return {
          title: "Robot Arm",
          subtitle: "Manage and monitor all robot arms in the print farm"
        };
      default:
        return {};
    }
  };

  const handleLogin = (userData: User) => {
    setUser(userData);
  };

  const handleLogout = () => {
    setUser(null);
    // clear persisted auth
    try {
      (async () => {
        const a = await import("./lib/auth");
        a.clearAuth();
      })();
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    // initialize auth state from localStorage
    (async () => {
      try {
        const a = await import("./lib/auth");
        const token = a.getToken();
        const storedUser = a.getUser();
        if (token && !a.isTokenExpired(token) && storedUser) {
          setUser(storedUser);
        } else {
          a.clearAuth();
        }
      } catch (e) {
        console.error("Auth init error", e);
      }
    })();
  }, []);

  const handleNavigate = (view: string) => {
    setActiveView(view);
    setSelectedRobotArmId(null); // Back to the robot arm homepage when navigating
    setMobileMenuOpen(false); // Close mobile menu on navigation
  };

  // Poll notifications and toast any new unread ones
  const notifSeenRef = useRef<Set<string>>(new Set());
  const isFirstPollRef = useRef(true);
  useEffect(() => {
    let mounted = true;

    const poll = async () => {
      try {
        const token = localStorage.getItem("token");
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`${API_BASE_URL}/notifications`, { headers });
        if (!res.ok || !mounted) return;
        const data = await res.json();
        if (!Array.isArray(data)) return;

        data.forEach((n: any) => {
          const id = String(n.id);
          const isRead = !!(n.isRead || n.read);

          // On the first poll, just mark everything as seen so we don't
          // spam toasts for notifications that already existed on page load.
          if (isFirstPollRef.current) {
            notifSeenRef.current.add(id);
            return;
          }

          if (isRead || notifSeenRef.current.has(id)) return;
          notifSeenRef.current.add(id);

          const type: NotifType = (n.type as NotifType) || "info";
          const title = n.title || n.message || "Notification";
          const message = n.message || "";
          const cfg = toastConfig[type] ?? toastConfig["info"];
          const Icon = cfg.icon;

          let toastId: string | number;
          toastId = toast(
            <div className="flex items-start gap-3 w-full">
              <div className={`p-1.5 ${cfg.iconBg} rounded-md flex-shrink-0`}>
                <Icon className={`w-4 h-4 ${cfg.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-900 text-sm">{title}</div>
                {message && message !== title && (
                  <div className="text-xs text-slate-500 mt-0.5">{message}</div>
                )}
              </div>
              <button
                className="text-xs text-slate-400 hover:text-slate-600 flex-shrink-0 ml-1"
                onClick={() => toast.dismiss(toastId)}
              >
                Dismiss
              </button>
            </div>
          );
        });

        if (isFirstPollRef.current) isFirstPollRef.current = false;
        if (mounted) setUnreadCount(data.filter((n: any) => !(n.isRead || n.read)).length);
      } catch (err) {
        console.error("Notification poll failed", err);
      }
    };

    poll();
    const intervalId = setInterval(poll, 10_000);
    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, []);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Navigation
        activeView={activeView}
        onNavigate={handleNavigate}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        unreadCount={unreadCount}
      />
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <Header
          user={user}
          onLoginClick={() => setLoginDialogOpen(true)}
          onLogout={handleLogout}
          onMenuClick={() => setMobileMenuOpen(true)}
          {...getHeaderProps()}
        />
        {renderView()}
      </main>
      <LoginDialog
        open={loginDialogOpen}
        onOpenChange={setLoginDialogOpen}
        onLogin={handleLogin}
      />
      <Toaster position="top-right" />
    </div>
  );
}
