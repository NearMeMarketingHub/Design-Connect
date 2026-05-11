import { type ReactNode, type ComponentType, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Shield,
  LayoutDashboard,
  Building2,
  CalendarCheck,
  Users,
  Link2,
  FolderOpen,
  Receipt,
  FileText,
  Eye,
  Wrench,
  LogOut,
  Menu,
  Loader2,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Customer Management",
    items: [
      { label: "Companies", href: "/admin/companies", icon: Building2 },
      { label: "Demo Requests", href: "/admin/demo-requests", icon: CalendarCheck },
      { label: "Users", href: "/admin/users", icon: Users },
      { label: "Invites", href: "/admin/invites", icon: Link2 },
    ],
  },
  {
    label: "Platform Activity",
    items: [
      { label: "Projects", href: "/admin/projects", icon: FolderOpen },
    ],
  },
  {
    label: "Billing & Access",
    items: [
      { label: "Pricing & Access", href: "/admin/pricing-access", icon: Receipt },
    ],
  },
  {
    label: "Support & Admin",
    items: [
      { label: "Audit Log", href: "/admin/audit-log", icon: FileText },
      { label: "View As User", href: "/admin/view-as-user", icon: Eye },
      { label: "Admin Tools", href: "/admin/tools", icon: Wrench },
    ],
  },
];

interface SuperAdminLayoutProps {
  children: ReactNode;
}

export function SuperAdminLayout({ children }: SuperAdminLayoutProps) {
  const [location, setLocation] = useLocation();
  const { user, loading: authLoading, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) {
      setLocation("/admin-login");
    }
  }, [user, authLoading, setLocation]);

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          data-testid="sidebar-overlay"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-30 w-60 bg-card border-r flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        data-testid="admin-sidebar"
      >
        <div className="h-16 flex items-center gap-3 px-4 border-b shrink-0">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm leading-tight text-foreground">BuildVision</p>
            <p className="text-[11px] text-muted-foreground">Admin Console</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2" data-testid="admin-nav">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="mb-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-3 mb-1">
                {group.label}
              </p>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  location === item.href ||
                  (item.href !== "/admin/dashboard" && location.startsWith(item.href));
                return (
                  <Link key={item.href} href={item.href}>
                    <div
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors mb-0.5 cursor-pointer ${
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                      onClick={() => setSidebarOpen(false)}
                      data-testid={`nav-${item.href.replace("/admin/", "")}`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {item.label}
                    </div>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t p-3 shrink-0">
          <div className="flex items-center gap-2 px-1">
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-primary">
                {(user.name || user.username || "A").charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate">{user.name || user.username}</p>
              <p className="text-[10px] text-muted-foreground">Administrator</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b bg-card flex items-center gap-3 px-4 sticky top-0 z-10 shrink-0">
          <button
            className="lg:hidden p-1.5 rounded-md hover:bg-muted transition-colors"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
            data-testid="button-sidebar-toggle"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <ThemeToggle />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            data-testid="button-admin-logout"
          >
            <LogOut className="w-4 h-4 mr-1.5" />
            Logout
          </Button>
        </header>

        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
