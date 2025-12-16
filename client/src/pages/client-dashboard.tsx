import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  CalendarDays,
  DollarSign,
  MapPin,
  FolderOpen,
  Loader2
} from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import type { Project } from "@shared/schema";
import projectImage from "@assets/generated_images/modern_luxury_home_interior_with_natural_light.png";
import blueprintImage from "@assets/generated_images/construction_blueprints_and_hard_hat_on_table.png";

export default function ClientDashboard() {
  const { user } = useAuth();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const { data: allProjects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch projects");
      return res.json();
    },
  });

  // Filter projects based on user role
  const myProjects = allProjects.filter(p => {
    if (user?.role === 'admin') {
      // Admins see all projects
      return true;
    }
    // Clients only see projects where they're the client
    return p.clientId === user?.id;
  });
  const activeProjects = myProjects.filter(p => p.status !== "Completed");

  // Set default selected project when data loads
  useEffect(() => {
    if (myProjects.length > 0 && selectedProjectId === null) {
      // Prefer an active project, otherwise use the first one
      const defaultProject = activeProjects[0] || myProjects[0];
      setSelectedProjectId(defaultProject.id);
    }
  }, [myProjects, activeProjects, selectedProjectId]);

  const selectedProject = myProjects.find(p => p.id === selectedProjectId);

  // Get first name from user's full name
  const firstName = user?.name?.split(' ')[0] || 'there';

  // Helper to get project image based on status
  const getProjectImage = (status: string) => {
    return status === "Planning" ? blueprintImage : projectImage;
  };

  // Helper to format address
  const formatAddress = (project: Project) => {
    return project.address || "No address";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // No projects assigned to this client
  if (myProjects.length === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Welcome Home, {firstName}</h1>
          <p className="text-muted-foreground mt-1">Here's what's happening with your active projects.</p>
        </div>
        <Card className="p-12 text-center">
          <FolderOpen className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">No Projects Yet</h3>
          <p className="text-muted-foreground">
            You don't have any projects assigned to you yet. Your contractor will add you to a project soon.
          </p>
        </Card>
      </div>
    );
  }

  // Fallback if no project is selected yet
  if (!selectedProject) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const progress = selectedProject.progress || 0;
  const budget = parseFloat(selectedProject.budget || "0");

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Welcome Home, {firstName}</h1>
          <p className="text-muted-foreground mt-1">Here's what's happening with your active projects.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="w-full md:w-64">
            <Select 
              value={selectedProjectId?.toString()} 
              onValueChange={(v) => setSelectedProjectId(v)}
            >
              <SelectTrigger data-testid="select-project">
                <SelectValue placeholder="Select Project" />
              </SelectTrigger>
              <SelectContent>
                {myProjects.map((p) => (
                  <SelectItem key={p.id} value={p.id.toString()} data-testid={`select-project-${p.id}`}>
                    <span className="font-medium">{p.name}</span> 
                    <span className="ml-2 text-xs text-muted-foreground">({p.status})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Project Hero Card */}
      <div className="grid md:grid-cols-3 gap-6">
        <Link href={`/project/${selectedProject.id}`} className="md:col-span-2" data-testid={`link-project-hero-${selectedProject.id}`}>
          <Card className="h-full overflow-hidden relative group border-0 shadow-lg cursor-pointer">
            <div className="absolute inset-0">
              <img 
                src={getProjectImage(selectedProject.status)} 
                alt="Project Render" 
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
            </div>
            <div className="relative h-full flex flex-col justify-end p-6 text-white min-h-[350px]">
              <div className="flex items-center gap-2 mb-3">
                <Badge className="bg-accent text-accent-foreground border-none hover:bg-accent/90">
                  {selectedProject.phase}
                </Badge>
                {selectedProject.status === "Active" && (
                  <Badge variant="outline" className="border-white/30 text-white bg-green-500/20 backdrop-blur-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400 mr-2 animate-pulse" />
                    Live Updates
                  </Badge>
                )}
              </div>
              
              <h2 className="text-3xl font-heading font-bold mb-1">{selectedProject.name}</h2>
              <div className="flex items-center text-white/70 text-sm mb-4">
                <MapPin className="w-4 h-4 mr-1" />
                {formatAddress(selectedProject)}
              </div>
              
              <p className="text-white/80 max-w-xl mb-6 leading-relaxed">
                {selectedProject.description || `Your ${selectedProject.type?.toLowerCase() || 'project'} is currently in the ${selectedProject.phase} phase.`}
              </p>
              
              <div className="flex items-center gap-6 p-4 bg-white/10 backdrop-blur-md rounded-lg border border-white/10">
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-2 font-medium">
                    <span>Completion</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2 bg-white/20 [&>div]:bg-accent" />
                </div>
                <div className="h-8 w-px bg-white/20" />
                <div>
                  <span className="text-xs text-white/60 block uppercase tracking-wider">Status</span>
                  <span className="font-medium">{selectedProject.status}</span>
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
              {selectedProject.status === "Active" ? (
                <>
                  <div className="p-4 bg-muted/50 rounded-lg border border-border hover:bg-muted transition-colors cursor-pointer group">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-medium text-sm group-hover:text-primary transition-colors">Review Project Documents</h4>
                      <Badge variant="outline" className="text-[10px] h-5">Pending</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Check for any documents that need your review or signature.</p>
                    <Link href={`/project/${selectedProject.id}?tab=documents`}>
                      <Button size="sm" variant="outline" className="mt-3 w-full text-xs h-8" data-testid="button-review-sign">View Documents</Button>
                    </Link>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg border border-border hover:bg-muted transition-colors cursor-pointer group">
                    <h4 className="font-medium text-sm group-hover:text-primary transition-colors">View Inspiration Board</h4>
                    <p className="text-xs text-muted-foreground mt-1">Check design ideas and material selections for your project.</p>
                    <Link href={`/project/${selectedProject.id}?tab=inspiration`}>
                      <Button size="sm" variant="outline" className="mt-3 w-full text-xs h-8">Go to Selections</Button>
                    </Link>
                  </div>
                </>
              ) : (
                <div className="p-4 bg-muted/50 rounded-lg border border-border">
                  <h4 className="font-medium text-sm">No Actions Required</h4>
                  <p className="text-xs text-muted-foreground mt-1">Your project is in {selectedProject.phase}. We'll notify you when action is needed.</p>
                  <Link href={`/project/${selectedProject.id}`}>
                    <Button size="sm" variant="outline" className="mt-3 w-full text-xs h-8" data-testid="button-view-project">View Project</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Project Phase</p>
              <h3 className="text-lg font-bold">{selectedProject.phase}</h3>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center text-green-600">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Budget</p>
              <h3 className="text-2xl font-bold">${budget.toLocaleString()}</h3>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Progress</p>
              <h3 className="text-2xl font-bold">{progress}%</h3>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-600">
              <CalendarDays className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Project Type</p>
              <h3 className="text-lg font-bold">{selectedProject.type || 'N/A'}</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Updates */}
      <Card>
        <CardHeader>
          <CardTitle>Project Details</CardTitle>
          <CardDescription>Information about your selected project</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Address</p>
                <p className="font-medium">{selectedProject.address}</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Current Status</p>
                <div className="flex items-center gap-2">
                  <Badge variant={selectedProject.status === "Active" ? "default" : "secondary"}>
                    {selectedProject.status}
                  </Badge>
                  <span className="text-sm text-muted-foreground">• {selectedProject.phase}</span>
                </div>
              </div>
            </div>
            {selectedProject.description && (
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Description</p>
                <p className="text-sm">{selectedProject.description}</p>
              </div>
            )}
            <div className="pt-4">
              <Link href={`/project/${selectedProject.id}`}>
                <Button className="w-full md:w-auto" data-testid="button-view-full-project">
                  View Full Project Details
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
