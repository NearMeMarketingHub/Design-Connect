import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Shield, 
  Users, 
  FolderOpen, 
  Eye,
  UserPlus,
  Building2,
  Search,
  LogOut,
  HardHat,
  Loader2,
  TestTube,
  MessageSquare,
  FileText,
  Image,
  LayoutDashboard,
  RefreshCw
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { Project, User } from "@shared/schema";

export default function SuperAdminDashboard() {
  const [_, setLocation] = useLocation();
  const { user, loading: authLoading, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedContractorId, setSelectedContractorId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) {
      setLocation("/admin-login");
    }
  }, [user, authLoading, setLocation]);

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ["/api/admin/projects"],
    queryFn: () => api.getAdminProjects(),
    enabled: user?.role === "admin",
  });

  const { data: contractors = [], isLoading: contractorsLoading } = useQuery({
    queryKey: ["/api/admin/contractors"],
    queryFn: () => api.getContractors(),
    enabled: user?.role === "admin",
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["/api/admin/clients"],
    queryFn: () => api.getClients(),
    enabled: user?.role === "admin",
  });

  const { data: sandboxData, isLoading: sandboxLoading } = useQuery({
    queryKey: ["/api/sandbox/data"],
    queryFn: () => api.getSandboxData(),
    enabled: user?.role === "admin",
  });

  const initSandboxMutation = useMutation({
    mutationFn: () => api.initializeSandbox(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sandbox/data"] });
      toast({
        title: "Sandbox Initialized",
        description: "Test client, contractor, and project have been created.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Initialization Failed",
        description: error.message || "Could not initialize sandbox",
        variant: "destructive",
      });
    },
  });

  const resetSandboxMutation = useMutation({
    mutationFn: () => api.resetSandbox(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sandbox/data"] });
      toast({
        title: "Sandbox Reset",
        description: "All sandbox data has been reset to defaults.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Reset Failed",
        description: error.message || "Could not reset sandbox",
        variant: "destructive",
      });
    },
  });

  const assignMutation = useMutation({
    mutationFn: ({ projectId, contractorId }: { projectId: string; contractorId: string }) =>
      api.assignContractor(projectId, contractorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/projects"] });
      toast({
        title: "Contractor Assigned",
        description: "The contractor has been assigned to the project.",
      });
      setAssignDialogOpen(false);
      setSelectedContractorId("");
    },
    onError: (error: any) => {
      toast({
        title: "Assignment Failed",
        description: error.message || "Could not assign contractor",
        variant: "destructive",
      });
    },
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return null;
  }

  const handleAssignContractor = (project: Project & { clientName?: string; contractorName?: string }) => {
    setSelectedProject(project);
    setAssignDialogOpen(true);
  };

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.clientName?.toLowerCase() || "").includes(searchQuery.toLowerCase())
  );

  const inProgressCount = projects.filter(p => p.status === "in_progress" || p.status === "active").length;

  return (
    <div className="min-h-screen bg-background">
      <header className="h-16 border-b bg-card px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-heading font-bold text-xl text-foreground tracking-tight">BuildVision Admin</h1>
            <p className="text-xs text-muted-foreground">System Administration</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="border-green-600 text-green-600">
            Admin Mode
          </Badge>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="p-6 max-w-7xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Dashboard Overview</h2>
          <p className="text-muted-foreground mt-1">Manage projects, contractors, and system settings</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <FolderOpen className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Projects</p>
                  <h3 className="text-2xl font-bold text-foreground">{projects.length}</h3>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <HardHat className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Contractors</p>
                  <h3 className="text-2xl font-bold text-foreground">{contractors.length}</h3>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Users className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Clients</p>
                  <h3 className="text-2xl font-bold text-foreground">{clients.length}</h3>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-100 rounded-lg">
                  <Building2 className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                  <h3 className="text-2xl font-bold text-foreground">{inProgressCount}</h3>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>All Projects</CardTitle>
                  <CardDescription>Manage and assign contractors to projects</CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search projects..." 
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {projectsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredProjects.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No projects found</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Contractor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProjects.map((project) => (
                      <TableRow key={project.id}>
                        <TableCell className="font-medium">{project.name}</TableCell>
                        <TableCell>{project.clientName || "Unknown"}</TableCell>
                        <TableCell>
                          {!project.contractorId ? (
                            <Badge variant="outline" className="border-amber-500 text-amber-600">Unassigned</Badge>
                          ) : (
                            <span>{project.contractorName || "Assigned"}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={project.status === "completed" ? "secondary" : "default"}
                            className={
                              project.status === "in_progress" ? "bg-blue-500" :
                              project.status === "active" ? "bg-green-500" :
                              project.status === "planning" ? "bg-purple-500" :
                              ""
                            }
                          >
                            {project.status.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Link href={`/project/${project.id}?from=admin`}>
                              <Button size="sm" variant="ghost">
                                <Eye className="w-4 h-4" />
                              </Button>
                            </Link>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => handleAssignContractor(project)}
                            >
                              <UserPlus className="w-4 h-4 mr-1" />
                              Assign
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <TestTube className="w-5 h-5 text-purple-600" />
                    Sandbox Testing
                  </CardTitle>
                  <CardDescription>Test features in an isolated environment</CardDescription>
                </div>
                <Badge variant="outline" className="border-purple-600 text-purple-600">
                  Test Mode
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {sandboxLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : !sandboxData?.project ? (
                <div className="text-center py-4">
                  <p className="text-muted-foreground text-sm mb-4">No sandbox data found. Initialize to create test client, contractor, and project.</p>
                  <Button 
                    onClick={() => initSandboxMutation.mutate()}
                    disabled={initSandboxMutation.isPending}
                    className="w-full"
                  >
                    {initSandboxMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Initializing...
                      </>
                    ) : (
                      <>
                        <TestTube className="w-4 h-4 mr-2" />
                        Initialize Sandbox
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <>
                  <div className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-3 mb-4">
                    <p className="text-xs text-purple-700 dark:text-purple-300">
                      <strong>Test Client:</strong> {sandboxData.client?.name}<br />
                      <strong>Test Contractor:</strong> {sandboxData.contractor?.name}<br />
                      <strong>Test Project:</strong> {sandboxData.project.name}
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Client Experience</p>
                    <Link href={`/sandbox/dashboard`}>
                      <Button className="w-full justify-start" variant="outline" data-testid="button-sandbox-dashboard">
                        <LayoutDashboard className="w-4 h-4 mr-2" />
                        Client Dashboard
                      </Button>
                    </Link>
                    <Link href={`/sandbox/project/${sandboxData.project.id}`}>
                      <Button className="w-full justify-start" variant="outline" data-testid="button-sandbox-project">
                        <Eye className="w-4 h-4 mr-2" />
                        Project Details
                      </Button>
                    </Link>
                    <Link href={`/sandbox/project/${sandboxData.project.id}/messages`}>
                      <Button className="w-full justify-start" variant="outline" data-testid="button-sandbox-messages">
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Messages
                      </Button>
                    </Link>
                    <Link href={`/sandbox/project/${sandboxData.project.id}/documents`}>
                      <Button className="w-full justify-start" variant="outline" data-testid="button-sandbox-documents">
                        <FileText className="w-4 h-4 mr-2" />
                        Documents
                      </Button>
                    </Link>
                    <Link href={`/sandbox/project/${sandboxData.project.id}/photos`}>
                      <Button className="w-full justify-start" variant="outline" data-testid="button-sandbox-photos">
                        <Image className="w-4 h-4 mr-2" />
                        Progress Photos
                      </Button>
                    </Link>
                  </div>
                  
                  <div className="space-y-2 pt-4 border-t">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Contractor Experience</p>
                    <Button className="w-full justify-start" variant="outline" disabled data-testid="button-sandbox-contractor">
                      <HardHat className="w-4 h-4 mr-2" />
                      Contractor Dashboard
                      <Badge variant="secondary" className="ml-auto text-xs">Coming Soon</Badge>
                    </Button>
                  </div>
                  
                  <div className="pt-4 border-t">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="w-full text-amber-600 border-amber-300 hover:bg-amber-50"
                      onClick={() => resetSandboxMutation.mutate()}
                      disabled={resetSandboxMutation.isPending}
                      data-testid="button-reset-sandbox"
                    >
                      {resetSandboxMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4 mr-2" />
                      )}
                      Reset Sandbox Data
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Contractor</DialogTitle>
            <DialogDescription>
              Select a contractor to assign to {selectedProject?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedContractorId} onValueChange={setSelectedContractorId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a contractor" />
              </SelectTrigger>
              <SelectContent>
                {contractors.map((contractor) => (
                  <SelectItem 
                    key={contractor.id} 
                    value={contractor.id}
                  >
                    {contractor.name || contractor.username} - {contractor.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (selectedProject && selectedContractorId) {
                  assignMutation.mutate({ projectId: selectedProject.id, contractorId: selectedContractorId });
                }
              }}
              disabled={!selectedContractorId || assignMutation.isPending}
            >
              {assignMutation.isPending ? "Assigning..." : "Assign Contractor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
