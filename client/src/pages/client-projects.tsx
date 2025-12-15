import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { MapPin, ArrowRight, Calendar, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";
import projectImage from "@assets/generated_images/modern_luxury_home_interior_with_natural_light.png";
import blueprintImage from "@assets/generated_images/construction_blueprints_and_hard_hat_on_table.png";

const PROJECTS = [
  {
    id: "jenkins",
    name: "The Jenkins Residence",
    address: "123 Maple Avenue",
    status: "Active",
    phase: "Phase 3: Rough-in",
    progress: 45,
    image: projectImage,
    nextMilestone: "Drywall Inspection",
    dueDate: "Jan 15, 2026"
  },
  {
    id: "lakehouse",
    name: "Lake House Retreat",
    address: "889 Shoreline Drive",
    status: "Planning",
    phase: "Phase 1: Design",
    progress: 15,
    image: blueprintImage,
    nextMilestone: "Permit Approval",
    dueDate: "Mar 01, 2026"
  },
  {
    id: "loft",
    name: "Downtown Loft",
    address: "450 Main St, Unit 4B",
    status: "Completed",
    phase: "Handover",
    progress: 100,
    image: projectImage,
    nextMilestone: "Warranty Check",
    dueDate: "Completed"
  }
];

function ProjectCard({ project }: { project: typeof PROJECTS[0] }) {
  const isCompleted = project.status === 'Completed';
  
  return (
    <Card className="group overflow-hidden border-0 shadow-md hover:shadow-xl transition-all duration-300" data-testid={`card-project-${project.id}`}>
      <div className="aspect-video relative overflow-hidden">
        <img 
          src={project.image} 
          alt={project.name} 
          className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${isCompleted ? 'grayscale-[30%]' : ''}`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-60" />
        <div className="absolute bottom-4 left-4 right-4 text-white">
          <Badge className={`mb-2 border-0 ${
            project.status === 'Active' ? 'bg-green-500 hover:bg-green-600' :
            project.status === 'Planning' ? 'bg-blue-500 hover:bg-blue-600' :
            'bg-slate-500 hover:bg-slate-600'
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
                <p className="text-sm font-medium">{project.nextMilestone}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Calendar className="w-4 h-4 text-primary mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">{isCompleted ? 'Completion' : 'Target Date'}</p>
                <p className="text-sm font-medium">{project.dueDate}</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="p-4 bg-muted/30 border-t border-border">
        <Link href={`/project/${project.id}`} className="w-full" data-testid={`link-project-${project.id}`}>
          <Button className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
            {isCompleted ? 'View Project' : 'View Dashboard'} <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}

export default function ClientProjects() {
  const activeProjects = PROJECTS.filter(p => p.status !== 'Completed');
  const completedProjects = PROJECTS.filter(p => p.status === 'Completed');

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-heading font-bold text-foreground">My Projects</h1>
        <p className="text-muted-foreground mt-1">View and manage all your properties.</p>
      </div>

      {/* Active Projects */}
      <section>
        <h2 className="text-xl font-heading font-semibold text-foreground mb-4">Current Projects</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </section>

      {/* Completed Projects */}
      {completedProjects.length > 0 && (
        <section>
          <h2 className="text-xl font-heading font-semibold text-muted-foreground mb-4">Completed Projects</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {completedProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}