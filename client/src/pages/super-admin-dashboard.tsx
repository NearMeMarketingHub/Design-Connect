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
  TableRow,
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
  FileText,
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
  CheckCircle,
  Mail,
  Ban,
  PlayCircle,
  Link2,
  CalendarCheck,
  MessageSquare,
  ChevronDown,
  AlertCircle,
  Wrench,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { parseErrorMessage, apiRequest } from "@/lib/queryClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { Project, User } from "@shared/schema";

// ─── Admin data shapes ────────────────────────────────────────────────────────
interface AdminCompany {
  id: string;
  name: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerUserId?: string;
  companyType?: string;
  subscriptionStatus?: string;
  subscriptionPlan?: string;
  trialStartedAt?: string | null;
  userCount?: number;
  projectCount?: number;
}

interface DemoRequest {
  id: string;
  name: string;
  company?: string;
  email: string;
  phone?: string;
  message?: string;
  status: string;
  createdAt: string;
}

interface AdminInvite {
  id: string;
  inviteType: string;
  email: string;
  status: string;
  projectId?: string | null;
  projectName?: string | null;
  companyName?: string | null;
  sentAt: string;
  acceptedAt?: string | null;
  expiresAt?: string | null;
}

interface SubscriptionTier {
  id: string;
  name: string;
  price: string;
  maxProjects?: number | null;
  features?: string[];
  sortOrder?: number;
  isActive: boolean;
}

interface RoleDef {
  id: string;
  name: string;
  type: string;
  permissions: Record<string, boolean>;
  isDefault?: boolean;
}

// ─── Status helpers ──────────────────────────────────────────────────────────
const DEMO_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  new: { label: "New", color: "bg-blue-100 text-blue-700" },
  contacted: { label: "Contacted", color: "bg-amber-100 text-amber-700" },
  demo_scheduled: { label: "Demo Scheduled", color: "bg-purple-100 text-purple-700" },
  converted: { label: "Converted", color: "bg-green-100 text-green-700" },
  closed: { label: "Closed", color: "bg-gray-100 text-gray-500" },
};

function DemoStatusBadge({ status }: { status: string }) {
  const s = DEMO_STATUS_LABELS[status] ?? { label: status, color: "bg-gray-100 text-gray-500" };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>;
}

function InviteStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700",
    accepted: "bg-green-100 text-green-700",
    expired: "bg-red-100 text-red-700",
    revoked: "bg-gray-100 text-gray-500",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${colors[status] ?? "bg-gray-100 text-gray-500"}`}>
      {status}
    </span>
  );
}

export default function SuperAdminDashboard() {
  const [_, setLocation] = useLocation();
  const { user, loading: authLoading, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ── Dialog state ──────────────────────────────────────────────────────────
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedContractorId, setSelectedContractorId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  const [roleDefDialogOpen, setRoleDefDialogOpen] = useState(false);
  const [editingRoleDef, setEditingRoleDef] = useState<RoleDef | null>(null);
  const [roleDefForm, setRoleDefForm] = useState({ name: "", type: "contractor", permissions: {} as Record<string, boolean> });

  const [tierDialogOpen, setTierDialogOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<SubscriptionTier | null>(null);
  const [tierForm, setTierForm] = useState({ name: "", price: "0", maxProjects: "", features: "", sortOrder: "0", isActive: true });

  const [companySubDialogOpen, setCompanySubDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<AdminCompany | null>(null);
  const [companySubForm, setCompanySubForm] = useState({ subscriptionPlan: "free", subscriptionStatus: "trialing" });

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

  const openEditRoleDef = (def: RoleDef) => {
    setEditingRoleDef(def);
    setRoleDefForm({ name: def.name, type: def.type, permissions: def.permissions || {} });
    setRoleDefDialogOpen(true);
  };

  // ── Auth redirect (effect — not during render) ────────────────────────────
  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) {
      setLocation("/admin-login");
    }
  }, [user, authLoading, setLocation]);

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ["/api/admin/projects"],
    queryFn: () => api.getAdminProjects(),
    enabled: user?.role === "admin",
  });

  const { data: contractors = [] } = useQuery({
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

  const { data: pendingContractors = [] } = useQuery({
    queryKey: ["/api/admin/contractors/pending"],
    queryFn: () => api.getPendingContractors(),
    enabled: user?.role === "admin",
  });

  const { data: contractorRequests = [] } = useQuery({
    queryKey: ["/api/contractor-requests/pending"],
    queryFn: () => api.getPendingContractorRequests(),
    enabled: user?.role === "admin",
  });

  const { data: companies = [] } = useQuery<AdminCompany[]>({
    queryKey: ["/api/admin/companies"],
    queryFn: () => apiRequest("GET", "/api/admin/companies").then(r => r.json()),
    enabled: user?.role === "admin",
  });

  const { data: roleDefs = [], refetch: refetchRoleDefs } = useQuery<RoleDef[]>({
    queryKey: ["/api/admin/role-definitions"],
    queryFn: () => apiRequest("GET", "/api/admin/role-definitions").then(r => r.json()),
    enabled: user?.role === "admin",
  });

  const { data: adminTiers = [], refetch: refetchTiers } = useQuery<SubscriptionTier[]>({
    queryKey: ["/api/admin/subscription/tiers"],
    queryFn: () => apiRequest("GET", "/api/admin/subscription/tiers").then(r => r.json()),
    enabled: user?.role === "admin",
  });

  const { data: demoRequests = [] } = useQuery<DemoRequest[]>({
    queryKey: ["/api/admin/demo-requests"],
    queryFn: () => apiRequest("GET", "/api/admin/demo-requests").then(r => r.json()),
    enabled: user?.role === "admin",
  });

  const { data: adminInvites = [] } = useQuery<AdminInvite[]>({
    queryKey: ["/api/admin/invites"],
    queryFn: () => apiRequest("GET", "/api/admin/invites").then(r => r.json()),
    enabled: user?.role === "admin",
  });

  const { data: platformSettingsData, refetch: refetchPlatformSettings } = useQuery({
    queryKey: ["/api/admin/platform-settings"],
    queryFn: () => apiRequest("GET", "/api/admin/platform-settings").then(r => r.json()),
    enabled: user?.role === "admin",
  });

  // ── Computed stats ────────────────────────────────────────────────────────
  const realProjects = projects.filter(p => !p.isSandbox);
  const allUsers = [...contractors.filter(u => !u.isSandbox), ...clients.filter(u => !u.isSandbox)];
  const activeCompanies = companies.filter(c => c.subscriptionStatus === "active" || c.subscriptionStatus === "trialing");
  const newDemoRequests = demoRequests.filter(d => d.status === "new");
  const pendingInvitesCount = adminInvites.filter(i => i.status === "pending").length;
  const pendingTotal = pendingContractors.length + contractorRequests.length + pendingInvitesCount;
  const filteredProjects = realProjects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.clientName?.toLowerCase() || "").includes(searchQuery.toLowerCase())
  );

  // ── Mutations ─────────────────────────────────────────────────────────────
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
      toast({ title: "Access updated" });
    },
    onError: (err: Error) => toast({ title: "Error", description: parseErrorMessage(err), variant: "destructive" }),
  });

  const suspendCompanyMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/admin/companies/${id}/suspend`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies"] });
      toast({ title: "Company suspended" });
    },
    onError: (err: Error) => toast({ title: "Error", description: parseErrorMessage(err), variant: "destructive" }),
  });

  const reactivateCompanyMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/admin/companies/${id}/reactivate`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies"] });
      toast({ title: "Company reactivated" });
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

  const updateDemoStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/admin/demo-requests/${id}`, { status }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/demo-requests"] }),
    onError: (err: Error) => toast({ title: "Error", description: parseErrorMessage(err), variant: "destructive" }),
  });

  const revokeInviteMutation = useMutation({
    mutationFn: ({ id, type }: { id: string; type: string }) =>
      apiRequest("POST", `/api/admin/invites/${id}/revoke`, { type }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invites"] });
      toast({ title: "Invite revoked" });
    },
    onError: (err: Error) => toast({ title: "Error", description: parseErrorMessage(err), variant: "destructive" }),
  });

  const resendInviteMutation = useMutation({
    mutationFn: ({ id, type }: { id: string; type: string }) =>
      apiRequest("POST", `/api/admin/invites/${id}/resend`, { type }).then(r => r.json()),
    onSuccess: () => toast({ title: "Invite reminder sent" }),
    onError: (err: Error) => toast({ title: "Error", description: parseErrorMessage(err), variant: "destructive" }),
  });

  const updatePlatformSettingsMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiRequest("PATCH", "/api/admin/platform-settings", data).then(r => r.json()),
    onSuccess: () => {
      refetchPlatformSettings();
      toast({ title: "Settings saved" });
    },
    onError: (err: Error) => toast({ title: "Error", description: parseErrorMessage(err), variant: "destructive" }),
  });

  const sendPasswordResetMutation = useMutation({
    mutationFn: (userId: string) =>
      apiRequest("POST", `/api/admin/users/${userId}/send-password-reset`).then(r => r.json()),
    onSuccess: (data) => {
      toast({ title: "Password Reset Sent", description: data.message });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to Send Reset", description: parseErrorMessage(err), variant: "destructive" });
    },
  });

  const approveContractorMutation = useMutation({
    mutationFn: (contractorId: string) => api.approveContractor(contractorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contractors/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contractors"] });
      toast({ title: "Contractor Approved" });
    },
    onError: (error: Error) => toast({ title: "Approval Failed", description: parseErrorMessage(error), variant: "destructive" }),
  });

  const rejectContractorMutation = useMutation({
    mutationFn: (contractorId: string) => api.rejectContractor(contractorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contractors/pending"] });
      toast({ title: "Contractor Rejected" });
    },
    onError: (error: Error) => toast({ title: "Rejection Failed", description: parseErrorMessage(error), variant: "destructive" }),
  });

  const approveRequestMutation = useMutation({
    mutationFn: (requestId: string) => api.approveContractorRequest(requestId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contractor-requests/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contractors"] });
      toast({ title: "Request Approved", description: `Contractor account created. Temporary password: ${data.tempPassword}` });
    },
    onError: (error: Error) => toast({ title: "Approval Failed", description: parseErrorMessage(error), variant: "destructive" }),
  });

  const rejectRequestMutation = useMutation({
    mutationFn: (requestId: string) => api.rejectContractorRequest(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contractor-requests/pending"] });
      toast({ title: "Request Rejected" });
    },
    onError: (error: Error) => toast({ title: "Rejection Failed", description: parseErrorMessage(error), variant: "destructive" }),
  });

  const assignMutation = useMutation({
    mutationFn: ({ projectId, contractorId }: { projectId: string; contractorId: string }) =>
      api.assignContractor(projectId, contractorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/projects"] });
      toast({ title: "Contractor Assigned" });
      setAssignDialogOpen(false);
      setSelectedContractorId("");
    },
    onError: (error: Error) => toast({ title: "Assignment Failed", description: parseErrorMessage(error), variant: "destructive" }),
  });

  const initSandboxMutation = useMutation({
    mutationFn: () => api.initializeSandbox(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sandbox/data"] });
      toast({ title: "Sandbox Initialized" });
    },
    onError: (error: Error) => toast({ title: "Initialization Failed", description: parseErrorMessage(error), variant: "destructive" }),
  });

  const resetSandboxMutation = useMutation({
    mutationFn: () => api.resetSandbox(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sandbox/data"] });
      toast({ title: "Sandbox Reset" });
    },
    onError: (error: Error) => toast({ title: "Reset Failed", description: parseErrorMessage(error), variant: "destructive" }),
  });

  const saveRoleDefMutation = useMutation({
    mutationFn: (data: { name: string; type: string; permissions: Record<string, boolean> }) => {
      const url = editingRoleDef ? `/api/admin/role-definitions/${editingRoleDef.id}` : "/api/admin/role-definitions";
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

  // ── Helpers ───────────────────────────────────────────────────────────────
  const openCompanySubEdit = (company: AdminCompany) => {
    setEditingCompany(company);
    setCompanySubForm({ subscriptionPlan: company.subscriptionPlan || "free", subscriptionStatus: company.subscriptionStatus || "trialing" });
    setCompanySubDialogOpen(true);
  };

  const openTierCreate = () => {
    setEditingTier(null);
    setTierForm({ name: "", price: "0", maxProjects: "", features: "", sortOrder: "0", isActive: true });
    setTierDialogOpen(true);
  };

  const openTierEdit = (tier: SubscriptionTier) => {
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

  const convertLeadToCompany = (lead: DemoRequest) => {
    setCreateCompanyForm({
      companyName: lead.company || "",
      ownerName: lead.name || "",
      ownerEmail: lead.email || "",
      ownerUsername: "",
      password: "",
      companyType: "",
      subscriptionPlan: "free",
    });
    setCreateCompanyDialogOpen(true);
  };

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

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

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <header className="h-16 border-b bg-card px-6 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-heading font-bold text-xl text-foreground tracking-tight">BuildVision Admin</h1>
            <p className="text-xs text-muted-foreground">Platform Management</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/contractors">
            <Button variant="outline" size="sm" data-testid="btn-manage-contractors">
              <Users className="w-4 h-4 mr-2" />
              Users & Approvals
              {pendingTotal > 0 && (
                <Badge variant="secondary" className="ml-2 bg-orange-100 text-orange-700">
                  {pendingTotal}
                </Badge>
              )}
            </Button>
          </Link>
          <Badge variant="outline" className="border-green-600 text-green-600">Admin Mode</Badge>
          <ThemeToggle />
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="p-6 max-w-7xl mx-auto space-y-8">
        {/* ── Page title ── */}
        <div>
          <h2 className="text-2xl font-bold text-foreground">Dashboard Overview</h2>
          <p className="text-muted-foreground mt-1">Manage companies, users, demo requests, invites, and platform access.</p>
        </div>

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-100 rounded-lg">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Companies</p>
                  <h3 className="text-2xl font-bold">{companies.length}</h3>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-green-100 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Active Companies</p>
                  <h3 className="text-2xl font-bold">{activeCompanies.length}</h3>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-100 rounded-lg">
                  <CalendarCheck className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Demo Requests</p>
                  <h3 className="text-2xl font-bold">{newDemoRequests.length}</h3>
                </div>
              </div>
            </CardContent>
          </Card>
          <Link href="/admin/contractors">
            <Card className={`cursor-pointer hover:shadow-md transition-shadow ${pendingTotal > 0 ? "border-orange-300 bg-orange-50 dark:border-orange-700 dark:bg-orange-950/30" : ""}`}>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-lg ${pendingTotal > 0 ? "bg-orange-200 dark:bg-orange-900/40" : "bg-orange-100"}`}>
                    <Clock className={`w-5 h-5 ${pendingTotal > 0 ? "text-orange-700 dark:text-orange-400" : "text-orange-600"}`} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Pending Invites & Approvals</p>
                    <h3 className="text-2xl font-bold">{pendingTotal}</h3>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-100 rounded-lg">
                  <Users className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Users</p>
                  <h3 className="text-2xl font-bold">{allUsers.length}</h3>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Companies Section ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              Companies
            </h2>
            <Button size="sm" onClick={() => setCreateCompanyDialogOpen(true)} data-testid="button-create-company">
              <Plus className="w-4 h-4 mr-1" /> Create Company
            </Button>
          </div>
          {companies.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">No companies registered yet.</CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Monthly Price</TableHead>
                      <TableHead>Trial Ends</TableHead>
                      <TableHead className="text-center">Users</TableHead>
                      <TableHead className="text-center">Projects</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companies.map((company) => {
                      const trialStart = company.trialStartedAt ? new Date(company.trialStartedAt) : null;
                      const trialEnd = trialStart ? new Date(trialStart.getTime() + 7 * 24 * 60 * 60 * 1000) : null;
                      const now = new Date();
                      const isSuspended = company.subscriptionStatus === "suspended";
                      const isExpired = company.subscriptionStatus === "expired" || (company.subscriptionStatus === "trialing" && trialEnd && now > trialEnd);
                      return (
                        <TableRow key={company.id} data-testid={`company-row-${company.id}`}>
                          <TableCell className="font-medium">{company.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{company.ownerName || "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{company.companyType || "—"}</TableCell>
                          <TableCell>
                            <Badge
                              variant={company.subscriptionStatus === "active" ? "default" : isSuspended ? "destructive" : isExpired ? "destructive" : "secondary"}
                              className="capitalize text-xs"
                            >
                              {isSuspended ? "Suspended" : isExpired && company.subscriptionStatus !== "expired" ? "Expired" : company.subscriptionStatus}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize text-xs">{company.subscriptionPlan || "free"}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {(() => {
                              const tier = adminTiers.find(t =>
                                t.name.toLowerCase() === (company.subscriptionPlan || "free").toLowerCase()
                              );
                              const price = tier ? parseFloat(tier.price) : 0;
                              return price === 0 ? "Free" : `$${price % 1 === 0 ? price.toFixed(0) : price.toFixed(2)}/mo`;
                            })()}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {trialEnd ? trialEnd.toLocaleDateString() : "—"}
                          </TableCell>
                          <TableCell className="text-center text-sm">{company.userCount ?? 0}</TableCell>
                          <TableCell className="text-center text-sm">{company.projectCount ?? 0}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1.5 flex-wrap">
                              <Link href={`/admin/contractors?companyId=${company.id}`}>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  title="View company users"
                                  data-testid={`button-view-company-${company.id}`}
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </Button>
                              </Link>
                              {company.ownerUserId && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => sendPasswordResetMutation.mutate(company.ownerUserId!)}
                                  disabled={sendPasswordResetMutation.isPending || !company.ownerEmail}
                                  data-testid={`button-send-reset-${company.id}`}
                                  title={company.ownerEmail ? `Send password reset to ${company.ownerEmail}` : "Owner has no email"}
                                >
                                  <Mail className="w-3.5 h-3.5" />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openCompanySubEdit(company)}
                                data-testid={`button-edit-sub-${company.id}`}
                              >
                                <Pencil className="w-3.5 h-3.5 mr-1" />
                                Edit Access
                              </Button>
                              {isSuspended ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-green-600 border-green-300 hover:bg-green-50"
                                  onClick={() => reactivateCompanyMutation.mutate(company.id)}
                                  disabled={reactivateCompanyMutation.isPending}
                                  data-testid={`button-reactivate-${company.id}`}
                                >
                                  <PlayCircle className="w-3.5 h-3.5 mr-1" />
                                  Reactivate
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 border-red-200 hover:bg-red-50"
                                  onClick={() => suspendCompanyMutation.mutate(company.id)}
                                  disabled={suspendCompanyMutation.isPending}
                                  data-testid={`button-suspend-${company.id}`}
                                >
                                  <Ban className="w-3.5 h-3.5 mr-1" />
                                  Suspend
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </section>

        {/* ── Demo Requests / Leads Section ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-purple-600" />
              Demo Requests / Leads
            </h2>
            <Badge variant="secondary">{demoRequests.length} total</Badge>
          </div>
          {demoRequests.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                No demo requests yet. They'll appear here when submitted via the /demo page.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Message / Needs</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {demoRequests.map((lead) => (
                      <TableRow key={lead.id} data-testid={`demo-request-${lead.id}`}>
                        <TableCell className="font-medium whitespace-nowrap">{lead.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{lead.company || "—"}</TableCell>
                        <TableCell className="text-sm">
                          <a href={`mailto:${lead.email}`} className="text-blue-600 hover:underline">{lead.email}</a>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{lead.phone || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px]">
                          <span className="line-clamp-2">{lead.message || "—"}</span>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={lead.status}
                            onValueChange={(val) => updateDemoStatusMutation.mutate({ id: lead.id, status: val })}
                          >
                            <SelectTrigger className="w-[140px] h-7 text-xs" data-testid={`select-demo-status-${lead.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(DEMO_STATUS_LABELS).map(([val, { label }]) => (
                                <SelectItem key={val} value={val} className="text-xs">{label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {new Date(lead.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => convertLeadToCompany(lead)}
                              data-testid={`button-convert-lead-${lead.id}`}
                              title="Convert to Company"
                            >
                              <Building2 className="w-3.5 h-3.5 mr-1" />
                              Convert
                            </Button>
                            <a href={`mailto:${lead.email}?subject=Re: BuildVision Demo Request`}>
                              <Button size="sm" variant="ghost" title="Reply by email">
                                <Mail className="w-3.5 h-3.5" />
                              </Button>
                            </a>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </section>

        {/* ── Invite Status Section ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Link2 className="w-5 h-5 text-teal-600" />
              Invite Status
            </h2>
            <Badge variant="secondary">{adminInvites.length} total</Badge>
          </div>
          {adminInvites.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                No invites found across the platform.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invited Email</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sent At</TableHead>
                      <TableHead>Accepted At</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {adminInvites.map((inv, idx) => (
                      <TableRow key={`${inv.id}-${idx}`} data-testid={`invite-row-${inv.id}`}>
                        <TableCell className="text-sm font-medium">{inv.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize text-xs">{inv.inviteType}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{inv.companyName || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {inv.projectName || "—"}
                        </TableCell>
                        <TableCell><InviteStatusBadge status={inv.status} /></TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {new Date(inv.sentAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {inv.acceptedAt ? new Date(inv.acceptedAt).toLocaleDateString() : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {inv.expiresAt ? new Date(inv.expiresAt).toLocaleDateString() : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {inv.projectId && (
                              <Link href={`/projects/${inv.projectId}`}>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  title="View related project"
                                  data-testid={`button-view-project-${inv.id}`}
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </Button>
                              </Link>
                            )}
                            {inv.status === "pending" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-blue-600 hover:text-blue-700"
                                  onClick={() => resendInviteMutation.mutate({ id: inv.id, type: inv.inviteType })}
                                  disabled={resendInviteMutation.isPending}
                                  data-testid={`button-resend-invite-${inv.id}`}
                                  title="Resend invite"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-600 hover:text-red-700"
                                  onClick={() => revokeInviteMutation.mutate({ id: inv.id, type: inv.inviteType })}
                                  disabled={revokeInviteMutation.isPending}
                                  data-testid={`button-revoke-invite-${inv.id}`}
                                  title="Revoke invite"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </section>

        {/* ── Users & Approvals section ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Users className="w-5 h-5 text-violet-600" />
              Users & Approvals
            </h2>
            <Link href="/admin/contractors">
              <Button size="sm" variant="outline" data-testid="link-users-approvals">
                <Users className="w-4 h-4 mr-1" />
                Full User Management
                {pendingTotal > 0 && (
                  <Badge variant="secondary" className="ml-2 bg-orange-100 text-orange-700">{pendingTotal}</Badge>
                )}
              </Button>
            </Link>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allUsers.map((u) => (
                    <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
                      <TableCell className="font-medium">{u.name || u.username || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{u.email || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize text-xs">{u.role?.replace("_", " ") || "—"}</Badge>
                      </TableCell>
                      <TableCell>
                        {u.isApproved === false ? (
                          <Badge variant="secondary" className="bg-orange-100 text-orange-700 text-xs">Pending</Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => sendPasswordResetMutation.mutate(u.id)}
                          disabled={sendPasswordResetMutation.isPending || !u.email}
                          data-testid={`button-send-reset-user-${u.id}`}
                          title={u.email ? `Send password reset to ${u.email}` : "No email on file"}
                        >
                          <Mail className="w-3.5 h-3.5 mr-1" />
                          Send Reset
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {allUsers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No users found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>

        {/* ── Platform Projects section ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-blue-600" />
              Platform Projects
            </h2>
            <div className="relative w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search projects..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search-projects"
              />
            </div>
          </div>
          <Card>
            <CardContent className="p-0">
              {projectsLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredProjects.length === 0 ? (
                <p className="text-muted-foreground text-center py-10">No projects found</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Company</TableHead>
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
                        <TableCell className="text-sm text-muted-foreground">{project.companyName || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{project.clientName || "—"}</TableCell>
                        <TableCell>
                          {!project.contractorId ? (
                            <Badge variant="outline" className="border-amber-500 text-amber-600 text-xs">Unassigned</Badge>
                          ) : (
                            <span className="text-sm">{project.contractorName || "Assigned"}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={project.status === "completed" ? "secondary" : "default"}
                            className={`text-xs ${
                              project.status === "in_progress" ? "bg-blue-500" :
                              project.status === "active" ? "bg-green-500" :
                              project.status === "planning" ? "bg-purple-500" : ""
                            }`}
                          >
                            {project.status.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1.5">
                            <Link href={`/admin/project/${project.id}`}>
                              <Button size="sm" variant="ghost">
                                <Eye className="w-4 h-4" />
                              </Button>
                            </Link>
                            <Button size="sm" variant="outline" onClick={() => { setSelectedProject(project); setAssignDialogOpen(true); }}>
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
        </section>

        {/* ── Admin Tools section ── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Wrench className="w-5 h-5 text-gray-500" />
            <h2 className="text-xl font-bold text-foreground">Admin Tools</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left col: Budget + Financial */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-green-600" />
                    Budget Manager
                  </CardTitle>
                  <CardDescription>Manage pricing and budget templates</CardDescription>
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
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                    Financial Management
                  </CardTitle>
                  <CardDescription>Sales, estimates, and accounting</CardDescription>
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
            </div>

            {/* Middle col: Sandbox */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TestTube className="w-4 h-4 text-purple-600" />
                  Sandbox Testing
                </CardTitle>
                <CardDescription>Test features in an isolated environment</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {sandboxLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : !sandboxData?.project ? (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground text-sm mb-4">No sandbox data. Initialize to create test accounts.</p>
                    <Button
                      onClick={() => initSandboxMutation.mutate()}
                      disabled={initSandboxMutation.isPending}
                      className="w-full"
                    >
                      {initSandboxMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Initializing…</> : <><TestTube className="w-4 h-4 mr-2" />Initialize Sandbox</>}
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-3">
                      <p className="text-xs text-purple-700 dark:text-purple-300">
                        <strong>Test Client:</strong> {sandboxData.client?.name}<br />
                        <strong>Test Contractor:</strong> {sandboxData.contractor?.name}<br />
                        <strong>Test Project:</strong> {sandboxData.project.name}
                      </p>
                    </div>
                    <Link href="/admin/sandbox/dashboard">
                      <Button className="w-full justify-start" variant="outline" data-testid="button-sandbox-dashboard">
                        <LayoutDashboard className="w-4 h-4 mr-2" />
                        Client Dashboard
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-amber-600 border-amber-300 hover:bg-amber-50"
                      onClick={() => resetSandboxMutation.mutate()}
                      disabled={resetSandboxMutation.isPending}
                      data-testid="button-reset-sandbox"
                    >
                      {resetSandboxMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                      Reset Sandbox Data
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Right col: Role Definitions */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    Role Definitions
                  </CardTitle>
                  <Button size="sm" variant="ghost" onClick={openCreateRoleDef} data-testid="button-add-role-def">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <CardDescription>Team member role templates and permissions</CardDescription>
              </CardHeader>
              <CardContent>
                {roleDefs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No role definitions yet.</p>
                ) : (
                  <div className="space-y-2">
                    {roleDefs.map((def) => (
                      <div key={def.id} className="flex items-center justify-between py-2 px-3 rounded-lg border" data-testid={`role-def-${def.id}`}>
                        <div>
                          <p className="font-medium text-sm">{def.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{def.type}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => openEditRoleDef(def)} data-testid={`button-edit-role-${def.id}`}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          {!def.isDefault && (
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive w-7 h-7" onClick={() => deleteRoleDefMutation.mutate(def.id)} disabled={deleteRoleDefMutation.isPending} data-testid={`button-delete-role-${def.id}`}>
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
          </div>

          {/* Pricing & Access Settings */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-600" />
                Pricing & Access Settings
              </h3>
              <Button size="sm" onClick={openTierCreate} data-testid="button-add-tier">
                <Plus className="w-4 h-4 mr-1" /> Add Tier
              </Button>
            </div>

            {/* Global platform settings panel */}
            <Card className="mb-5">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-muted-foreground" />
                  Global Defaults
                </CardTitle>
                <CardDescription className="text-xs">Platform-wide defaults applied to new company signups.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="setting-trial-days" className="text-xs">Default Trial Length (days)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="setting-trial-days"
                        type="number"
                        min={1}
                        max={365}
                        defaultValue={platformSettingsData?.defaultTrialDays ?? 7}
                        className="h-8 text-sm w-20"
                        onBlur={e => updatePlatformSettingsMutation.mutate({ defaultTrialDays: parseInt(e.target.value) || 7 })}
                        data-testid="input-setting-trial-days"
                      />
                      <span className="text-xs text-muted-foreground">days</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="setting-default-price" className="text-xs">Default Monthly Price ($)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="setting-default-price"
                        type="number"
                        min={0}
                        step="0.01"
                        defaultValue={platformSettingsData?.defaultMonthlyPrice ?? "0"}
                        className="h-8 text-sm w-24"
                        onBlur={e => updatePlatformSettingsMutation.mutate({ defaultMonthlyPrice: e.target.value || "0" })}
                        data-testid="input-setting-default-price"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    <Label className="text-xs">Access Options</Label>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="setting-free-access"
                        checked={platformSettingsData?.freeAccessEnabled ?? false}
                        onCheckedChange={v => updatePlatformSettingsMutation.mutate({ freeAccessEnabled: v })}
                        data-testid="switch-setting-free-access"
                      />
                      <Label htmlFor="setting-free-access" className="text-xs font-normal cursor-pointer">Free Access Enabled</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="setting-prepaid-access"
                        checked={platformSettingsData?.prepaidAccessEnabled ?? false}
                        onCheckedChange={v => updatePlatformSettingsMutation.mutate({ prepaidAccessEnabled: v })}
                        data-testid="switch-setting-prepaid-access"
                      />
                      <Label htmlFor="setting-prepaid-access" className="text-xs font-normal cursor-pointer">Prepaid Access Enabled</Label>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    <Label className="text-xs">Billing Mode</Label>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="setting-manual-billing"
                        checked={platformSettingsData?.manualBillingEnabled ?? true}
                        onCheckedChange={v => updatePlatformSettingsMutation.mutate({ manualBillingEnabled: v })}
                        data-testid="switch-setting-manual-billing"
                      />
                      <Label htmlFor="setting-manual-billing" className="text-xs font-normal cursor-pointer">Manual Billing</Label>
                    </div>
                    <p className="text-xs text-muted-foreground">When on, billing is managed by admins. Turn off to enable self-serve.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <p className="text-sm font-medium text-foreground mb-3">Plan Tiers</p>
            {adminTiers.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground text-sm">
                  No plan tiers defined. Add tiers to show plans to company users.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {adminTiers.map((tier) => {
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
        </section>
      </main>

      {/* ─────────── DIALOGS ─────────── */}

      {/* Subscription Tier Create/Edit */}
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
                placeholder={"Unlimited projects\nPriority support\nTeam members"}
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

      {/* Company Access Edit Dialog */}
      <Dialog open={companySubDialogOpen} onOpenChange={setCompanySubDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Access</DialogTitle>
            <DialogDescription>Update plan and status for {editingCompany?.name}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Plan</Label>
              <Select value={companySubForm.subscriptionPlan} onValueChange={v => setCompanySubForm(f => ({ ...f, subscriptionPlan: v }))}>
                <SelectTrigger data-testid="select-company-plan"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  {adminTiers.map((t) => (
                    <SelectItem key={t.id} value={t.name.toLowerCase()}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={companySubForm.subscriptionStatus} onValueChange={v => setCompanySubForm(f => ({ ...f, subscriptionStatus: v }))}>
                <SelectTrigger data-testid="select-company-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="trialing">Trialing</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="past_due">Past Due</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
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
                <SelectTrigger id="role-type" data-testid="select-role-type"><SelectValue /></SelectTrigger>
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
              <Input id="cc-company-name" value={createCompanyForm.companyName} onChange={e => setCreateCompanyForm(f => ({ ...f, companyName: e.target.value }))} placeholder="Acme Construction" data-testid="input-create-company-name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cc-company-type">Company Type <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input id="cc-company-type" value={createCompanyForm.companyType} onChange={e => setCreateCompanyForm(f => ({ ...f, companyType: e.target.value }))} placeholder="General Contractor" data-testid="input-create-company-type" />
            </div>
            <div className="space-y-1.5">
              <Label>Subscription Plan</Label>
              <Select value={createCompanyForm.subscriptionPlan} onValueChange={v => setCreateCompanyForm(f => ({ ...f, subscriptionPlan: v }))}>
                <SelectTrigger data-testid="select-create-company-plan"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  {adminTiers.map((t) => (
                    <SelectItem key={t.id} value={t.name.toLowerCase()}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="border-t pt-3 space-y-3">
              <p className="text-sm font-medium text-foreground">Owner Account</p>
              <div className="space-y-1.5">
                <Label htmlFor="cc-owner-name">Full Name</Label>
                <Input id="cc-owner-name" value={createCompanyForm.ownerName} onChange={e => setCreateCompanyForm(f => ({ ...f, ownerName: e.target.value }))} placeholder="Jane Smith" data-testid="input-create-owner-name" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cc-owner-email">Email</Label>
                <Input id="cc-owner-email" type="email" value={createCompanyForm.ownerEmail} onChange={e => setCreateCompanyForm(f => ({ ...f, ownerEmail: e.target.value }))} placeholder="jane@acme.com" data-testid="input-create-owner-email" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cc-owner-username">Username</Label>
                <Input id="cc-owner-username" value={createCompanyForm.ownerUsername} onChange={e => setCreateCompanyForm(f => ({ ...f, ownerUsername: e.target.value }))} placeholder="janesmith" data-testid="input-create-owner-username" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cc-password">Password</Label>
                <Input id="cc-password" type="password" value={createCompanyForm.password} onChange={e => setCreateCompanyForm(f => ({ ...f, password: e.target.value }))} placeholder="Min. 6 characters" data-testid="input-create-owner-password" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setCreateCompanyDialogOpen(false); setCreateCompanyForm({ companyName: "", ownerName: "", ownerEmail: "", ownerUsername: "", password: "", companyType: "", subscriptionPlan: "free" }); }}>Cancel</Button>
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

      {/* Assign Contractor Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Contractor</DialogTitle>
            <DialogDescription>Select a contractor to assign to {selectedProject?.name}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedContractorId} onValueChange={setSelectedContractorId}>
              <SelectTrigger><SelectValue placeholder="Select a contractor" /></SelectTrigger>
              <SelectContent>
                {contractors.map((contractor) => (
                  <SelectItem key={contractor.id} value={contractor.id}>
                    {contractor.name || contractor.username} - {contractor.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => { if (selectedProject && selectedContractorId) assignMutation.mutate({ projectId: selectedProject.id, contractorId: selectedContractorId }); }}
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
