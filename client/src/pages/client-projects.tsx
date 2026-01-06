import { useState } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

const PROJECT_STATUSES = ["Planning", "Active", "On Hold", "Completed"];

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

export default function ClientProjects() {
  const { user, currentPortal } = useAuth();
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/projects");
      return res.json();
    },
  });

  // Filter projects based on portal context
  let myProjects = projects.filter(p => {
    // When logged into client portal, only show projects where user is the client
    if (currentPortal === 'client') {
      return p.clientId === user?.id;
    }
    // When logged into contractor portal, show only projects assigned to user (even for admins)
    if (currentPortal === 'contractor') {
      return p.contractorId === user?.id;
    }
    // When logged into admin portal, admins see all projects, contractors see assigned
    if (user?.role === 'admin') {
      return true;
    }
    return p.contractorId === user?.id;
  });
  
  // Apply status filter
  if (statusFilter !== "all") {
    myProjects = myProjects.filter(p => p.status === statusFilter);
  }
  
  // Apply sort order using createdAt timestamp
  myProjects = [...myProjects].sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
  });
  
  const activeProjects = myProjects.filter(p => p.status !== 'Completed');
  const completedProjects = myProjects.filter(p => p.status === 'Completed');
  
  const portalPath = currentPortal === 'contractor' ? '/contractor' : currentPortal === 'admin' ? '/admin' : '/client';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
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
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" data-testid="option-all-statuses">All Statuses</SelectItem>
                {PROJECT_STATUSES.map((status) => (
                  <SelectItem key={status} value={status} data-testid={`option-status-${status.toLowerCase().replace(/\s+/g, '-')}`}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {myProjects.length === 0 ? (
        <Card className="p-12 text-center">
          <FolderOpen className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">
            {statusFilter !== "all" ? "No Projects Found" : "No Projects Yet"}
          </h3>
          <p className="text-muted-foreground">
            {statusFilter !== "all" 
              ? `No projects match the "${statusFilter}" status filter. Try selecting a different status.`
              : user?.role === 'client' 
                ? "You don't have any projects assigned to you yet. Your contractor will add you to a project soon."
                : "You don't have any projects assigned to you yet. Create a new project to get started."}
          </p>
        </Card>
      ) : (
        <>
          {activeProjects.length > 0 && (
            <section>
              <h2 className="text-xl font-heading font-semibold text-foreground mb-4">Current Projects</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeProjects.map((project) => (
                  <ProjectCard key={project.id} project={project} portalPath={portalPath} />
                ))}
              </div>
            </section>
          )}

          {completedProjects.length > 0 && (
            <section>
              <h2 className="text-xl font-heading font-semibold text-foreground mb-4">Completed Projects</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {completedProjects.map((project) => (
                  <ProjectCard key={project.id} project={project} portalPath={portalPath} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
