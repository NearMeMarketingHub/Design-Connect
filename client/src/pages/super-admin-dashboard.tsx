import { useState, useEffect } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  RefreshCw,
  Calculator,
  Check,
  X,
  Clock,
  TrendingUp,
  Receipt,
  Layers,
  Plus,
  Trash2,
  Pencil,
  CreditCard,
  CheckCircle
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { parseErrorMessage, apiRequest } from "@/lib/queryClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { Project, User, ContractorRequest } from "@shared/schema";

export default function SuperAdminDashboard() {
  const [_, setLocation] = useLocation();
  const { user, loading: authLoading, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedContractorId, setSelectedContractorId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  // Role definition dialog state
  const [roleDefDialogOpen, setRoleDefDialogOpen] = useState(false);
  const [editingRoleDef, setEditingRoleDef] = useState<any | null>(null);
  const [roleDefForm, setRoleDefForm] = useState({ name: "", type: "contractor", permissions: {} as Record<string, boolean> });

  // Subscription tier dialog state
  const [tierDialogOpen, setTierDialogOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<any | null>(null);
  const [tierForm, setTierForm] = useState({ name: "", price: "0", maxProjects: "", features: "", sortOrder: "0", isActive: true });

  // Company subscription edit dialog
  const [companySubDialogOpen, setCompanySubDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<any | null>(null);
  const [companySubForm, setCompanySubForm] = useState({ subscriptionPlan: "free", subscriptionStatus: "trialing" });

  // Create company dialog
  const [createCompanyDialogOpen, setCreateCompanyDialogOpen] = useState(false);
  const [createCompanyForm, setCreateCompanyForm] = useState({
    companyName: "",
    ownerName: "",
    ownerEmail: "",
    ownerUsername: "",
    password: "",
    companyType: "",
    subscriptionPlan: "free",
  });

  const PERMISSION_KEYS: { key: string; label: string }[] = [
    { key: "viewProjects", label: "View Projects" },
    { key: "editProjects", label: "Edit Projects" },
    { key: "manageDocuments", label: "Manage Documents" },
    { key: "viewFinancials", label: "View Financials" },
    { key: "manageTeam", label: "Manage Team" },
    { key: "viewMessages", label: "View & Send Messages" },
    { key: "signDocuments", label: "Sign Documents" },
  ];

  const openCreateRoleDef = () => {
    setEditingRoleDef(null);
    setRoleDefForm({ name: "", type: "contractor", permissions: {} });
    setRoleDefDialogOpen(true);
  };

  const openEditRoleDef = (def: any) => {
    setEditingRoleDef(def);
    setRoleDefForm({ name: def.name, type: def.type, permissions: def.permissions || {} });
    setRoleDefDialogOpen(true);
  };

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) {
      setLocation("/admin/login");
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

  const { data: pendingContractors = [], isLoading: pendingLoading } = useQuery({
    queryKey: ["/api/admin/contractors/pending"],
    queryFn: () => api.getPendingContractors(),
    enabled: user?.role === "admin",
  });

  const { data: contractorRequests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ["/api/contractor-requests/pending"],
    queryFn: () => api.getPendingContractorRequests(),
    enabled: user?.role === "admin",
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["/api/admin/companies"],
    queryFn: () => apiRequest("GET", "/api/admin/companies").then(r => r.json()),
    enabled: user?.role === "admin",
  });

  const { data: roleDefs = [], refetch: refetchRoleDefs } = useQuery({
    queryKey: ["/api/admin/role-definitions"],
    queryFn: () => apiRequest("GET", "/api/admin/role-definitions").then(r => r.json()),
    enabled: user?.role === "admin",
  });

  const { data: adminTiers = [], refetch: refetchTiers } = useQuery({
    queryKey: ["/api/admin/subscription/tiers"],
    queryFn: () => apiRequest("GET", "/api/admin/subscription/tiers").then(r => r.json()),
    enabled: user?.role === "admin",
  });

  const deleteRoleDefMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/role-definitions/${id}`),
    onSuccess: () => { refetchRoleDefs(); toast({ title: "Role deleted" }); },
    onError: (err: Error) => toast({ title: "Error", description: parseErrorMessage(err), variant: "destructive" }),
  });

  const saveTierMutation = useMutation({
    mutationFn: async (data: typeof tierForm) => {
      const payload = {
        name: data.name.trim(),
        price: data.price || "0",
        maxProjects: data.maxProjects ? parseInt(data.maxProjects) : null,
        features: data.features.split("\n").map(f => f.trim()).filter(Boolean),
        sortOrder: parseInt(data.sortOrder) || 0,
        isActive: data.isActive,
      };
      const url = editingTier ? `/api/admin/subscription/tiers/${editingTier.id}` : "/api/admin/subscription/tiers";
      const method = editingTier ? "PATCH" : "POST";
      return apiRequest(method, url, payload).then(r => r.json());
    },
    onSuccess: () => { refetchTiers(); setTierDialogOpen(false); toast({ title: editingTier ? "Tier updated" : "Tier created" }); },
    onError: (err: Error) => toast({ title: "Error", description: parseErrorMessage(err), variant: "destructive" }),
  });

  const deleteTierMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/subscription/tiers/${id}`),
    onSuccess: () => { refetchTiers(); toast({ title: "Tier deleted" }); },
    onError: (err: Error) => toast({ title: "Error", description: parseErrorMessage(err), variant: "destructive" }),
  });

  const updateCompanySubMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof companySubForm }) =>
      apiRequest("PATCH", `/api/admin/companies/${id}/subscription`, data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies"] });
      setCompanySubDialogOpen(false);
      toast({ title: "Subscription updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: parseErrorMessage(err), variant: "destructive" }),
  });

  const createCompanyMutation = useMutation({
    mutationFn: (data: typeof createCompanyForm) =>
      apiRequest("POST", "/api/admin/companies", data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies"] });
      setCreateCompanyDialogOpen(false);
      setCreateCompanyForm({ companyName: "", ownerName: "", ownerEmail: "", ownerUsername: "", password: "", companyType: "", subscriptionPlan: "free" });
      toast({ title: "Company created", description: "The company and owner account have been created." });
    },
    onError: (err: Error) => toast({ title: "Error", description: parseErrorMessage(err), variant: "destructive" }),
  });

  const openTierCreate = () => {
    setEditingTier(null);
    setTierForm({ name: "", price: "0", maxProjects: "", features: "", sortOrder: "0", isActive: true });
    setTierDialogOpen(true);
  };

  const openTierEdit = (tier: any) => {
    setEditingTier(tier);
    setTierForm({
      name: tier.name,
      price: tier.price || "0",
      maxProjects: tier.maxProjects ? String(tier.maxProjects) : "",
      features: (tier.features || []).join("\n"),
      sortOrder: String(tier.sortOrder || 0),
      isActive: tier.isActive !== false,
    });
    setTierDialogOpen(true);
  };

  const openCompanySubEdit = (company: any) => {
    setEditingCompany(company);
    setCompanySubForm({ subscriptionPlan: company.subscriptionPlan || "free", subscriptionStatus: company.subscriptionStatus || "trialing" });
    setCompanySubDialogOpen(true);
  };

  const saveRoleDefMutation = useMutation({
    mutationFn: (data: { name: string; type: string; permissions: Record<string, boolean> }) => {
      const url = editingRoleDef
        ? `/api/admin/role-definitions/${editingRoleDef.id}`
        : "/api/admin/role-definitions";
      const method = editingRoleDef ? "PATCH" : "POST";
      return apiRequest(method, url, data).then(r => r.json());
    },
    onSuccess: () => {
      refetchRoleDefs();
      setRoleDefDialogOpen(false);
      toast({ title: editingRoleDef ? "Role updated" : "Role created" });
    },
    onError: (err: Error) => toast({ title: "Error", description: parseErrorMessage(err), variant: "destructive" }),
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
    onError: (error: Error) => {
      toast({
        title: "Initialization Failed",
        description: parseErrorMessage(error) || "Could not initialize sandbox",
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
    onError: (error: Error) => {
      toast({
        title: "Reset Failed",
        description: parseErrorMessage(error) || "Could not reset sandbox",
        variant: "destructive",
      });
    },
  });

  const approveContractorMutation = useMutation({
    mutationFn: (contractorId: string) => api.approveContractor(contractorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contractors/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contractors"] });
      toast({
        title: "Contractor Approved",
        description: "The contractor can now log in to their account.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Approval Failed",
        description: parseErrorMessage(error) || "Could not approve contractor",
        variant: "destructive",
      });
    },
  });

  const rejectContractorMutation = useMutation({
    mutationFn: (contractorId: string) => api.rejectContractor(contractorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contractors/pending"] });
      toast({
        title: "Contractor Rejected",
        description: "The contractor account has been removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Rejection Failed",
        description: parseErrorMessage(error) || "Could not reject contractor",
        variant: "destructive",
      });
    },
  });

  const approveRequestMutation = useMutation({
    mutationFn: (requestId: string) => api.approveContractorRequest(requestId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contractor-requests/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contractors"] });
      toast({
        title: "Request Approved",
        description: `Contractor account created. Temporary password: ${data.tempPassword}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Approval Failed",
        description: parseErrorMessage(error) || "Could not approve request",
        variant: "destructive",
      });
    },
  });

  const rejectRequestMutation = useMutation({
    mutationFn: (requestId: string) => api.rejectContractorRequest(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contractor-requests/pending"] });
      toast({
        title: "Request Rejected",
        description: "The access request has been rejected.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Rejection Failed",
        description: parseErrorMessage(error) || "Could not reject request",
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
    onError: (error: Error) => {
      toast({
        title: "Assignment Failed",
        description: parseErrorMessage(error) || "Could not assign contractor",
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

  const filteredProjects = projects
    .filter(p => !p.isSandbox)
    .filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.clientName?.toLowerCase() || "").includes(searchQuery.toLowerCase())
    );

  const realProjects = projects.filter(p => !p.isSandbox);
  const inProgressCount = realProjects.filter(p => p.status === "in_progress" || p.status === "active").length;

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
          <Link href="/admin/contractors">
            <Button variant="outline" size="sm" data-testid="btn-manage-contractors">
              <Users className="w-4 h-4 mr-2" />
              Manage Contractors
              {(pendingContractors.length + contractorRequests.length) > 0 && (
                <Badge variant="secondary" className="ml-2 bg-orange-100 text-orange-700">
                  {pendingContractors.length + contractorRequests.length}
                </Badge>
              )}
            </Button>
          </Link>
          <Badge variant="outline" className="border-green-600 text-green-600">
            Admin Mode
          </Badge>
          <ThemeToggle />
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

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <FolderOpen className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Projects</p>
                  <h3 className="text-2xl font-bold text-foreground">{realProjects.length}</h3>
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
                  <h3 className="text-2xl font-bold text-foreground">{contractors.filter(c => !c.isSandbox).length}</h3>
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
                  <h3 className="text-2xl font-bold text-foreground">{clients.filter(c => !c.isSandbox).length}</h3>
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
          <Link href="/admin/contractors">
            <Card className={`cursor-pointer hover:shadow-md transition-shadow ${(pendingContractors.length + contractorRequests.length) > 0 ? "border-orange-300 bg-orange-50" : ""}`}>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-lg ${(pendingContractors.length + contractorRequests.length) > 0 ? "bg-orange-200" : "bg-orange-100"}`}>
                    <Clock className={`w-6 h-6 ${(pendingContractors.length + contractorRequests.length) > 0 ? "text-orange-700" : "text-orange-600"}`} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Pending Requests</p>
                    <h3 className="text-2xl font-bold text-foreground">{pendingContractors.length + contractorRequests.length}</h3>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
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
                            <Link href={`/admin/project/${project.id}`}>
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

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Calculator className="w-5 h-5 text-green-600" />
                      Budget Manager
                    </CardTitle>
                    <CardDescription>Manage pricing and budget templates</CardDescription>
                  </div>
                  <Badge variant="outline" className="border-green-600 text-green-600">
                    Admin
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Link href="/admin/budget">
                  <Button className="w-full" data-testid="button-budget-manager">
                    <Calculator className="w-4 h-4 mr-2" />
                    Open Price Manager
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-blue-600" />
                      Financial Management
                    </CardTitle>
                    <CardDescription>Sales, estimates, and accounting</CardDescription>
                  </div>
                  <Badge variant="outline" className="border-blue-600 text-blue-600">
                    Admin
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link href="/admin/sales">
                  <Button className="w-full justify-start" variant="outline" data-testid="button-sales">
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Sales Dashboard
                  </Button>
                </Link>
                <Link href="/admin/estimates">
                  <Button className="w-full justify-start" variant="outline" data-testid="button-estimates">
                    <FileText className="w-4 h-4 mr-2" />
                    Estimates
                  </Button>
                </Link>
                <Link href="/admin/accounting">
                  <Button className="w-full justify-start" variant="outline" data-testid="button-accounting">
                    <Receipt className="w-4 h-4 mr-2" />
                    Accounting
                  </Button>
                </Link>
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
                    <Link href={`/admin/sandbox/dashboard`}>
                      <Button className="w-full justify-start" variant="outline" data-testid="button-sandbox-dashboard">
                        <LayoutDashboard className="w-4 h-4 mr-2" />
                        Client Dashboard
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
        </div>

        {/* Companies / Subscriptions Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-600" /> Subscriptions
            </h2>
            <Button size="sm" onClick={() => setCreateCompanyDialogOpen(true)} data-testid="button-create-company">
              <Plus className="w-4 h-4 mr-1" /> Create Company
            </Button>
          </div>
          {companies.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">No companies registered yet.</CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Trial Started</TableHead>
                      <TableHead>Trial Ends</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companies.map((company: any) => {
                      const trialStart = company.trialStartedAt ? new Date(company.trialStartedAt) : null;
                      const trialEnd = trialStart ? new Date(trialStart.getTime() + 7 * 24 * 60 * 60 * 1000) : null;
                      const now = new Date();
                      const isExpired = company.subscriptionStatus === "expired" || (company.subscriptionStatus === "trialing" && trialEnd && now > trialEnd);
                      return (
                        <TableRow key={company.id} data-testid={`company-row-${company.id}`}>
                          <TableCell className="font-medium">{company.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{company.ownerName || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">{company.subscriptionPlan || "free"}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={company.subscriptionStatus === "active" ? "default" : isExpired ? "destructive" : "secondary"} className="capitalize">
                              {isExpired && company.subscriptionStatus !== "expired" ? "expired" : company.subscriptionStatus}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {trialStart ? trialStart.toLocaleDateString() : "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {trialEnd ? trialEnd.toLocaleDateString() : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openCompanySubEdit(company)}
                              data-testid={`button-edit-sub-${company.id}`}
                            >
                              <Pencil className="w-3.5 h-3.5 mr-1" />
                              Edit Plan
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Subscription Tiers Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600" /> Subscription Tiers
            </h2>
            <Button size="sm" onClick={openTierCreate} data-testid="button-add-tier">
              <Plus className="w-4 h-4 mr-1" /> Add Tier
            </Button>
          </div>
          {adminTiers.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <p className="text-sm">No tiers defined. Add tiers to show plans to company users.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {adminTiers.map((tier: any) => {
                const price = parseFloat(tier.price);
                return (
                  <Card key={tier.id} className={!tier.isActive ? "opacity-60" : ""} data-testid={`tier-card-${tier.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{tier.name}</CardTitle>
                        <div className="flex items-center gap-1">
                          {!tier.isActive && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => openTierEdit(tier)} data-testid={`button-edit-tier-${tier.id}`}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive hover:text-destructive" onClick={() => deleteTierMutation.mutate(tier.id)} disabled={deleteTierMutation.isPending} data-testid={`button-delete-tier-${tier.id}`}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-2xl font-bold">{price === 0 ? "Free" : `$${price % 1 === 0 ? price.toFixed(0) : price.toFixed(2)}/mo`}</p>
                    </CardHeader>
                    <CardContent>
                      {tier.maxProjects && <p className="text-xs text-muted-foreground mb-2">Up to {tier.maxProjects} projects</p>}
                      <ul className="space-y-1">
                        {(tier.features || []).map((f: string) => (
                          <li key={f} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <CheckCircle className="w-3 h-3 text-green-500 shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Role Definitions Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" /> Role Definitions
            </h2>
            <Button size="sm" onClick={openCreateRoleDef} data-testid="button-add-role-def">
              <Plus className="w-4 h-4 mr-1" /> Add Role
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(["contractor", "subcontractor"] as string[]).map(type => (
              <Card key={type}>
                <CardHeader>
                  <CardTitle className="capitalize text-base">{type === "contractor" ? "Contractor Roles" : "Subcontractor Specialties"}</CardTitle>
                  <CardDescription>{type === "contractor" ? "Team member roles and permissions" : "Available subcontractor trade specialties"}</CardDescription>
                </CardHeader>
                <CardContent>
                  {roleDefs.filter((r: any) => r.type === type).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No role definitions yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {roleDefs.filter((r: any) => r.type === type).map((def: any) => (
                        <div key={def.id} className="flex items-center justify-between py-2 px-3 rounded-lg border" data-testid={`role-def-${def.id}`}>
                          <div>
                            <p className="font-medium text-sm">{def.name}</p>
                            {def.isDefault && <p className="text-xs text-muted-foreground">System default</p>}
                            {def.permissions && Object.keys(def.permissions).length > 0 && (
                              <p className="text-xs text-muted-foreground">
                                {Object.entries(def.permissions as Record<string, boolean>)
                                  .filter(([, v]) => v)
                                  .length} permissions
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="w-7 h-7"
                              onClick={() => openEditRoleDef(def)}
                              data-testid={`button-edit-role-${def.id}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            {!def.isDefault && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive w-7 h-7"
                                onClick={() => deleteRoleDefMutation.mutate(def.id)}
                                disabled={deleteRoleDefMutation.isPending}
                                data-testid={`button-delete-role-${def.id}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>

      {/* Subscription Tier Create/Edit Dialog */}
      <Dialog open={tierDialogOpen} onOpenChange={setTierDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTier ? "Edit Subscription Tier" : "Create Subscription Tier"}</DialogTitle>
            <DialogDescription>Define a subscription plan with pricing and features.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="tier-name">Plan Name</Label>
              <Input id="tier-name" value={tierForm.name} onChange={e => setTierForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Starter" data-testid="input-tier-name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tier-price">Monthly Price ($)</Label>
                <Input id="tier-price" type="number" min="0" value={tierForm.price} onChange={e => setTierForm(f => ({ ...f, price: e.target.value }))} placeholder="49" data-testid="input-tier-price" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tier-maxprojects">Max Projects</Label>
                <Input id="tier-maxprojects" type="number" min="1" value={tierForm.maxProjects} onChange={e => setTierForm(f => ({ ...f, maxProjects: e.target.value }))} placeholder="Unlimited" data-testid="input-tier-maxprojects" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tier-features">Features (one per line)</Label>
              <textarea
                id="tier-features"
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                value={tierForm.features}
                onChange={e => setTierForm(f => ({ ...f, features: e.target.value }))}
                placeholder="Unlimited projects&#10;Priority support&#10;Team members"
                data-testid="input-tier-features"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="tier-active">Active (visible to companies)</Label>
              <Switch id="tier-active" checked={tierForm.isActive} onCheckedChange={v => setTierForm(f => ({ ...f, isActive: v }))} data-testid="switch-tier-active" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTierDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => saveTierMutation.mutate(tierForm)} disabled={!tierForm.name.trim() || saveTierMutation.isPending} data-testid="button-save-tier">
              {saveTierMutation.isPending ? "Saving…" : editingTier ? "Save Changes" : "Create Tier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Company Subscription Edit Dialog */}
      <Dialog open={companySubDialogOpen} onOpenChange={setCompanySubDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Subscription</DialogTitle>
            <DialogDescription>Update plan and status for {editingCompany?.name}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Plan</Label>
              <Select value={companySubForm.subscriptionPlan} onValueChange={v => setCompanySubForm(f => ({ ...f, subscriptionPlan: v }))}>
                <SelectTrigger data-testid="select-company-plan">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  {adminTiers.map((t: any) => (
                    <SelectItem key={t.id} value={t.name.toLowerCase()}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={companySubForm.subscriptionStatus} onValueChange={v => setCompanySubForm(f => ({ ...f, subscriptionStatus: v }))}>
                <SelectTrigger data-testid="select-company-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trialing">Trialing</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="past_due">Past Due</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCompanySubDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => editingCompany && updateCompanySubMutation.mutate({ id: editingCompany.id, data: companySubForm })}
              disabled={updateCompanySubMutation.isPending}
              data-testid="button-save-company-sub"
            >
              {updateCompanySubMutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Definition Create/Edit Dialog */}
      <Dialog open={roleDefDialogOpen} onOpenChange={setRoleDefDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRoleDef ? "Edit Role Definition" : "Create Role Definition"}</DialogTitle>
            <DialogDescription>Define a role name, type, and permission set.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="role-name">Role Name</Label>
              <Input
                id="role-name"
                value={roleDefForm.name}
                onChange={e => setRoleDefForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Project Manager"
                data-testid="input-role-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role-type">Role Type</Label>
              <Select value={roleDefForm.type} onValueChange={v => setRoleDefForm(f => ({ ...f, type: v }))}>
                <SelectTrigger id="role-type" data-testid="select-role-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contractor">Contractor (Team Member)</SelectItem>
                  <SelectItem value="subcontractor">Subcontractor (Trade Specialty)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="space-y-2 rounded-lg border p-3">
                {PERMISSION_KEYS.map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-sm">{label}</span>
                    <Switch
                      checked={!!roleDefForm.permissions[key]}
                      onCheckedChange={v => setRoleDefForm(f => ({ ...f, permissions: { ...f.permissions, [key]: v } }))}
                      data-testid={`switch-perm-${key}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRoleDefDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => saveRoleDefMutation.mutate(roleDefForm)}
              disabled={!roleDefForm.name.trim() || saveRoleDefMutation.isPending}
              data-testid="button-save-role-def"
            >
              {saveRoleDefMutation.isPending ? "Saving…" : (editingRoleDef ? "Save Changes" : "Create Role")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Company Dialog */}
      <Dialog open={createCompanyDialogOpen} onOpenChange={setCreateCompanyDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Company</DialogTitle>
            <DialogDescription>Create a new company and its owner account.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="cc-company-name">Company Name</Label>
              <Input
                id="cc-company-name"
                value={createCompanyForm.companyName}
                onChange={e => setCreateCompanyForm(f => ({ ...f, companyName: e.target.value }))}
                placeholder="Acme Construction"
                data-testid="input-create-company-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cc-company-type">Company Type <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                id="cc-company-type"
                value={createCompanyForm.companyType}
                onChange={e => setCreateCompanyForm(f => ({ ...f, companyType: e.target.value }))}
                placeholder="General Contractor"
                data-testid="input-create-company-type"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Subscription Plan</Label>
              <Select value={createCompanyForm.subscriptionPlan} onValueChange={v => setCreateCompanyForm(f => ({ ...f, subscriptionPlan: v }))}>
                <SelectTrigger data-testid="select-create-company-plan">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  {adminTiers.map((t: any) => (
                    <SelectItem key={t.id} value={t.name.toLowerCase()}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="border-t pt-3 space-y-3">
              <p className="text-sm font-medium text-foreground">Owner Account</p>
              <div className="space-y-1.5">
                <Label htmlFor="cc-owner-name">Full Name</Label>
                <Input
                  id="cc-owner-name"
                  value={createCompanyForm.ownerName}
                  onChange={e => setCreateCompanyForm(f => ({ ...f, ownerName: e.target.value }))}
                  placeholder="Jane Smith"
                  data-testid="input-create-owner-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cc-owner-email">Email</Label>
                <Input
                  id="cc-owner-email"
                  type="email"
                  value={createCompanyForm.ownerEmail}
                  onChange={e => setCreateCompanyForm(f => ({ ...f, ownerEmail: e.target.value }))}
                  placeholder="jane@acme.com"
                  data-testid="input-create-owner-email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cc-owner-username">Username</Label>
                <Input
                  id="cc-owner-username"
                  value={createCompanyForm.ownerUsername}
                  onChange={e => setCreateCompanyForm(f => ({ ...f, ownerUsername: e.target.value }))}
                  placeholder="janesmith"
                  data-testid="input-create-owner-username"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cc-password">Password</Label>
                <Input
                  id="cc-password"
                  type="password"
                  value={createCompanyForm.password}
                  onChange={e => setCreateCompanyForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Min. 6 characters"
                  data-testid="input-create-owner-password"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateCompanyDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createCompanyMutation.mutate(createCompanyForm)}
              disabled={
                !createCompanyForm.companyName.trim() ||
                !createCompanyForm.ownerName.trim() ||
                !createCompanyForm.ownerEmail.trim() ||
                !createCompanyForm.ownerUsername.trim() ||
                createCompanyForm.password.length < 6 ||
                createCompanyMutation.isPending
              }
              data-testid="button-submit-create-company"
            >
              {createCompanyMutation.isPending ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Creating…</> : "Create Company"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
