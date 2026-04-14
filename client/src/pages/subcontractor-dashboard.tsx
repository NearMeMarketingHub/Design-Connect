import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { HardHat, FolderOpen, Clock, CheckCircle, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

export default function SubcontractorDashboard() {
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["/api/projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load projects");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeProjects = projects.filter((p: any) => p.status !== "completed");
  const completedProjects = projects.filter((p: any) => p.status === "completed");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-heading font-bold" data-testid="subcontractor-welcome">
          Welcome, {user?.name || user?.username}
        </h1>
        <p className="text-muted-foreground mt-1">
          {user?.subcontractorSpecialty
            ? `Subcontractor · ${user.subcontractorSpecialty}`
            : "Subcontractor"}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card data-testid="card-active-projects">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Assignments</p>
                <p className="text-3xl font-bold mt-1">{activeProjects.length}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-completed-projects">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed Assignments</p>
                <p className="text-3xl font-bold mt-1">{completedProjects.length}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Assigned Projects */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5" />
            Assigned Projects
          </CardTitle>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <HardHat className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No projects assigned yet</p>
              <p className="text-sm mt-1">Your contractor will assign you to projects once work begins.</p>
            </div>
          ) : (
            <div className="divide-y">
              {projects.map((project: any) => (
                <div
                  key={project.id}
                  className="py-3 flex items-center justify-between hover:bg-muted/30 cursor-pointer px-2 rounded"
                  onClick={() => navigate(`/contractor/project/${project.id}`)}
                  data-testid={`project-row-${project.id}`}
                >
                  <div>
                    <p className="font-medium">{project.title}</p>
                    <p className="text-sm text-muted-foreground">{project.address || "No address"}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={project.status === "active" ? "default" : "secondary"} className="capitalize">
                      {project.status}
                    </Badge>
                    <span className="text-sm text-muted-foreground">{project.progress || 0}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
