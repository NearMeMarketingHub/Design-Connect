import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  CheckCircle2,
  Clock,
  Circle
} from "lucide-react";
import { Link, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { ProjectPhase, ActionItem } from "@shared/schema";

export default function SandboxProject() {
  const [, params] = useRoute("/sandbox/project/:id");
  const projectId = params?.id;
  const { user, loading: authLoading } = useAuth();

  const { data: sandboxData, isLoading: sandboxLoading } = useQuery({
    queryKey: ["/api/sandbox/data"],
    queryFn: () => api.getSandboxData(),
    enabled: user?.role === "admin",
  });

  const { data: phases = [] } = useQuery({
    queryKey: ["/api/projects", projectId, "phases"],
    queryFn: () => api.getProjectPhases(projectId!),
    enabled: !!projectId,
  });

  const { data: actionItems = [] } = useQuery({
    queryKey: ["/api/projects", projectId, "action-items"],
    queryFn: () => api.getActionItems(projectId!),
    enabled: !!projectId,
  });

  if (authLoading || sandboxLoading) {
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

  const getPhaseIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case "in_progress":
        return <Clock className="w-5 h-5 text-blue-500" />;
      default:
        return <Circle className="w-5 h-5 text-muted-foreground" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="h-16 border-b bg-card px-4 md:px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/sandbox/dashboard">
            <Button variant="ghost" size="sm" className="gap-2" data-testid="button-back-dashboard">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back to Dashboard</span>
            </Button>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-purple-600 text-purple-600">
            <TestTube className="w-3 h-3 mr-1" />
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
            <p className="text-sm font-medium text-purple-800 dark:text-purple-200">Sandbox Project Details</p>
            <p className="text-xs text-purple-600 dark:text-purple-400">
              Viewing as "{client?.name}". Changes are isolated from real data.
            </p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{project.name}</h1>
            <p className="text-muted-foreground">{project.address}</p>
          </div>
          <Badge className={
            project.status === "in_progress" ? "bg-blue-500" :
            project.status === "completed" ? "bg-green-500" :
            "bg-amber-500"
          }>
            {project.status.replace("_", " ")}
          </Badge>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="actions">Action Items</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Project Progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Overall Completion</span>
                    <span className="text-sm text-muted-foreground">{project.progress}%</span>
                  </div>
                  <Progress value={project.progress} className="h-4" />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <Building2 className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
                    <p className="text-xs text-muted-foreground">Current Phase</p>
                    <p className="font-semibold">{project.phase}</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <Calendar className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
                    <p className="text-xs text-muted-foreground">Due Date</p>
                    <p className="font-semibold">{project.dueDate || "TBD"}</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <DollarSign className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
                    <p className="text-xs text-muted-foreground">Budget</p>
                    <p className="font-semibold">${Number(project.budget || 0).toLocaleString()}</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <FileText className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
                    <p className="text-xs text-muted-foreground">Next Milestone</p>
                    <p className="font-semibold">{project.nextMilestone || "TBD"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link href={`/sandbox/project/${project.id}/messages`}>
                <Card className="hover:border-primary transition-colors cursor-pointer h-full">
                  <CardContent className="p-6 flex items-center gap-4">
                    <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                      <MessageSquare className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="font-medium">Messages</p>
                      <p className="text-sm text-muted-foreground">Chat with your contractor</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <Link href={`/sandbox/project/${project.id}/documents`}>
                <Card className="hover:border-primary transition-colors cursor-pointer h-full">
                  <CardContent className="p-6 flex items-center gap-4">
                    <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                      <FileText className="w-6 h-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="font-medium">Documents</p>
                      <p className="text-sm text-muted-foreground">View project files</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <Link href={`/sandbox/project/${project.id}/photos`}>
                <Card className="hover:border-primary transition-colors cursor-pointer h-full">
                  <CardContent className="p-6 flex items-center gap-4">
                    <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
                      <Image className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="font-medium">Progress Photos</p>
                      <p className="text-sm text-muted-foreground">View project updates</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </div>
          </TabsContent>

          <TabsContent value="timeline" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Project Timeline</CardTitle>
                <CardDescription>Track progress through each phase</CardDescription>
              </CardHeader>
              <CardContent>
                {phases.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No phases defined yet</p>
                ) : (
                  <div className="space-y-4">
                    {phases.map((phase: ProjectPhase, index: number) => (
                      <div key={phase.id} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          {getPhaseIcon(phase.status)}
                          {index < phases.length - 1 && (
                            <div className="w-0.5 h-full bg-muted mt-2" />
                          )}
                        </div>
                        <div className="flex-1 pb-6">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-medium">{phase.name}</h4>
                            <Badge variant={
                              phase.status === "completed" ? "default" :
                              phase.status === "in_progress" ? "secondary" : "outline"
                            }>
                              {phase.status.replace("_", " ")}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{phase.dateRange}</p>
                          {phase.tasks && phase.tasks.length > 0 && (
                            <ul className="text-sm text-muted-foreground space-y-1">
                              {phase.tasks.map((task: string, i: number) => (
                                <li key={i} className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                                  {task}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="actions" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Action Items</CardTitle>
                <CardDescription>Tasks that need your attention</CardDescription>
              </CardHeader>
              <CardContent>
                {actionItems.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No action items</p>
                ) : (
                  <div className="space-y-3">
                    {actionItems.map((item: ActionItem) => (
                      <div key={item.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                        <div>
                          <p className="font-medium">{item.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.assignedTo} • Due: {item.dueDate}
                          </p>
                        </div>
                        <Badge variant={item.status === "completed" ? "default" : "outline"}>
                          {item.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="details" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Project Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Description</p>
                  <p>{project.description || "No description provided"}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Project Type</p>
                    <p className="capitalize">{project.type || "Not specified"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Budget Status</p>
                    <p className="capitalize">{project.budgetStatus?.replace("_", " ") || "Not specified"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
