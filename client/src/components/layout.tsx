import { Link, useLocation } from "wouter";
import { useState } from "react";
import { 
  Settings,
  LogOut,
  HardHat,
  Home,
  ArrowLeft,
  FolderOpen,
  Shield,
  LayoutDashboard,
  Calculator,
  Grid3X3,
  Menu,
  X,
  Box,
  Building2,
  Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

interface SidebarItem {
  label: string;
  icon: React.ReactNode;
  href: string;
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, loading, currentPortal } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isContractorPortal = currentPortal === "contractor";
  const isDashboard = location === "/client/dashboard" || location === "/admin/dashboard" || location === "/contractor/dashboard" || location === "/company/dashboard" || location === "/subcontractor/dashboard";
  
  const isSubOrNotary = user?.role === "contractor" && (user?.contractorType === "subcontractor" || user?.contractorType === "notary");

  const getDashboardPath = () => {
    if (currentPortal === "admin") return "/admin/dashboard";
    if (currentPortal === "contractor") {
      if (user?.role === "company_owner") return "/company/dashboard";
      if (isSubOrNotary) return "/subcontractor/dashboard";
      return "/contractor/dashboard";
    }
    if (currentPortal === "client") return "/client/dashboard";
    if (user?.role === "admin") return "/admin/dashboard";
    if (user?.role === "company_owner") return "/company/dashboard";
    if (user?.role === "contractor") return "/contractor/dashboard";
    return "/client/dashboard";
  };
  
  const getPortalBasePath = () => {
    if (currentPortal === "admin") return "/admin";
    if (currentPortal === "contractor") return "/contractor";
    return "/client";
  };
  
  const dashboardPath = getDashboardPath();
  const basePath = getPortalBasePath();
  const showBackButton = !isDashboard && !loading && user;

  const isCompanyOwner = user?.role === "company_owner";
  const isCompanyAdmin = !!user?.isCompanyAdmin;
  const canAccessAdminCenter = isCompanyOwner || isCompanyAdmin;

  const contractorSidebarItems: SidebarItem[] = [
    { label: "Dashboard", icon: <LayoutDashboard className="w-5 h-5" />, href: "/contractor/dashboard" },
    ...(canAccessAdminCenter ? [
      { label: "Admin Center", icon: <Shield className="w-5 h-5" />, href: "/company/dashboard" },
    ] : []),
    ...(isCompanyOwner ? [
      { label: "Team", icon: <Users className="w-5 h-5" />, href: "/company/team" },
    ] : []),
    { label: "My Projects", icon: <FolderOpen className="w-5 h-5" />, href: "/contractor/projects" },
    { label: "Calculator", icon: <Calculator className="w-5 h-5" />, href: "/contractor/calculator" },
    { label: "Floor Calc", icon: <Grid3X3 className="w-5 h-5" />, href: "/contractor/floor-calculator" },
    { label: "3D Floor Plan", icon: <Box className="w-5 h-5" />, href: "/contractor/floor-plan-3d" },
  ];

  // Simplified sidebar for sub-contractors and notaries
  const subNotarySidebarItems: SidebarItem[] = [
    { label: "Dashboard", icon: <LayoutDashboard className="w-5 h-5" />, href: "/subcontractor/dashboard" },
    { label: "My Assignments", icon: <FolderOpen className="w-5 h-5" />, href: "/subcontractor/dashboard" },
    ...(user?.contractorType === "notary" ? [
      { label: "Notary Portal", icon: <Shield className="w-5 h-5" />, href: "/notary/portal" },
    ] : []),
  ];

  const isActiveRoute = (href: string) => {
    if (href === "/contractor/dashboard" || href === "/subcontractor/dashboard") {
      return location === href;
    }
    return location.startsWith(href);
  };

  if (isContractorPortal) {
    return (
      <div className="min-h-screen bg-background flex">
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform duration-200 ease-in-out lg:transform-none",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}>
          <div className="flex flex-col h-full">
            {/* Sidebar Header */}
            <div className="h-16 border-b border-border px-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
                  <HardHat className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="font-heading font-bold text-lg tracking-tight">BuildVision</h1>
                  <p className="text-xs text-muted-foreground">
                    {isSubOrNotary ? (user?.contractorType === "notary" ? "Notary Portal" : "Sub-Contractor Portal") : canAccessAdminCenter ? "Company Portal" : "Contractor Portal"}
                  </p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="lg:hidden"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              {(isSubOrNotary ? subNotarySidebarItems : contractorSidebarItems).map((item) => (
                <Link key={item.label + item.href} href={item.href}>
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer",
                      isActiveRoute(item.href)
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground hover:scale-[1.02]"
                    )}
                    data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                </Link>
              ))}
            </nav>

            {/* Sidebar Footer */}
            <div className="p-4 border-t border-border">
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-sm font-medium">
                    {user?.name?.charAt(0) || user?.username?.charAt(0) || "C"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user?.name || user?.username}</p>
                  <p className="text-xs text-muted-foreground">
                    {isCompanyOwner ? "Company Owner" : isCompanyAdmin ? "Company Admin" : user?.contractorType === "notary" ? "Notary" : user?.contractorType === "subcontractor" ? "Sub-Contractor" : "Contractor"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Header */}
          <header className="h-16 border-b border-border bg-card px-4 md:px-6 flex items-center justify-between shrink-0">
            {/* Left side - Menu button on mobile */}
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon" 
                className="lg:hidden"
                onClick={() => setSidebarOpen(true)}
                data-testid="button-menu"
              >
                <Menu className="w-5 h-5" />
              </Button>
              {!isDashboard && (
                <Button variant="ghost" size="sm" className="gap-2 hidden sm:flex" asChild data-testid="button-back-home">
                  <Link href={dashboardPath}>
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to Dashboard</span>
                  </Link>
                </Button>
              )}
            </div>
            
            {/* Right side - Settings and Logout */}
            <div className="flex items-center gap-2">
              <ThemeToggle className="text-muted-foreground" />
              <Button variant="ghost" size="icon" className="text-muted-foreground" asChild data-testid="button-settings">
                <Link href={`${basePath}/settings`}>
                  <Settings className="w-5 h-5" />
                </Link>
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-muted-foreground"
                onClick={() => window.location.href = '/'}
                data-testid="button-logout"
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </header>
          
          {/* Main Content */}
          <main className={cn(
            "flex-1 overflow-auto",
            location === "/contractor/floor-plan-3d" ? "" : "p-4 md:p-8"
          )}>
            <div className={cn(
              location === "/contractor/floor-plan-3d" 
                ? "h-full" 
                : "max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500"
            )}>
              {children}
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="h-16 border-b border-border bg-card px-4 md:px-6 flex items-center justify-between shrink-0">
        {/* Left side - Logo/Back button */}
        <div className="flex items-center gap-3">
          {isDashboard ? (
            <>
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
                {user?.role === "admin" ? <Shield className="w-6 h-6" /> : <HardHat className="w-6 h-6" />}
              </div>
              <div className="hidden sm:block">
                <h1 className="font-heading font-bold text-xl tracking-tight">BuildVision</h1>
              </div>
            </>
          ) : showBackButton ? (
            <Button variant="ghost" size="sm" className="gap-2" asChild data-testid="button-back-home">
              <Link href={dashboardPath}>
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back to Dashboard</span>
                <Home className="w-4 h-4 sm:hidden" />
              </Link>
            </Button>
          ) : (
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
              <HardHat className="w-6 h-6" />
            </div>
          )}
        </div>
        
        {/* Right side - My Projects, Settings and Logout */}
        <div className="flex items-center gap-2">
          {isDashboard && currentPortal === "client" && (
            <Button variant="outline" size="sm" className="gap-2" asChild data-testid="button-my-projects">
              <Link href="/client/projects">
                <FolderOpen className="w-4 h-4" />
                <span className="hidden sm:inline">My Projects</span>
              </Link>
            </Button>
          )}
          <ThemeToggle className="text-muted-foreground" />
          <Button variant="ghost" size="icon" className="text-muted-foreground" asChild data-testid="button-settings">
            <Link href={`${basePath}/settings`}>
              <Settings className="w-5 h-5" />
            </Link>
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-muted-foreground"
            onClick={() => window.location.href = '/'}
            data-testid="button-logout"
          >
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4 md:p-8">
        <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
          {children}
        </div>
      </main>
    </div>
  );
}
