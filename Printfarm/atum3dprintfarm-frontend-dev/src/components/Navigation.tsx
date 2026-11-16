import { Home, Printer, FileText, Users, Bell, ScrollText, Camera, Cpu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import logoImage from "figma:asset/01debce1970993591047d64df64589f6c64eac65.png";

interface NavigationProps {
  activeView: string;
  onNavigate: (view: string) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  unreadCount?: number;
}

export function Navigation({ activeView, onNavigate, mobileMenuOpen, setMobileMenuOpen, unreadCount = 0 }: NavigationProps) {
  const menuItems = [
    { id: "home", label: "Home", icon: Home },
    { id: "printers", label: "Printers", icon: Printer },
    { id: "prints", label: "Prints", icon: FileText },
    { id: "manage-users", label: "Manage Users", icon: Users },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "log", label: "Log", icon: ScrollText },
    { id: "camera", label: "Camera", icon: Camera },
    { id: "sensors", label: "Sensors", icon: Cpu },

  ];

  const NavigationContent = () => (
    <>
      <div className="mb-8">
        <img src={logoImage} alt="atum 3D" className="w-full max-w-[180px]" />
      </div>
      
      <nav className="space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? "bg-[var(--brand-blue)] text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.id === "notifications" && unreadCount > 0 && (
                <span className={`text-[11px] font-bold min-w-[26px] h-5 px-2 rounded-full flex items-center justify-center ${
                  isActive ? "bg-white/25 text-white" : "bg-red-500 text-white"
                }`}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </>
  );

  return (
    <>
      {/* Desktop Navigation */}
      <div className="hidden lg:block w-64 bg-white min-h-screen p-6 border-r border-slate-200 shadow-sm">
        <NavigationContent />
      </div>

      {/* Mobile Navigation */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-64 p-6">
          <NavigationContent />
        </SheetContent>
      </Sheet>
    </>
  );
}