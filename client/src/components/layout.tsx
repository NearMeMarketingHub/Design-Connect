import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  FolderOpen, 
  Lightbulb, 
  Calendar, 
  FileText, 
  Calculator, 
  Settings,
  LogOut,
  Menu,
  X,
  HardHat,
  User
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [userRole, setUserRole] = useState<'client' | 'admin'>('client'); // Mock role state

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location]);

  const toggleRole = () => {
    setUserRole(prev => prev === 'client' ? 'admin' : 'client');
  };

  const clientLinks = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/project/1", label: "My Project", icon: FolderOpen },
    { href: "/inspiration", label: "Inspiration", icon: Lightbulb },
    { href: "/timeline", label: "Timeline", icon: Calendar },
    { href: "/documents", label: "Documents", icon: FileText },
  ];

  const adminLinks = [
    { href: "/admin-dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/projects", label: "Active Projects", icon: FolderOpen },
    { href: "/estimates", label: "Estimating", icon: Calculator },
    { href: "/schedule", label: "Master Schedule", icon: Calendar },
    { href: "/admin-docs", label: "Contracts", icon: FileText },
  ];

  const links = userRole === 'client' ? clientLinks : adminLinks;

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-lg bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground">
            <HardHat className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-heading font-bold text-xl tracking-tight text-white">BuildVision</h1>
            <p className="text-xs text-sidebar-foreground/60">Portal v2.0</p>
          </div>
        </div>
        
        <div className="space-y-1">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = location === link.href || location.startsWith(link.href + '/');
            return (
              <Link key={link.href} href={link.href}>
                <a className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-sidebar-accent text-white" 
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-white"
                )}>
                  <Icon className="w-4 h-4" />
                  {link.label}
                </a>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mt-auto p-6 border-t border-sidebar-border">
        <div className="flex items-center gap-3 mb-6">
          <Avatar className="h-9 w-9 border border-sidebar-border">
            <AvatarImage src={userRole === 'client' ? "https://github.com/shadcn.png" : "https://github.com/shadcn.png"} />
            <AvatarFallback>BV</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {userRole === 'client' ? 'Sarah Jenkins' : 'Mike Builder'}
            </p>
            <p className="text-xs text-sidebar-foreground/60 truncate">
              {userRole === 'client' ? 'Homeowner' : 'Project Manager'}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full text-xs h-8 bg-transparent border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
            onClick={toggleRole}
          >
            Switch to {userRole === 'client' ? 'Admin' : 'Client'}
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-sidebar-foreground hover:text-white hover:bg-sidebar-accent"
            onClick={() => window.location.href = '/'}
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-64 shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
        <SheetContent side="left" className="p-0 w-64 bg-sidebar border-r-sidebar-border">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 border-b border-border bg-card px-4 md:px-6 flex items-center justify-between md:justify-end">
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="text-muted-foreground">
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </header>
        
        <div className="flex-1 overflow-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}