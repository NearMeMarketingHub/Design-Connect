import { useState } from "react";
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
  FileText,
  MapPin
} from "lucide-react";
import { Link } from "wouter";
import projectImage from "@assets/generated_images/modern_luxury_home_interior_with_natural_light.png";
import blueprintImage from "@assets/generated_images/construction_blueprints_and_hard_hat_on_table.png";

const PROJECTS = {
  jenkins: {
    id: "jenkins",
    name: "The Jenkins Residence",
    address: "123 Maple Avenue",
    status: "Active",
    phase: "Phase 3: Rough-in",
    progress: 45,
    budgetStatus: "On Track",
    nextMilestone: "Drywall",
    image: projectImage,
    description: "Current progress is on schedule. Plumbing and electrical rough-ins are 80% complete. Next inspection scheduled for Friday."
  },
  lakehouse: {
    id: "lakehouse",
    name: "Lake House Retreat",
    address: "889 Shoreline Drive",
    status: "Planning",
    phase: "Phase 1: Design",
    progress: 15,
    budgetStatus: "Pending",
    nextMilestone: "Permit Approval",
    image: blueprintImage,
    description: "Architectural drawings are under review by the city. Final material selections for the exterior are needed."
  },
  loft: {
    id: "loft",
    name: "Downtown Loft",
    address: "450 Main St, Unit 4B",
    status: "Completed",
    phase: "Phase 6: Handover",
    progress: 100,
    budgetStatus: "Closed",
    nextMilestone: "Warranty Period",
    image: projectImage, // Using same image for mock
    description: "Project completed on Jan 15, 2025. Final walkthrough signed off."
  }
};

export default function ClientDashboard() {
  const [selectedProject, setSelectedProject] = useState<keyof typeof PROJECTS>("jenkins");
  const project = PROJECTS[selectedProject];

  // Filter out completed projects for the switcher
  const activeProjects = Object.entries(PROJECTS).filter(
    ([_, p]) => p.status !== "Completed"
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Welcome Home, Sarah</h1>
          <p className="text-muted-foreground mt-1">Here's what's happening with your active projects.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="w-full md:w-64">
            <Select 
              value={selectedProject} 
              onValueChange={(v) => setSelectedProject(v as keyof typeof PROJECTS)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Project" />
              </SelectTrigger>
              <SelectContent>
                {activeProjects.map(([key, p]) => (
                  <SelectItem key={key} value={key}>
                    <span className="font-medium">{p.name}</span> 
                    <span className="ml-2 text-xs text-muted-foreground">({p.status})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button className="shrink-0">
            <FileText className="w-4 h-4 mr-2" />
            Contract
          </Button>
        </div>
      </div>

      {/* Project Hero Card */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 overflow-hidden relative group border-0 shadow-lg">
          <div className="absolute inset-0">
            <img 
              src={project.image} 
              alt="Project Render" 
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
          </div>
          <div className="relative h-full flex flex-col justify-end p-6 text-white min-h-[350px]">
            <div className="flex items-center gap-2 mb-3">
              <Badge className="bg-accent text-accent-foreground border-none hover:bg-accent/90">
                {project.phase}
              </Badge>
              {project.status === "Active" && (
                <Badge variant="outline" className="border-white/30 text-white bg-green-500/20 backdrop-blur-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400 mr-2 animate-pulse" />
                  Live Updates
                </Badge>
              )}
            </div>
            
            <h2 className="text-3xl font-heading font-bold mb-1">{project.name}</h2>
            <div className="flex items-center text-white/70 text-sm mb-4">
              <MapPin className="w-4 h-4 mr-1" />
              {project.address}
            </div>
            
            <p className="text-white/80 max-w-xl mb-6 leading-relaxed">
              {project.description}
            </p>
            
            <div className="flex items-center gap-6 p-4 bg-white/10 backdrop-blur-md rounded-lg border border-white/10">
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-2 font-medium">
                  <span>Completion</span>
                  <span>{project.progress}%</span>
                </div>
                <Progress value={project.progress} className="h-2 bg-white/20 [&>div]:bg-accent" />
              </div>
              <div className="h-8 w-px bg-white/20" />
              <div>
                <span className="text-xs text-white/60 block uppercase tracking-wider">Status</span>
                <span className="font-medium">{project.status}</span>
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="h-full border-l-4 border-l-accent flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-accent" />
                Action Required
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 flex-1">
              {selectedProject === 'jenkins' ? (
                <>
                  <div className="p-4 bg-muted/50 rounded-lg border border-border hover:bg-muted transition-colors cursor-pointer group">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-medium text-sm group-hover:text-primary transition-colors">Approve Change Order #03</h4>
                      <Badge variant="outline" className="text-[10px] h-5">Urgent</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Master bath tile upgrade request pending approval.</p>
                    <Button size="sm" variant="outline" className="mt-3 w-full text-xs h-8">Review & Sign</Button>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg border border-border hover:bg-muted transition-colors cursor-pointer group">
                    <h4 className="font-medium text-sm group-hover:text-primary transition-colors">Select Lighting Fixtures</h4>
                    <p className="text-xs text-muted-foreground mt-1">Kitchen island pendant selection needed by Friday.</p>
                    <Link href="/inspiration">
                      <Button size="sm" variant="outline" className="mt-3 w-full text-xs h-8">Go to Selections</Button>
                    </Link>
                  </div>
                </>
              ) : (
                <div className="p-4 bg-muted/50 rounded-lg border border-border">
                  <h4 className="font-medium text-sm">Review Initial Concepts</h4>
                  <p className="text-xs text-muted-foreground mt-1">Architect has uploaded 3 variations for the front elevation.</p>
                  <Button size="sm" variant="outline" className="mt-3 w-full text-xs h-8">View Concepts</Button>
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
              <p className="text-sm font-medium text-muted-foreground">Days Remaining</p>
              <h3 className="text-2xl font-bold">{selectedProject === 'jenkins' ? '45' : '120'}</h3>
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
              <h3 className="text-2xl font-bold">{project.budgetStatus}</h3>
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
              <h3 className="text-2xl font-bold">{selectedProject === 'jenkins' ? '24/58' : '3/45'}</h3>
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
              <h3 className="text-lg font-bold">{project.nextMilestone}</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Updates */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Project Updates</CardTitle>
          <CardDescription>Daily logs from your project manager</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-4 pb-6 border-b border-border last:border-0 last:pb-0">
                <div className="flex-shrink-0 w-24 text-sm text-muted-foreground pt-1">
                  Today, 9:00 AM
                </div>
                <div>
                  <h4 className="font-medium text-foreground">
                    {selectedProject === 'jenkins' 
                      ? "Electrical Rough-in Inspection Passed" 
                      : "Survey Team on Site"}
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedProject === 'jenkins'
                      ? "The city inspector signed off on all electrical work this morning. The crew is now proceeding with insulation installation."
                      : "Topographical survey completed. Data is being processed for the architect."}
                  </p>
                  {i === 1 && selectedProject === 'jenkins' && (
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
  );
}