import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  TestTube,
  Shield,
  ArrowLeft,
  Building2,
  Calendar,
  DollarSign,
  FileText,
  MessageSquare,
  Image,
  Eye
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function SandboxDashboard() {
  const [_, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuth();

  const { data: sandboxData, isLoading } = useQuery({
    queryKey: ["/api/sandbox/data"],
    queryFn: () => api.getSandboxData(),
    enabled: user?.role === "admin",
  });

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) {
      setLocation("/");
    }
  }, [user, authLoading, setLocation]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!sandboxData?.project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Sandbox not initialized</p>
          <Link href="/super-admin">
            <Button>Return to Admin</Button>
          </Link>
        </div>
      </div>
    );
  }

  const project = sandboxData.project;
  const client = sandboxData.client;

  return (
    <div className="min-h-screen bg-background">
      <header className="h-16 border-b bg-card px-4 md:px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center text-white">
            <TestTube className="w-6 h-6" />
          </div>
          <div className="hidden sm:block">
            <h1 className="font-heading font-bold text-xl tracking-tight">Sandbox Mode</h1>
            <p className="text-xs text-muted-foreground">Viewing as: {client?.name || "Test Client"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-purple-600 text-purple-600">
            Test Mode
          </Badge>
          <Link href="/super-admin">
            <Button variant="outline" size="sm" className="gap-2" data-testid="button-exit-sandbox">
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">Exit to Admin</span>
            </Button>
          </Link>
        </div>
      </header>

      <main className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
        <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg p-4 flex items-start gap-3">
          <TestTube className="w-5 h-5 text-purple-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-purple-800 dark:text-purple-200">Sandbox Environment</p>
            <p className="text-xs text-purple-600 dark:text-purple-400">
              You're viewing the client dashboard as "{client?.name}". All changes are isolated from real data.
            </p>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-bold">Welcome, {client?.name?.split(' ')[0] || 'Client'}!</h2>
          <p className="text-muted-foreground">Here's an overview of your project</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{project.name}</CardTitle>
                  <CardDescription>{project.address}</CardDescription>
                </div>
                <Badge className={
                  project.status === "in_progress" ? "bg-blue-500" :
                  project.status === "completed" ? "bg-green-500" :
                  "bg-amber-500"
                }>
                  {project.status.replace("_", " ")}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Overall Progress</span>
                  <span className="text-sm text-muted-foreground">{project.progress}%</span>
                </div>
                <Progress value={project.progress} className="h-3" />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <Building2 className="w-5 h-5 text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground">Current Phase</p>
                  <p className="font-medium">{project.phase}</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <Calendar className="w-5 h-5 text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground">Due Date</p>
                  <p className="font-medium">{project.dueDate || "TBD"}</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <DollarSign className="w-5 h-5 text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground">Budget Status</p>
                  <p className="font-medium capitalize">{project.budgetStatus?.replace("_", " ") || "On Track"}</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <FileText className="w-5 h-5 text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground">Next Milestone</p>
                  <p className="font-medium">{project.nextMilestone || "TBD"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Navigate your project</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href={`/sandbox/project/${project.id}`}>
                <Button className="w-full justify-start" variant="outline" data-testid="button-view-project">
                  <Eye className="w-4 h-4 mr-2" />
                  View Project Details
                </Button>
              </Link>
              <Link href={`/sandbox/project/${project.id}/messages`}>
                <Button className="w-full justify-start" variant="outline" data-testid="button-view-messages">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Messages
                </Button>
              </Link>
              <Link href={`/sandbox/project/${project.id}/documents`}>
                <Button className="w-full justify-start" variant="outline" data-testid="button-view-documents">
                  <FileText className="w-4 h-4 mr-2" />
                  Documents
                </Button>
              </Link>
              <Link href={`/sandbox/project/${project.id}/photos`}>
                <Button className="w-full justify-start" variant="outline" data-testid="button-view-photos">
                  <Image className="w-4 h-4 mr-2" />
                  Progress Photos
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
