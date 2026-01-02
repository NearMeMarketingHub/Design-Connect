import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Users, 
  ArrowLeft,
  Loader2,
  Building2,
  Mail,
  User as UserIcon,
  FolderOpen,
  CheckCircle2,
  Clock,
  Calendar
} from "lucide-react";
import { Link, useLocation, useParams } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import type { User, Project } from "@shared/schema";

export default function ContractorProfile() {
  const [_, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("current");

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) {
      setLocation("/admin-login");
    }
  }, [user, authLoading, setLocation]);

  const { data: contractor, isLoading: contractorLoading } = useQuery({
    queryKey: ["/api/admin/contractors", params.id],
    queryFn: async () => {
      const contractors = await api.getContractors();
      return contractors.find((c: Omit<User, "password">) => c.id === params.id);
    },
    enabled: user?.role === "admin" && !!params.id,
  });

  const { data: allProjects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ["/api/admin/projects"],
    queryFn: () => api.getAdminProjects(),
    enabled: user?.role === "admin",
  });

  if (authLoading || contractorLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return null;
  }

  if (!contractor) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <UserIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Contractor Not Found</h2>
            <p className="text-muted-foreground mb-4">The contractor you're looking for doesn't exist.</p>
            <Link href="/super-admin/contractors">
              <Button>Back to Contractors</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const contractorProjects = allProjects.filter(
    (p: Project) => p.contractorId === params.id
  );
  
  const currentProjects = contractorProjects.filter(
    (p: Project) => p.status !== "Completed" && p.status !== "completed"
  );
  
  const pastProjects = contractorProjects.filter(
    (p: Project) => p.status === "Completed" || p.status === "completed"
  );

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "active":
      case "in_progress":
        return "bg-blue-100 text-blue-700";
      case "planning":
        return "bg-purple-100 text-purple-700";
      case "completed":
        return "bg-green-100 text-green-700";
      case "on_hold":
        return "bg-amber-100 text-amber-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/super-admin/contractors">
              <Button variant="ghost" size="sm" data-testid="btn-back-to-contractors">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Contractors
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <UserIcon className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <CardTitle>{contractor.name || contractor.username}</CardTitle>
                  <CardDescription>
                    {contractor.companyType && (
                      <Badge variant="outline" className="mt-1">{contractor.companyType}</Badge>
                    )}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <UserIcon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Username:</span>
                  <span className="font-medium">{contractor.username}</span>
                </div>
                {contractor.companyName && (
                  <div className="flex items-center gap-3 text-sm">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Company:</span>
                    <span className="font-medium">{contractor.companyName}</span>
                  </div>
                )}
                {contractor.email && (
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Email:</span>
                    <span className="font-medium">{contractor.email}</span>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t">
                <h4 className="text-sm font-medium mb-3">Project Summary</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-blue-50 rounded-lg text-center">
                    <p className="text-2xl font-bold text-blue-700">{currentProjects.length}</p>
                    <p className="text-xs text-blue-600">Current</p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg text-center">
                    <p className="text-2xl font-bold text-green-700">{pastProjects.length}</p>
                    <p className="text-xs text-green-600">Completed</p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <Badge 
                  variant="secondary" 
                  className={contractor.isApproved ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}
                >
                  {contractor.isApproved ? "Active" : "Pending Approval"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5" />
                Projects
              </CardTitle>
              <CardDescription>View all projects assigned to this contractor</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4">
                  <TabsTrigger value="current" data-testid="tab-current-projects">
                    Current
                    {currentProjects.length > 0 && (
                      <Badge variant="secondary" className="ml-2">{currentProjects.length}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="completed" data-testid="tab-completed-projects">
                    Completed
                    {pastProjects.length > 0 && (
                      <Badge variant="secondary" className="ml-2">{pastProjects.length}</Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="current">
                  {projectsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : currentProjects.length === 0 ? (
                    <div className="text-center py-8">
                      <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No current projects</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Project</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Progress</TableHead>
                          <TableHead>Due Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentProjects.map((project: Project & { clientName?: string }) => (
                          <TableRow 
                            key={project.id} 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setLocation(`/project/${project.id}`)}
                            data-testid={`row-project-${project.id}`}
                          >
                            <TableCell className="font-medium">{project.name}</TableCell>
                            <TableCell>{project.clientName || "-"}</TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(project.status)}>
                                {project.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-primary rounded-full" 
                                    style={{ width: `${project.progress}%` }}
                                  />
                                </div>
                                <span className="text-sm text-muted-foreground">{project.progress}%</span>
                              </div>
                            </TableCell>
                            <TableCell>{project.dueDate || "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>

                <TabsContent value="completed">
                  {projectsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : pastProjects.length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No completed projects yet</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Project</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Budget</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pastProjects.map((project: Project & { clientName?: string }) => (
                          <TableRow 
                            key={project.id} 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setLocation(`/project/${project.id}`)}
                            data-testid={`row-completed-project-${project.id}`}
                          >
                            <TableCell className="font-medium">{project.name}</TableCell>
                            <TableCell>{project.clientName || "-"}</TableCell>
                            <TableCell>{project.type || "-"}</TableCell>
                            <TableCell>
                              {project.budget ? `$${Number(project.budget).toLocaleString()}` : "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
