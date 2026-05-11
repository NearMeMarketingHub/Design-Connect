import { useState } from "react";
import { useParams, Link } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { apiRequest, parseErrorMessage } from "@/lib/queryClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { SuperAdminLayout } from "@/components/super-admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2,
  ArrowLeft,
  Users,
  FolderOpen,
  Mail,
  Ban,
  PlayCircle,
  Pencil,
  Save,
  X,
  CreditCard,
  StickyNote,
  Link2,
  CheckCircle2,
  Clock,
  XCircle,
  ExternalLink,
  Info,
} from "lucide-react";
import { format, isValid } from "date-fns";

function safeFormat(value: string | Date | null | undefined, fmt: string, fallback = "—"): string {
  if (!value) return fallback;
  const d = value instanceof Date ? value : new Date(value);
  return isValid(d) ? format(d, fmt) : fallback;
}

interface CompanyUser {
  id: string;
  name: string | null;
  username: string;
  email: string | null;
  role: string;
  contractorType: string | null;
  isApproved: boolean;
  createdAt: string;
}

interface CompanyProject {
  id: string;
  name: string;
  status: string | null;
  progress: number | null;
  budget: string | null;
  createdAt: string | null;
  dueDate: string | null;
  clientName: string | null;
  contractorName: string | null;
}

interface CompanyInvite {
  id: string;
  email: string;
  contractorType: string | null;
  projectId: string | null;
  projectName: string | null;
  status: string;
  createdAt: string;
  acceptedAt: string | null;
  expiresAt: string | null;
}

interface CompanyDetail {
  id: string;
  name: string;
  logo: string | null;
  ownerId: string | null;
  subscriptionPlan: string | null;
  subscriptionStatus: string | null;
  trialStartedAt: string | null;
  billingType: string | null;
  monthlyPrice: string | null;
  trialEndsAt: string | null;
  prepaidThroughDate: string | null;
  billingNotes: string | null;
  adminNotes: string | null;
  createdAt: string;
  pendingInviteCount: number;
  owner: CompanyUser | null;
  users: CompanyUser[];
  projects: CompanyProject[];
  invites: CompanyInvite[];
}

interface SubscriptionTier {
  id: string;
  name: string;
  price: string;
  isActive: boolean;
}

function statusBadge(status: string | null | undefined) {
  const s = status ?? "trialing";
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    active: { label: "Active", variant: "default" },
    trialing: { label: "Trialing", variant: "secondary" },
    expired: { label: "Expired", variant: "destructive" },
    suspended: { label: "Suspended", variant: "destructive" },
    past_due: { label: "Past Due", variant: "destructive" },
    cancelled: { label: "Cancelled", variant: "outline" },
  };
  const info = map[s] ?? { label: s, variant: "outline" as const };
  return <Badge variant={info.variant} className="capitalize text-xs">{info.label}</Badge>;
}

function inviteStatusIcon(status: string) {
  if (status === "accepted") return <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />;
  if (status === "pending") return <Clock className="w-3.5 h-3.5 text-amber-500" />;
  return <XCircle className="w-3.5 h-3.5 text-red-400" />;
}

