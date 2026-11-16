import { LogIn, LogOut, User as UserIcon, Menu } from "lucide-react";
import { Button } from "./ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { Avatar, AvatarFallback } from "./ui/avatar";

interface User {
  name: string;
  email: string;
}

interface HeaderProps {
  user: User | null;
  onLoginClick: () => void;
  onLogout: () => void;
  onMenuClick: () => void;
  title?: string;
  subtitle?: string;
}

export function Header({ user, onLoginClick, onLogout, onMenuClick, title, subtitle }: HeaderProps) {
  return (
    <div className="flex justify-between items-center mb-4 sm:mb-6">
      {/* Mobile Menu Button and Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <Menu className="w-6 h-6 text-slate-600" />
        </button>
        
        {title && (
          <div>
            <h1 className="text-slate-900">{title}</h1>
            {subtitle && <p className="text-slate-600 hidden sm:block">{subtitle}</p>}
          </div>
        )}
      </div>

      {/* User Section */}
      <div className="ml-auto">
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 rounded-full hover:opacity-80 transition-opacity">
                <Avatar className="w-10 h-10 cursor-pointer ring-2 ring-slate-200 hover:ring-slate-300 transition-all">
                  <AvatarFallback className="bg-[var(--brand-blue)] text-white">
                    {user.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div>
                  <p className="text-sm">{user.name}</p>
                  <p className="text-xs text-slate-500">{user.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <UserIcon className="w-4 h-4 mr-2" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button onClick={onLoginClick} className="gap-2">
            <LogIn className="w-4 h-4" />
            <span className="hidden sm:inline">Login</span>
          </Button>
        )}
      </div>
    </div>
  );
}