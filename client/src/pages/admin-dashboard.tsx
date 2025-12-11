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
import { Search, Plus, MoreHorizontal, Filter, Download } from "lucide-react";

export default function AdminDashboard() {
  const projects = [
    { id: 1, name: "Jenkins Residence", type: "Renovation", status: "In Progress", phase: "Rough-in", budget: "$145,000", progress: 45 },
    { id: 2, name: "Miller Kitchen", type: "Remodel", status: "Planning", phase: "Design", budget: "$65,000", progress: 15 },
    { id: 3, name: "West Lake Build", type: "New Construction", status: "Active", phase: "Foundation", budget: "$850,000", progress: 20 },
    { id: 4, name: "Downtown Loft", type: "Commercial", status: "Completed", phase: "Handover", budget: "$120,000", progress: 100 },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Project Overview</h1>
          <p className="text-muted-foreground mt-1">Manage active jobs, estimates, and schedules.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
          <Button className="bg-primary text-primary-foreground">
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <Card className="bg-primary text-primary-foreground border-none">
          <CardContent className="p-6">
            <p className="text-sm opacity-80">Total Active Revenue</p>
            <h3 className="text-3xl font-bold mt-2">$1.2M</h3>
            <p className="text-xs mt-4 flex items-center text-green-400">
              +12% from last month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Active Projects</p>
            <h3 className="text-3xl font-bold mt-2 text-foreground">12</h3>
            <p className="text-xs mt-4 text-muted-foreground">
              4 nearing completion
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Pending Estimates</p>
            <h3 className="text-3xl font-bold mt-2 text-foreground">8</h3>
            <p className="text-xs mt-4 text-orange-500">
              3 high priority
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Open Tasks</p>
            <h3 className="text-3xl font-bold mt-2 text-foreground">24</h3>
            <p className="text-xs mt-4 text-muted-foreground">
              Across all projects
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
                <Input placeholder="Search projects..." className="pl-8" />
              </div>
              <Button variant="outline" size="icon">
                <Filter className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Current Phase</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => (
                <TableRow key={project.id}>
                  <TableCell className="font-medium">{project.name}</TableCell>
                  <TableCell>{project.type}</TableCell>
                  <TableCell>
                    <Badge variant={project.status === "Active" || project.status === "In Progress" ? "default" : "secondary"}>
                      {project.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{project.phase}</TableCell>
                  <TableCell>{project.budget}</TableCell>
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
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}