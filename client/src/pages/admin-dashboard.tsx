import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Search, Plus, Filter, Download, Calculator, Ruler } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";

interface Project {
  id: string;
  name: string;
  type: string | null;
  status: string;
  phase: string;
  budget: string | null;
  progress: number;
  address: string;
  contractorId: string | null;
  clientId: string | null;
}

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: projects = [], isLoading, isError, error } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/projects");
      return res.json();
    },
  });

  // Filter to only show projects assigned to current contractor
  const myProjects = projects.filter(p => p.contractorId === user?.id);

  const filteredProjects = myProjects.filter((project) =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.type?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeProjects = myProjects.filter(p => 
    p.status === "Active" || p.status === "In Progress" || p.status === "active" || p.status === "in_progress"
  );
  
  const totalBudget = myProjects.reduce((sum, p) => sum + (parseFloat(p.budget || "0") || 0), 0);

  const escapeCSV = (value: string) => {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const handleExportReport = () => {
    const headers = ["Project Name", "Address", "Type", "Status", "Phase", "Budget", "Progress"];
    const rows = myProjects.map(p => [
      escapeCSV(p.name),
      escapeCSV(p.address || ""),
      escapeCSV(p.type || ""),
      escapeCSV(p.status),
      escapeCSV(p.phase),
      p.budget ? `$${parseFloat(p.budget).toLocaleString()}` : "",
      `${p.progress}%`
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `projects_report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    toast({
      title: "Report Exported",
      description: "Your project report has been downloaded.",
    });
  };

  const formatBudget = (budget: string | null) => {
    if (!budget) return "-";
    const num = parseFloat(budget);
    if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(0)}K`;
    return `$${num.toLocaleString()}`;
  };

  const getStatusVariant = (status: string) => {
    const normalizedStatus = status.toLowerCase().replace("_", " ");
    if (normalizedStatus === "active" || normalizedStatus === "in progress") return "default";
    if (normalizedStatus === "completed") return "secondary";
    if (normalizedStatus === "planning") return "outline";
    return "secondary";
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Project Overview</h1>
          <p className="text-muted-foreground mt-1">Manage active jobs, estimates, and schedules.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/calculator">
            <Button 
              variant="outline"
              data-testid="button-calculator"
              className="hover:bg-muted hover:scale-[1.02] transition-all"
            >
              <Calculator className="w-4 h-4 mr-2" />
              Calculator
            </Button>
          </Link>
          <Link href="/floor-calculator">
            <Button 
              variant="outline"
              data-testid="button-floor-calculator"
              className="hover:bg-muted hover:scale-[1.02] transition-all"
            >
              <Ruler className="w-4 h-4 mr-2" />
              Floor Calc
            </Button>
          </Link>
          <Button 
            variant="outline" 
            onClick={handleExportReport} 
            data-testid="button-export-report"
            className="hover:bg-muted hover:scale-[1.02] transition-all"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
          <Link href="/new-project">
            <Button 
              className="bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-[1.02] transition-all" 
              data-testid="button-new-project"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <Card className="bg-primary text-primary-foreground border-none">
          <CardContent className="p-6">
            <p className="text-sm opacity-80">Total Active Revenue</p>
            <h3 className="text-3xl font-bold mt-2" data-testid="text-total-revenue">
              {formatBudget(totalBudget.toString())}
            </h3>
            <p className="text-xs mt-4 flex items-center text-green-400">
              Across all projects
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Active Projects</p>
            <h3 className="text-3xl font-bold mt-2 text-foreground" data-testid="text-active-projects">
              {activeProjects.length}
            </h3>
            <p className="text-xs mt-4 text-muted-foreground">
              {myProjects.length} total projects
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Pending Estimates</p>
            <h3 className="text-3xl font-bold mt-2 text-foreground">0</h3>
            <p className="text-xs mt-4 text-orange-500">
              Coming soon
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Open Tasks</p>
            <h3 className="text-3xl font-bold mt-2 text-foreground">0</h3>
            <p className="text-xs mt-4 text-muted-foreground">
              Coming soon
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Active Jobs</CardTitle>
              <CardDescription>Real-time status of all ongoing construction.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search projects..." 
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search-projects"
                />
              </div>
              <Button variant="outline" size="icon" className="hover:bg-muted transition-colors">
                <Filter className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading projects...</div>
          ) : isError ? (
            <div className="text-center py-8">
              <p className="text-red-500 mb-2">Failed to load projects</p>
              <p className="text-muted-foreground text-sm">{(error as Error)?.message || "Please try again later"}</p>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                {searchQuery ? "No projects match your search." : "No projects yet. Create your first project!"}
              </p>
              {!searchQuery && (
                <Link href="/new-project">
                  <Button 
                    data-testid="button-create-first-project"
                    className="hover:bg-primary/90 hover:scale-[1.02] transition-all"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Project
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Current Phase</TableHead>
                  <TableHead>Budget</TableHead>
                  <TableHead>Progress</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProjects.map((project) => (
                  <TableRow 
                    key={project.id} 
                    data-testid={`row-project-${project.id}`}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setLocation(`/project/${project.id}`)}
                  >
                    <TableCell className="font-medium">{project.name}</TableCell>
                    <TableCell>{project.type || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(project.status)}>
                        {project.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{project.phase}</TableCell>
                    <TableCell>{formatBudget(project.budget)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-xs w-8">{project.progress}%</span>
                        <div className="h-2 w-24 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary" 
                            style={{ width: `${project.progress}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
