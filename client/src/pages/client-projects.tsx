import { useState } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, ArrowRight, Calendar, CheckCircle2, Loader2, FolderOpen, ArrowUpDown, Filter } from "lucide-react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import projectImage from "@assets/generated_images/modern_luxury_home_interior_with_natural_light.png";

interface Project {
  id: string;
  name: string;
  address: string;
  status: string;
  phase: string;
  progress: number;
  nextMilestone: string | null;
  dueDate: string | null;
  clientId: string | null;
  contractorId: string | null;
  createdAt: string | null;
}

const CURRENT_STATUSES = ["Planning", "Active", "On Hold"];

function ProjectCard({ project, portalPath }: { project: Project; portalPath: string }) {
  const isCompleted = project.status === 'Completed';
  const projectPath = `${portalPath}/project/${project.id}`;
  
  return (
    <Link href={projectPath} className="block" data-testid={`link-project-${project.id}`}>
      <Card className="group overflow-hidden border-0 shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer" data-testid={`card-project-${project.id}`}>
        <div className="aspect-video relative overflow-hidden">
          <img 
            src={projectImage} 
            alt={project.name} 
            className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${isCompleted ? 'grayscale-[30%]' : ''}`}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-60" />
          <div className="absolute bottom-4 left-4 right-4 text-white">
            <Badge className={`mb-2 border-0 ${
              project.status === 'Active' ? 'bg-green-500 hover:bg-green-600' :
              project.status === 'Planning' ? 'bg-blue-500 hover:bg-blue-600' :
              project.status === 'Completed' ? 'bg-slate-500 hover:bg-slate-600' :
              'bg-orange-500 hover:bg-orange-600'
            }`}>
              {project.status}
            </Badge>
            <h3 className="font-heading font-bold text-xl">{project.name}</h3>
            <div className="flex items-center text-white/80 text-xs mt-1">
              <MapPin className="w-3 h-3 mr-1" />
              {project.address}
            </div>
          </div>
        </div>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex justify-between text-sm font-medium mb-1">
              <span className="text-muted-foreground">{project.phase}</span>
              <span>{project.progress}%</span>
            </div>
            <Progress value={project.progress} className="h-2" />
            
            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">{isCompleted ? 'Final Status' : 'Next Milestone'}</p>
                  <p className="text-sm font-medium">{project.nextMilestone || 'Not set'}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Calendar className="w-4 h-4 text-primary mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">{isCompleted ? 'Completion' : 'Target Date'}</p>
                  <p className="text-sm font-medium">{project.dueDate || 'Not set'}</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="p-4 bg-muted/30 border-t border-border">
          <div className="w-full">
            <Button className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              {isCompleted ? 'View Project' : 'View Dashboard'} <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
}

function EmptyState({ message, detail }: { message: string; detail: string }) {
  return (
    <Card className="p-12 text-center" data-testid="empty-state">
      <FolderOpen className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
      <h3 className="text-xl font-semibold mb-2">{message}</h3>
      <p className="text-muted-foreground">{detail}</p>
    </Card>
  );
}

export default function ClientProjects() {
  const { user, currentPortal } = useAuth();
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [currentStatusFilter, setCurrentStatusFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("current");

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/projects");
      return res.json();
    },
  });

  // Filter projects based on portal context
  const myProjects = projects.filter(p => {
    if (currentPortal === 'client') {
      return p.clientId === user?.id;
    }
    if (currentPortal === 'contractor') {
      if (user?.role === 'company_owner') return true;
      return p.contractorId === user?.id;
    }
    if (user?.role === 'admin') return true;
    return p.contractorId === user?.id;
  });

  // Sort helper
  const sorted = (list: Project[]) =>
    [...list].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });

  // Split into current (non-completed) and completed
  const allCurrent = myProjects.filter(p => p.status !== 'Completed');
  const allCompleted = myProjects.filter(p => p.status === 'Completed');

  // Apply current-tab status filter only within current projects
  const filteredCurrent = currentStatusFilter === "all"
    ? allCurrent
    : allCurrent.filter(p => p.status === currentStatusFilter);

  const displayedCurrent = sorted(filteredCurrent);
  const displayedCompleted = sorted(allCompleted);

  const portalPath = currentPortal === 'contractor' ? '/contractor' : currentPortal === 'admin' ? '/admin' : '/client';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">My Projects</h1>
          <p className="text-muted-foreground mt-1">View and manage all your properties.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
            <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as "newest" | "oldest")}>
              <SelectTrigger className="w-[130px]" data-testid="select-sort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest" data-testid="option-newest">Newest</SelectItem>
                <SelectItem value="oldest" data-testid="option-oldest">Oldest</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {activeTab === "current" && (
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select value={currentStatusFilter} onValueChange={setCurrentStatusFilter}>
                <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" data-testid="option-all-statuses">All Statuses</SelectItem>
                  {CURRENT_STATUSES.map((status) => (
                    <SelectItem key={status} value={status} data-testid={`option-status-${status.toLowerCase().replace(/\s+/g, '-')}`}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="projects-tabs">
        <TabsList data-testid="tabs-list">
          <TabsTrigger value="current" data-testid="tab-current">
            Current Projects
            <Badge variant="secondary" className="ml-2 px-1.5 py-0 text-xs" data-testid="badge-current-count">
              {allCurrent.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="completed" data-testid="tab-completed">
            Completed Projects
            <Badge variant="secondary" className="ml-2 px-1.5 py-0 text-xs" data-testid="badge-completed-count">
              {allCompleted.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="current" className="mt-6">
          {displayedCurrent.length === 0 ? (
            <EmptyState
              message={currentStatusFilter !== "all" ? "No Projects Found" : "No Current Projects"}
              detail={
                currentStatusFilter !== "all"
                  ? `No projects match the "${currentStatusFilter}" filter. Try a different status.`
                  : user?.role === 'client'
                    ? "You don't have any active projects yet. Your contractor will add you soon."
                    : "No active projects yet. Create a new project to get started."
              }
            />
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="current-projects-grid">
              {displayedCurrent.map((project) => (
                <ProjectCard key={project.id} project={project} portalPath={portalPath} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-6">
          {displayedCompleted.length === 0 ? (
            <EmptyState
              message="No Completed Projects"
              detail="Completed projects will appear here once work has been finished and marked complete."
            />
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="completed-projects-grid">
              {displayedCompleted.map((project) => (
                <ProjectCard key={project.id} project={project} portalPath={portalPath} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
