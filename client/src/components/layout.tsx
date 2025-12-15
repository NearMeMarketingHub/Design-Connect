import { Link, useLocation } from "wouter";
import { 
  Settings,
  LogOut,
  HardHat,
  Home,
  ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const isDashboard = location === "/dashboard";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="h-16 border-b border-border bg-card px-4 md:px-6 flex items-center justify-between shrink-0">
        {/* Left side - Logo/Back button */}
        <div className="flex items-center gap-3">
          {isDashboard ? (
            <>
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
                <HardHat className="w-6 h-6" />
              </div>
              <div className="hidden sm:block">
                <h1 className="font-heading font-bold text-xl tracking-tight">BuildVision</h1>
              </div>
            </>
          ) : (
            <Button variant="ghost" size="sm" className="gap-2" asChild data-testid="button-back-home">
              <Link href="/dashboard">
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back to Dashboard</span>
                <Home className="w-4 h-4 sm:hidden" />
              </Link>
            </Button>
          )}
        </div>
        
        {/* Right side - Settings and Logout */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="text-muted-foreground" asChild data-testid="button-settings">
            <Link href="/settings">
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
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {children}
        </div>
      </main>
    </div>
  );
}
