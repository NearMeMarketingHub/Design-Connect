import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  TestTube,
  Shield,
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  CalendarDays,
  DollarSign,
  MapPin,
  Settings,
  LogOut,
  FolderOpen
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import projectImage from "@assets/generated_images/modern_luxury_home_interior_with_natural_light.png";

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
  const firstName = client?.name?.split(' ')[0] || 'Client';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="h-16 border-b border-border bg-card px-4 md:px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center text-white">
            <TestTube className="w-6 h-6" />
          </div>
          <div className="hidden sm:block">
            <h1 className="font-heading font-bold text-xl tracking-tight">BuildVision</h1>
            <p className="text-xs text-muted-foreground">Sandbox Mode</p>
          </div>
          <Badge variant="outline" className="border-purple-600 text-purple-600 ml-2">
            Test Mode
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" asChild data-testid="button-my-projects">
            <Link href={`/sandbox/project/${project.id}`}>
              <FolderOpen className="w-4 h-4" />
              <span className="hidden sm:inline">View Project</span>
            </Link>
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground" data-testid="button-settings">
            <Settings className="w-5 h-5" />
          </Button>
          <Link href="/super-admin">
            <Button variant="ghost" size="icon" className="text-muted-foreground" data-testid="button-exit-sandbox">
              <Shield className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 md:p-8">
        <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
          <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg p-4 flex items-start gap-3">
            <TestTube className="w-5 h-5 text-purple-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-purple-800 dark:text-purple-200">Sandbox Environment</p>
              <p className="text-xs text-purple-600 dark:text-purple-400">
                You're viewing the client dashboard as "{client?.name}". All changes are isolated from real data. Click the shield icon to exit.
              </p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-heading font-bold text-foreground">Welcome Home, {firstName}</h1>
              <p className="text-muted-foreground mt-1">Here's what's happening with your active projects.</p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <Link href={`/sandbox/project/${project.id}`} className="md:col-span-2" data-testid="link-project-hero">
              <Card className="h-full overflow-hidden relative group border-0 shadow-lg cursor-pointer">
                <div className="absolute inset-0">
                  <img 
                    src={projectImage} 
                    alt="Project Render" 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                </div>
                <div className="relative h-full flex flex-col justify-end p-6 text-white min-h-[350px]">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge className="bg-accent text-accent-foreground border-none hover:bg-accent/90">
                      {project.phase || "Phase 1"}
                    </Badge>
                    {project.status === "in_progress" && (
                      <Badge variant="outline" className="border-white/30 text-white bg-green-500/20 backdrop-blur-sm">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400 mr-2 animate-pulse" />
                        Live Updates
                      </Badge>
                    )}
                  </div>
                  
                  <h2 className="text-3xl font-heading font-bold mb-1">{project.name}</h2>
                  <div className="flex items-center text-white/70 text-sm mb-4">
                    <MapPin className="w-4 h-4 mr-1" />
                    {project.address || "123 Test Street"}
                  </div>
                  
                  <p className="text-white/80 max-w-xl mb-6 leading-relaxed">
                    {project.description || "This is a sandbox test project for testing client-facing features."}
                  </p>
                  
                  <div className="flex items-center gap-6 p-4 bg-white/10 backdrop-blur-md rounded-lg border border-white/10">
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-2 font-medium">
                        <span>Completion</span>
                        <span>{project.progress || 0}%</span>
                      </div>
                      <Progress value={project.progress || 0} className="h-2 bg-white/20 [&>div]:bg-accent" />
                    </div>
                    <div className="h-8 w-px bg-white/20" />
                    <div>
                      <span className="text-xs text-white/60 block uppercase tracking-wider">Status</span>
                      <span className="font-medium capitalize">{project.status?.replace("_", " ") || "Active"}</span>
                    </div>
                  </div>
                </div>
              </Card>
            </Link>

            <div className="space-y-6">
              <Card className="h-full border-l-4 border-l-accent flex flex-col">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-accent" />
                    Action Required
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 flex-1">
                  <div className="p-4 bg-muted/50 rounded-lg border border-border hover:bg-muted transition-colors cursor-pointer group">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-medium text-sm group-hover:text-primary transition-colors">Approve Change Order #03</h4>
                      <Badge variant="outline" className="text-[10px] h-5">Urgent</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Master bath tile upgrade request pending approval.</p>
                    <Link href={`/sandbox/project/${project.id}/documents`}>
                      <Button size="sm" variant="outline" className="mt-3 w-full text-xs h-8" data-testid="button-review-sign">Review & Sign</Button>
                    </Link>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg border border-border hover:bg-muted transition-colors cursor-pointer group">
                    <h4 className="font-medium text-sm group-hover:text-primary transition-colors">Select Lighting Fixtures</h4>
                    <p className="text-xs text-muted-foreground mt-1">Kitchen island pendant selection needed by Friday.</p>
                    <Link href={`/sandbox/project/${project.id}`}>
                      <Button size="sm" variant="outline" className="mt-3 w-full text-xs h-8">Go to Selections</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Days Remaining</p>
                  <h3 className="text-2xl font-bold">45</h3>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center text-green-600">
                  <DollarSign className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Budget Status</p>
                  <h3 className="text-2xl font-bold capitalize">{project.budgetStatus?.replace("_", " ") || "On Track"}</h3>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Completed Tasks</p>
                  <h3 className="text-2xl font-bold">24/58</h3>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-600">
                  <CalendarDays className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Next Milestone</p>
                  <h3 className="text-lg font-bold">{project.nextMilestone || "Drywall"}</h3>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Project Updates</CardTitle>
              <CardDescription>Daily logs from your project manager</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {[
                  { time: "Today, 9:00 AM", title: "Electrical Rough-in Inspection Passed", desc: "The city inspector signed off on all electrical work this morning. The crew is now proceeding with insulation installation." },
                  { time: "Yesterday, 2:30 PM", title: "Plumbing Progress Update", desc: "All supply lines have been run to fixtures. Waiting on final inspection scheduling." },
                  { time: "Dec 12, 10:15 AM", title: "Material Delivery Confirmed", desc: "Drywall materials scheduled for delivery next Monday. Crew is prepping the site." }
                ].map((update, i) => (
                  <div key={i} className="flex gap-4 pb-6 border-b border-border last:border-0 last:pb-0">
                    <div className="flex-shrink-0 w-24 text-sm text-muted-foreground pt-1">
                      {update.time}
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground">{update.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1">{update.desc}</p>
                      {i === 0 && (
                        <div className="mt-3 flex gap-2">
                          <div className="w-20 h-20 rounded-md bg-muted border border-border" />
                          <div className="w-20 h-20 rounded-md bg-muted border border-border" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