export default function AdminCompanyDetail() {
  const { companyId } = useParams<{ companyId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [editingBilling, setEditingBilling] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [editAccessOpen, setEditAccessOpen] = useState(false);

  const [billingForm, setBillingForm] = useState({
    subscriptionStatus: "trialing",
    subscriptionPlan: "free",
    billingType: "manual",
    monthlyPrice: "",
    trialStartedAt: "",
    trialEndsAt: "",
    prepaidThroughDate: "",
    billingNotes: "",
  });

  const [notesForm, setNotesForm] = useState({ adminNotes: "" });

  const [accessForm, setAccessForm] = useState({
    subscriptionPlan: "free",
    subscriptionStatus: "trialing",
  });

  const { data: company, isLoading } = useQuery<CompanyDetail>({
    queryKey: [`/api/admin/companies/${companyId}`],
    queryFn: () => apiRequest("GET", `/api/admin/companies/${companyId}`).then((r) => r.json()),
    enabled: !!companyId && user?.role === "admin",
  });

  const { data: adminTiers = [] } = useQuery<SubscriptionTier[]>({
    queryKey: ["/api/admin/subscription/tiers"],
    queryFn: () => apiRequest("GET", "/api/admin/subscription/tiers").then((r) => r.json()),
    enabled: user?.role === "admin",
  });

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiRequest("PATCH", `/api/admin/companies/${companyId}`, data).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/companies/${companyId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies"] });
      setEditingBilling(false);
      setEditingNotes(false);
      setEditAccessOpen(false);
      toast({ title: "Company updated" });
    },
    onError: (err: Error) =>
      toast({ title: "Error", description: parseErrorMessage(err), variant: "destructive" }),
  });

  const suspendMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/admin/companies/${companyId}/suspend`).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/companies/${companyId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies"] });
      toast({ title: "Company suspended" });
    },
    onError: (err: Error) =>
      toast({ title: "Error", description: parseErrorMessage(err), variant: "destructive" }),
  });

  const reactivateMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/admin/companies/${companyId}/reactivate`).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/companies/${companyId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies"] });
      toast({ title: "Company reactivated" });
    },
    onError: (err: Error) =>
      toast({ title: "Error", description: parseErrorMessage(err), variant: "destructive" }),
  });

  const sendResetMutation = useMutation({
    mutationFn: (userId: string) =>
      apiRequest("POST", `/api/admin/users/${userId}/send-password-reset`).then((r) => r.json()),
    onSuccess: (data) => toast({ title: "Password Reset Sent", description: data.message }),
    onError: (err: Error) =>
      toast({ title: "Failed", description: parseErrorMessage(err), variant: "destructive" }),
  });

  function openBillingEdit() {
    if (!company) return;
    setBillingForm({
      subscriptionStatus: company.subscriptionStatus ?? "trialing",
      subscriptionPlan: company.subscriptionPlan ?? "free",
      billingType: company.billingType ?? "manual",
      monthlyPrice: company.monthlyPrice ?? "",
      trialStartedAt: company.trialStartedAt ? company.trialStartedAt.slice(0, 10) : "",
      trialEndsAt: company.trialEndsAt ? company.trialEndsAt.slice(0, 10) : "",
      prepaidThroughDate: company.prepaidThroughDate ? company.prepaidThroughDate.slice(0, 10) : "",
      billingNotes: company.billingNotes ?? "",
    });
    setEditingBilling(true);
  }

  function saveBilling() {
    updateMutation.mutate({
      subscriptionStatus: billingForm.subscriptionStatus,
      subscriptionPlan: billingForm.subscriptionPlan,
      billingType: billingForm.billingType,
      monthlyPrice: billingForm.monthlyPrice || null,
      trialStartedAt: billingForm.trialStartedAt ? new Date(billingForm.trialStartedAt).toISOString() : null,
      trialEndsAt: billingForm.trialEndsAt ? new Date(billingForm.trialEndsAt).toISOString() : null,
      prepaidThroughDate: billingForm.prepaidThroughDate ? new Date(billingForm.prepaidThroughDate).toISOString() : null,
      billingNotes: billingForm.billingNotes || null,
    });
  }

  function openNotesEdit() {
    if (!company) return;
    setNotesForm({ adminNotes: company.adminNotes ?? "" });
    setEditingNotes(true);
  }

  function saveNotes() {
    updateMutation.mutate({ adminNotes: notesForm.adminNotes || null });
  }

  function openEditAccess() {
    if (!company) return;
    setAccessForm({
      subscriptionPlan: company.subscriptionPlan ?? "free",
      subscriptionStatus: company.subscriptionStatus ?? "trialing",
    });
    setEditAccessOpen(true);
  }

  function saveAccess() {
    updateMutation.mutate({
      subscriptionPlan: accessForm.subscriptionPlan,
      subscriptionStatus: accessForm.subscriptionStatus,
    });
  }

  if (isLoading || !company) {
    return (
      <SuperAdminLayout>
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          {isLoading ? "Loading…" : "Company not found."}
        </div>
      </SuperAdminLayout>
    );
  }

  const isSuspended = company.subscriptionStatus === "suspended";
  const trialStart = company.trialStartedAt ? new Date(company.trialStartedAt) : null;
  const computedTrialEnd = trialStart ? new Date(trialStart.getTime() + 7 * 24 * 60 * 60 * 1000) : null;
  const effectiveTrialEnd = company.trialEndsAt ? new Date(company.trialEndsAt) : computedTrialEnd;

  return (
    <SuperAdminLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Back link */}
        <Link href="/admin/companies">
          <button
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            data-testid="link-back-companies"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Companies
          </button>
        </Link>

        {/* Header card */}
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              {/* Left: identity */}
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl font-bold text-foreground" data-testid="heading-company-name">
                      {company.name}
                    </h1>
                    {statusBadge(company.subscriptionStatus)}
                  </div>
                  {company.owner && (
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{company.owner.name || company.owner.username}</span>
                      {company.owner.email && <span> · {company.owner.email}</span>}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground pt-1">
                    <span>Plan: <span className="capitalize font-medium text-foreground">{company.subscriptionPlan ?? "free"}</span></span>
                    <span>Billing: <span className="capitalize font-medium text-foreground">{company.billingType ?? "manual"}</span></span>
                    {company.monthlyPrice && (
                      <span>Price: <span className="font-medium text-foreground">${parseFloat(company.monthlyPrice).toFixed(2)}/mo</span></span>
                    )}
                    {effectiveTrialEnd && (
                      <span>Trial ends: <span className="font-medium text-foreground">{safeFormat(effectiveTrialEnd, "MMM d, yyyy")}</span></span>
                    )}
                    <span>Created: <span className="font-medium text-foreground">{safeFormat(company.createdAt, "MMM d, yyyy")}</span></span>
                  </div>
                </div>
              </div>

              {/* Right: quick actions */}
              <div className="flex flex-wrap gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={openEditAccess}
                  data-testid="button-edit-access"
                >
                  <Pencil className="w-3.5 h-3.5 mr-1" /> Edit Access
                </Button>
                {company.owner?.email && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => sendResetMutation.mutate(company.owner!.id)}
                    disabled={sendResetMutation.isPending}
                    data-testid="button-send-reset-header"
                    title={`Send password reset to ${company.owner.email}`}
                  >
                    <Mail className="w-3.5 h-3.5 mr-1" /> Password Reset
                  </Button>
                )}
                {isSuspended ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-green-600 border-green-300 hover:bg-green-50"
                    onClick={() => reactivateMutation.mutate()}
                    disabled={reactivateMutation.isPending}
                    data-testid="button-reactivate"
                  >
                    <PlayCircle className="w-3.5 h-3.5 mr-1" /> Reactivate
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => suspendMutation.mutate()}
                    disabled={suspendMutation.isPending}
                    data-testid="button-suspend"
                  >
                    <Ban className="w-3.5 h-3.5 mr-1" /> Suspend
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="overview">
          <TabsList className="flex-wrap h-auto gap-1" data-testid="company-detail-tabs">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="users" data-testid="tab-users">
              Users <span className="ml-1 text-xs opacity-60">({company.users.length})</span>
            </TabsTrigger>
            <TabsTrigger value="projects" data-testid="tab-projects">
              Projects <span className="ml-1 text-xs opacity-60">({company.projects.length})</span>
            </TabsTrigger>
            <TabsTrigger value="invites" data-testid="tab-invites">
              Invites <span className="ml-1 text-xs opacity-60">({company.invites.length})</span>
            </TabsTrigger>
            <TabsTrigger value="billing" data-testid="tab-billing">Billing & Access</TabsTrigger>
            <TabsTrigger value="notes" data-testid="tab-notes">Notes</TabsTrigger>
          </TabsList>

          {/* ── Overview ── */}
          <TabsContent value="overview" className="mt-4 space-y-4">
            {/* Stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <Users className="w-3.5 h-3.5" /> Users
                  </div>
                  <p className="text-2xl font-bold" data-testid="stat-user-count">{company.users.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <FolderOpen className="w-3.5 h-3.5" /> Projects
                  </div>
                  <p className="text-2xl font-bold" data-testid="stat-project-count">{company.projects.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <Link2 className="w-3.5 h-3.5" /> Pending Invites
                  </div>
                  <p className="text-2xl font-bold" data-testid="stat-pending-invite-count">{company.pendingInviteCount}</p>
                </CardContent>
              </Card>
            </div>

            {/* Two-column info */}
            <div className="grid sm:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Company Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-medium" data-testid="info-company-name">{company.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created</span>
                    <span>{safeFormat(company.createdAt, "MMM d, yyyy")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Plan</span>
                    <span className="capitalize font-medium">{company.subscriptionPlan ?? "free"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span>{statusBadge(company.subscriptionStatus)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Billing type</span>
                    <span className="capitalize">{company.billingType ?? "manual"}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Owner Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {company.owner ? (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Name</span>
                        <span className="font-medium" data-testid="owner-name">{company.owner.name || company.owner.username}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Email</span>
                        <span data-testid="owner-email">{company.owner.email ?? "—"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Username</span>
                        <span>@{company.owner.username}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status</span>
                        <span>
                          {company.owner.isApproved
                            ? <Badge variant="default" className="text-xs">Approved</Badge>
                            : <Badge variant="secondary" className="text-xs">Pending</Badge>}
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="text-muted-foreground text-sm">No owner set for this company.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity placeholder */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground italic" data-testid="recent-activity-placeholder">
                  No activity logged yet.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Users ── */}
          <TabsContent value="users" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {company.users.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No users found for this company.
                        </TableCell>
                      </TableRow>
                    )}
                    {company.users.map((u) => (
                      <TableRow key={u.id} data-testid={`user-row-${u.id}`}>
                        <TableCell className="font-medium">{u.name || u.username}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{u.email ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs capitalize">
                            {u.role}{u.contractorType ? ` · ${u.contractorType}` : ""}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {u.isApproved ? (
                            <Badge variant="default" className="text-xs">Approved</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Pending</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">—</TableCell>
                        <TableCell className="text-right">
                          {u.email && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => sendResetMutation.mutate(u.id)}
                              disabled={sendResetMutation.isPending}
                              data-testid={`button-send-reset-user-${u.id}`}
                              title={`Send password reset to ${u.email}`}
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Projects ── */}
          <TabsContent value="projects" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Contractor / Owner</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {company.projects.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No projects found for this company.
                        </TableCell>
                      </TableRow>
                    )}
                    {company.projects.map((p) => (
                      <TableRow key={p.id} data-testid={`project-row-${p.id}`}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{p.clientName ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{p.contractorName ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs capitalize">
                            {p.status ?? "active"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {safeFormat(p.createdAt, "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/admin/project/${p.id}`}>
                            <Button size="sm" variant="outline" data-testid={`button-view-project-${p.id}`}>
                              <ExternalLink className="w-3.5 h-3.5 mr-1" /> View
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Invites ── */}
          <TabsContent value="invites" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sent</TableHead>
                      <TableHead>Accepted</TableHead>
                      <TableHead>Expires</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {company.invites.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No contractor invites found for this company.
                        </TableCell>
                      </TableRow>
                    )}
                    {company.invites.map((inv) => (
                      <TableRow key={inv.id} data-testid={`invite-row-${inv.id}`}>
                        <TableCell className="font-medium text-sm">{inv.email}</TableCell>
                        <TableCell className="text-sm text-muted-foreground capitalize">
                          {inv.contractorType ?? "contractor"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {inv.projectName ?? (inv.projectId ? "Unknown project" : "—")}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {inviteStatusIcon(inv.status)}
                            <span className="text-xs capitalize">{inv.status}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {safeFormat(inv.createdAt, "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {safeFormat(inv.acceptedAt, "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {safeFormat(inv.expiresAt, "MMM d, yyyy")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Billing & Access ── */}
          <TabsContent value="billing" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <CreditCard className="w-4 h-4" /> Billing & Access
                </CardTitle>
                {!editingBilling && (
                  <Button size="sm" variant="outline" onClick={openBillingEdit} data-testid="button-edit-billing">
                    <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {editingBilling ? (
                  <div className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>Access Status</Label>
                        <Select
                          value={billingForm.subscriptionStatus}
                          onValueChange={(v) => setBillingForm((f) => ({ ...f, subscriptionStatus: v }))}
                        >
                          <SelectTrigger data-testid="select-access-status">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {["trialing", "active", "expired", "past_due", "cancelled", "suspended"].map(s => (
                              <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Plan</Label>
                        <Select
                          value={billingForm.subscriptionPlan}
                          onValueChange={(v) => setBillingForm((f) => ({ ...f, subscriptionPlan: v }))}
                        >
                          <SelectTrigger data-testid="select-billing-plan">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="free">Free</SelectItem>
                            {adminTiers.map(t => (
                              <SelectItem key={t.id} value={t.name.toLowerCase()}>{t.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Billing Type</Label>
                        <Select
                          value={billingForm.billingType}
                          onValueChange={(v) => setBillingForm((f) => ({ ...f, billingType: v }))}
                        >
                          <SelectTrigger data-testid="select-billing-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="manual">Manual</SelectItem>
                            <SelectItem value="free">Free</SelectItem>
                            <SelectItem value="prepaid">Prepaid</SelectItem>
                            <SelectItem value="future_in_app">Future In-App</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Monthly Price Override ($)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Leave blank to use tier price"
                          value={billingForm.monthlyPrice}
                          onChange={(e) => setBillingForm((f) => ({ ...f, monthlyPrice: e.target.value }))}
                          data-testid="input-monthly-price"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Trial Start Date</Label>
                        <Input
                          type="date"
                          value={billingForm.trialStartedAt}
                          onChange={(e) => setBillingForm((f) => ({ ...f, trialStartedAt: e.target.value }))}
                          data-testid="input-trial-started-at"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Trial End Date Override</Label>
                        <Input
                          type="date"
                          value={billingForm.trialEndsAt}
                          onChange={(e) => setBillingForm((f) => ({ ...f, trialEndsAt: e.target.value }))}
                          data-testid="input-trial-ends-at"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Prepaid Through Date</Label>
                        <Input
                          type="date"
                          value={billingForm.prepaidThroughDate}
                          onChange={(e) => setBillingForm((f) => ({ ...f, prepaidThroughDate: e.target.value }))}
                          data-testid="input-prepaid-through"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Billing Notes</Label>
                      <Textarea
                        placeholder="Internal notes about billing arrangement…"
                        value={billingForm.billingNotes}
                        onChange={(e) => setBillingForm((f) => ({ ...f, billingNotes: e.target.value }))}
                        rows={3}
                        data-testid="textarea-billing-notes"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={saveBilling}
                        disabled={updateMutation.isPending}
                        data-testid="button-save-billing"
                      >
                        <Save className="w-3.5 h-3.5 mr-1" /> Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingBilling(false)}
                        data-testid="button-cancel-billing"
                      >
                        <X className="w-3.5 h-3.5 mr-1" /> Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                    <div>
                      <dt className="text-muted-foreground text-xs mb-0.5">Access Status</dt>
                      <dd data-testid="display-access-status">{statusBadge(company.subscriptionStatus)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground text-xs mb-0.5">Plan</dt>
                      <dd className="font-medium capitalize" data-testid="display-plan">{company.subscriptionPlan ?? "free"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground text-xs mb-0.5">Billing Type</dt>
                      <dd className="font-medium capitalize" data-testid="display-billing-type">
                        {company.billingType ?? "manual"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground text-xs mb-0.5">Monthly Price</dt>
                      <dd className="font-medium" data-testid="display-monthly-price">
                        {company.monthlyPrice
                          ? `$${parseFloat(company.monthlyPrice).toFixed(2)}/mo`
                          : "— (use tier price)"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground text-xs mb-0.5">Trial Start</dt>
                      <dd className="font-medium" data-testid="display-trial-started-at">
                        {safeFormat(company.trialStartedAt, "MMM d, yyyy")}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground text-xs mb-0.5">Trial End Override</dt>
                      <dd className="font-medium" data-testid="display-trial-ends-at">
                        {company.trialEndsAt
                          ? safeFormat(company.trialEndsAt, "MMM d, yyyy")
                          : "— (auto from start date)"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground text-xs mb-0.5">Prepaid Through</dt>
                      <dd className="font-medium" data-testid="display-prepaid-through">
                        {safeFormat(company.prepaidThroughDate, "MMM d, yyyy")}
                      </dd>
                    </div>
                    {company.billingNotes && (
                      <div className="sm:col-span-2">
                        <dt className="text-muted-foreground text-xs mb-0.5">Billing Notes</dt>
                        <dd className="whitespace-pre-wrap" data-testid="display-billing-notes">
                          {company.billingNotes}
                        </dd>
                      </div>
                    )}
                  </dl>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Notes ── */}
          <TabsContent value="notes" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <StickyNote className="w-4 h-4" /> Admin Notes
                </CardTitle>
                {!editingNotes && (
                  <Button size="sm" variant="outline" onClick={openNotesEdit} data-testid="button-edit-notes">
                    <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Internal-only callout */}
                <div className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>These notes are internal only and are never visible to the company or their clients.</span>
                </div>

                {editingNotes ? (
                  <div className="space-y-3">
                    <Textarea
                      placeholder="Internal notes visible only to admins…"
                      value={notesForm.adminNotes}
                      onChange={(e) => setNotesForm({ adminNotes: e.target.value })}
                      rows={8}
                      data-testid="textarea-admin-notes"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={saveNotes}
                        disabled={updateMutation.isPending}
                        data-testid="button-save-notes"
                      >
                        <Save className="w-3.5 h-3.5 mr-1" /> Save Notes
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingNotes(false)}
                        data-testid="button-cancel-notes"
                      >
                        <X className="w-3.5 h-3.5 mr-1" /> Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {company.adminNotes ? (
                      <p className="text-sm whitespace-pre-wrap" data-testid="display-admin-notes">
                        {company.adminNotes}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic" data-testid="display-admin-notes-empty">
                        No admin notes yet. Click Edit to add notes about this company.
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Access Dialog (plan + status quick-edit from header) */}
      <Dialog open={editAccessOpen} onOpenChange={setEditAccessOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Access</DialogTitle>
            <DialogDescription>Update plan and status for {company.name}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Plan</Label>
              <Select
                value={accessForm.subscriptionPlan}
                onValueChange={(v) => setAccessForm((f) => ({ ...f, subscriptionPlan: v }))}
              >
                <SelectTrigger data-testid="select-access-plan">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  {adminTiers.map(t => (
                    <SelectItem key={t.id} value={t.name.toLowerCase()}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={accessForm.subscriptionStatus}
                onValueChange={(v) => setAccessForm((f) => ({ ...f, subscriptionStatus: v }))}
              >
                <SelectTrigger data-testid="select-access-status-dialog">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["trialing", "active", "expired", "past_due", "cancelled", "suspended"].map(s => (
                    <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAccessOpen(false)}>Cancel</Button>
            <Button onClick={saveAccess} disabled={updateMutation.isPending} data-testid="button-save-access">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SuperAdminLayout>
  );
}
