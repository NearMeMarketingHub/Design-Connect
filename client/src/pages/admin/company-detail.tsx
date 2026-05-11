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
  CalendarDays,
  CreditCard,
  StickyNote,
  Link2,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import { format, formatDistanceToNow, isValid } from "date-fns";

function safeFormat(value: string | Date | null | undefined, fmt: string, fallback = "—"): string {
  if (!value) return fallback;
  const d = value instanceof Date ? value : new Date(value);
  return isValid(d) ? format(d, fmt) : fallback;
}

function safeDistanceToNow(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  return isValid(d) ? formatDistanceToNow(d, { addSuffix: true }) : "";
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
  createdAt: string;
  dueDate: string | null;
}

interface CompanyInvite {
  id: string;
  email: string;
  role: string | null;
  status: string;
  projectId: string | null;
  createdAt: string;
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
  owner: CompanyUser | null;
  users: CompanyUser[];
  projects: CompanyProject[];
  invites: CompanyInvite[];
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

  const [billingForm, setBillingForm] = useState({
    billingType: "manual",
    monthlyPrice: "",
    trialEndsAt: "",
    prepaidThroughDate: "",
    billingNotes: "",
  });

  const [notesForm, setNotesForm] = useState({
    adminNotes: "",
  });

  const { data: company, isLoading } = useQuery<CompanyDetail>({
    queryKey: [`/api/admin/companies/${companyId}`],
    queryFn: () => apiRequest("GET", `/api/admin/companies/${companyId}`).then((r) => r.json()),
    enabled: !!companyId && user?.role === "admin",
  });

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiRequest("PATCH", `/api/admin/companies/${companyId}`, data).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/companies/${companyId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies"] });
      setEditingBilling(false);
      setEditingNotes(false);
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
      billingType: company.billingType ?? "manual",
      monthlyPrice: company.monthlyPrice ?? "",
      trialEndsAt: company.trialEndsAt ? company.trialEndsAt.slice(0, 10) : "",
      prepaidThroughDate: company.prepaidThroughDate ? company.prepaidThroughDate.slice(0, 10) : "",
      billingNotes: company.billingNotes ?? "",
    });
    setEditingBilling(true);
  }

  function saveBilling() {
    updateMutation.mutate({
      billingType: billingForm.billingType,
      monthlyPrice: billingForm.monthlyPrice || null,
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
        {/* Back link + header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <Link href="/admin/companies">
              <button
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-1"
                data-testid="link-back-companies"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Companies
              </button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground" data-testid="heading-company-name">
                  {company.name}
                </h1>
                <p className="text-sm text-muted-foreground">
                  Created {safeFormat(company.createdAt, "MMM d, yyyy")}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-6">
            {statusBadge(company.subscriptionStatus)}
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

        {/* Summary stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
                <Link2 className="w-3.5 h-3.5" /> Invites
              </div>
              <p className="text-2xl font-bold" data-testid="stat-invite-count">{company.invites.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <CreditCard className="w-3.5 h-3.5" /> Plan
              </div>
              <p className="text-sm font-semibold capitalize" data-testid="stat-plan">{company.subscriptionPlan ?? "free"}</p>
            </CardContent>
          </Card>
        </div>

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
            <div className="grid sm:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Owner</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {company.owner ? (
                    <>
                      <p className="font-medium" data-testid="owner-name">{company.owner.name || company.owner.username}</p>
                      <p className="text-sm text-muted-foreground" data-testid="owner-email">{company.owner.email ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">@{company.owner.username}</p>
                      <div className="flex gap-2 pt-1">
                        {company.owner.email && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => sendResetMutation.mutate(company.owner!.id)}
                            disabled={sendResetMutation.isPending}
                            data-testid="button-send-reset-owner"
                          >
                            <Mail className="w-3.5 h-3.5 mr-1" /> Send Password Reset
                          </Button>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No owner set</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Subscription</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span>{statusBadge(company.subscriptionStatus)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Plan</span>
                    <span className="font-medium capitalize">{company.subscriptionPlan ?? "free"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Trial started</span>
                    <span>{safeFormat(trialStart, "MMM d, yyyy")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Trial ends</span>
                    <span>{safeFormat(effectiveTrialEnd, "MMM d, yyyy")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Billing type</span>
                    <span className="capitalize">{company.billingType ?? "manual"}</span>
                  </div>
                  {company.monthlyPrice && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Monthly price</span>
                      <span>${parseFloat(company.monthlyPrice).toFixed(2)}/mo</span>
                    </div>
                  )}
                  {company.prepaidThroughDate && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Prepaid through</span>
                      <span>{safeFormat(company.prepaidThroughDate, "MMM d, yyyy")}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {company.billingNotes && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Billing Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap" data-testid="billing-notes-preview">{company.billingNotes}</p>
                </CardContent>
              </Card>
            )}
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
                      <TableHead>Joined</TableHead>
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
                        <TableCell className="text-sm text-muted-foreground">
                          {safeFormat(u.createdAt, "MMM d, yyyy")}
                        </TableCell>
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
                      <TableHead>Status</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Budget</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Created</TableHead>
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
                        <TableCell>
                          <Badge variant="outline" className="text-xs capitalize">
                            {p.status ?? "active"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {p.progress != null ? `${p.progress}%` : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {p.budget ? `$${parseFloat(p.budget).toLocaleString()}` : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {safeFormat(p.dueDate, "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {safeFormat(p.createdAt, "MMM d, yyyy")}
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
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Sent</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {company.invites.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No contractor invites found for this company.
                        </TableCell>
                      </TableRow>
                    )}
                    {company.invites.map((inv) => (
                      <TableRow key={inv.id} data-testid={`invite-row-${inv.id}`}>
                        <TableCell className="font-medium">{inv.email}</TableCell>
                        <TableCell className="text-sm text-muted-foreground capitalize">
                          {inv.role ?? "contractor"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {inviteStatusIcon(inv.status)}
                            <span className="text-xs capitalize">{inv.status}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {inv.expiresAt
                            ? `${safeFormat(inv.expiresAt, "MMM d, yyyy")} (${safeDistanceToNow(inv.expiresAt)})`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {safeFormat(inv.createdAt, "MMM d, yyyy")}
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
                        {company.prepaidThroughDate
                          ? safeFormat(company.prepaidThroughDate, "MMM d, yyyy")
                          : "—"}
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
              <CardContent>
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
                        <Save className="w-3.5 h-3.5 mr-1" /> Save
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
    </SuperAdminLayout>
  );
}
