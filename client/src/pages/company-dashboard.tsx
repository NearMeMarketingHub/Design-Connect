import { useState, useEffect } from "react";
import { useConfirm } from "@/hooks/use-confirm";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { 
  Building2, Users, CreditCard, Settings, Plus, Mail, Trash2,
  CheckCircle, Clock, Crown, Wrench, FileText, UserPlus, ChevronRight,
  RefreshCw, AlertCircle, ShieldCheck, AlertTriangle,
  DollarSign
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { parseErrorMessage, apiRequest } from "@/lib/queryClient";

const SUBCONTRACTOR_SPECIALTIES = [
  "Plumber", "Electrician", "HVAC Technician", "Roofer", "Carpenter",
  "Painter", "Flooring Specialist", "Mason", "Landscaper", "General Labor"
];

export default function CompanyDashboard() {
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { confirm, ConfirmDialog } = useConfirm();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", contractorType: "contractor", specialty: "", projectId: "" });
  const [activeTab, setActiveTab] = useState(() =>
    location === "/company/team" ? "team" : "overview"
  );

  useEffect(() => {
    if (location === "/company/team") {
      setActiveTab("team");
    } else if (location === "/company/dashboard") {
      setActiveTab("overview");
    }
  }, [location]);

  const { data: company, isLoading: companyLoading, isError: companyError } = useQuery({
    queryKey: ["/api/company/mine"],
    queryFn: () => apiRequest("GET", "/api/company/mine").then(r => r.json()),
    enabled: user?.role === "company_owner" || user?.isCompanyAdmin === true,
  });

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ["/api/company/members", company?.id],
    queryFn: () => apiRequest("GET", `/api/company/${company.id}/members`).then(r => r.json()),
    enabled: !!company?.id,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["/api/projects"],
    queryFn: () => apiRequest("GET", "/api/projects").then(r => r.json()),
  });

  const { data: roleDefs = [] } = useQuery({
    queryKey: ["/api/role-definitions"],
    queryFn: async () => {
      const res = await fetch("/api/role-definitions", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!company?.id,
  });

  // Stripe config — company_owner and non-sub/notary admins only
  const isOwnerOrCompanyAdmin =
    user?.role === "company_owner" ||
    (user?.role === "contractor" && user?.isCompanyAdmin &&
      user?.contractorType !== "subcontractor" && user?.contractorType !== "notary");

  const { data: stripeConfig } = useQuery({
    queryKey: ["/api/stripe/config"],
    queryFn: async () => {
      const res = await fetch("/api/stripe/config", { credentials: "include" });
      if (!res.ok) return { configured: false, publishableKey: null };
      return res.json() as Promise<{ configured: boolean; publishableKey: string | null }>;
    },
    enabled: !!isOwnerOrCompanyAdmin,
  });

  // Local billing display-state helper (mirrors server/stripeBillingStatus.ts logic).
  // Kept client-side only — never imports from server/.
  const getStripeBillingDisplay = () => {
    const paymentStatus = company?.stripePaymentStatus ?? null;
    const graceEnd = company?.stripeGraceEndsAt ? new Date(company.stripeGraceEndsAt) : null;
    const inGracePeriod = !!graceEnd && graceEnd > new Date();

    if (paymentStatus === "past_due" && inGracePeriod) {
      return { label: "Past Due / Grace Period", color: "text-orange-600" };
    }
    if (paymentStatus === "past_due") {
      return { label: "Past Due", color: "text-destructive" };
    }
    if (paymentStatus === "unpaid") {
      return { label: "Unpaid", color: "text-destructive" };
    }
    if (paymentStatus === "action_required") {
      return { label: "Payment Action Required", color: "text-orange-600" };
    }
    if (paymentStatus === "current") {
      return { label: "Payment Current", color: "text-green-600" };
    }
    return null;
  };
  const stripeBillingDisplay = getStripeBillingDisplay();

  const ACTIVE_STATUSES = ["active", "prepaid", "free"] as const;
  const BLOCKED_STATUSES = ["suspended", "cancelled", "expired", "trialing"] as const;
  const STATUS_LABEL: Record<string, string> = {
    active:    "Active",
    prepaid:   "Prepaid",
    free:      "Free",
    suspended: "Suspended",
    cancelled: "Cancelled",
    expired:   "Expired",
    trialing:  "Blocked (legacy)",
    past_due:  "Blocked (legacy)",
  };
  const subscriptionStatus = company?.subscriptionStatus ?? "";
  const isActive = (ACTIVE_STATUSES as readonly string[]).includes(subscriptionStatus);
  const isBlocked = (BLOCKED_STATUSES as readonly string[]).includes(subscriptionStatus);

  const inviteMutation = useMutation({
    mutationFn: async (data: { email: string; contractorType: string; specialty?: string; projectId?: string }) => {
      const res = await fetch("/api/contractor-invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: data.email,
          companyId: company?.id,
          contractorType: data.contractorType,
          subcontractorSpecialty: data.specialty || null,
          projectId: data.projectId || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to send invite");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Invite sent!", description: `Invitation sent to ${inviteForm.email}` });
      setInviteOpen(false);
      setInviteForm({ email: "", contractorType: "contractor", specialty: "", projectId: "" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: parseErrorMessage(err), variant: "destructive" });
    },
  });

  const assignRoleMutation = useMutation({
    mutationFn: async ({ userId, roleDefinitionId }: { userId: string; roleDefinitionId: string | null }) => {
      const res = await fetch(`/api/company/${company?.id}/members/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ roleDefinitionId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to assign role");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/members"] });
      toast({ title: "Role assigned" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: parseErrorMessage(err), variant: "destructive" });
    },
  });

  const toggleAdminMutation = useMutation({
    mutationFn: async ({ userId, isCompanyAdmin }: { userId: string; isCompanyAdmin: boolean }) => {
      const res = await fetch(`/api/company/${company?.id}/members/${userId}/admin`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isCompanyAdmin }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to update admin status");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/members"] });
      toast({ title: "Admin status updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: parseErrorMessage(err), variant: "destructive" });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("DELETE", `/api/company/${company?.id}/members/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/members"] });
      toast({ title: "Member removed" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: parseErrorMessage(err), variant: "destructive" });
    },
  });

  const activeProjects = projects.filter((p: any) => p.status !== "completed");
  const completedProjects = projects.filter((p: any) => p.status === "completed");

  if (companyLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (companyError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <AlertCircle className="w-10 h-10 text-destructive" />
        <div>
          <p className="font-semibold text-lg">Failed to load company data</p>
          <p className="text-muted-foreground text-sm mt-1">There was a problem connecting to the server. Please refresh the page.</p>
        </div>
      </div>
    );
  }

  if (!company && user?.role === "company_owner") {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="w-10 h-10 text-muted-foreground" />
        <p className="text-muted-foreground">No company found for your account.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Blocked access notice */}
      {isBlocked && (
        <div
          className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 flex items-center gap-3"
          data-testid="blocked-access-banner"
        >
          <AlertTriangle className="w-5 h-5 shrink-0 text-destructive" />
          <p className="text-sm font-medium text-destructive">
            Your company access is not active. Please contact support to update your Billing &amp; Access status.
          </p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold" data-testid="company-name">{company?.name || "My Company"}</h1>
          <p className="text-muted-foreground mt-1">Manage your company, team, and billing</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant={isActive ? "default" : isBlocked ? "destructive" : "secondary"}
            className="capitalize"
            data-testid="subscription-status"
          >
            {(STATUS_LABEL[subscriptionStatus] ?? subscriptionStatus) || "—"}
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList data-testid="company-tabs">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="team" data-testid="tab-team">Team</TabsTrigger>
          <TabsTrigger value="subscription" data-testid="tab-subscription">Billing & Access</TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">Settings</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card data-testid="card-active-projects">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Active Projects</p>
                    <p className="text-3xl font-bold mt-1">{activeProjects.length}</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <FileText className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card data-testid="card-team-members">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Team Members</p>
                    <p className="text-3xl font-bold mt-1">{members.length + 1}</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <Users className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card data-testid="card-completed-projects">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Completed Projects</p>
                    <p className="text-3xl font-bold mt-1">{completedProjects.length}</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Projects */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Projects</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate("/contractor/projects")} data-testid="button-view-all-projects">
                  View All <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {projects.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p>No projects yet.</p>
                  <Button className="mt-3" onClick={() => navigate("/contractor/new-project")} data-testid="button-create-project">
                    Create First Project
                  </Button>
                </div>
              ) : (
                <div className="divide-y">
                  {projects.slice(0, 5).map((project: any) => (
                    <div
                      key={project.id}
                      className="py-3 flex items-center justify-between hover:bg-muted/30 cursor-pointer px-2 rounded"
                      onClick={() => navigate(`/contractor/project/${project.id}`)}
                      data-testid={`project-row-${project.id}`}
                    >
                      <div>
                        <p className="font-medium">{project.name}</p>
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
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Team Members</h2>
              <p className="text-muted-foreground text-sm">Manage your company team and subcontractors</p>
            </div>
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-invite-member">
                  <UserPlus className="w-4 h-4 mr-2" /> Invite Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite Team Member</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div>
                    <Label>Email Address</Label>
                    <Input
                      type="email"
                      placeholder="team@example.com"
                      value={inviteForm.email}
                      onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
                      data-testid="input-invite-email"
                    />
                  </div>
                  <div>
                    <Label>Role Type</Label>
                    <Select
                      value={inviteForm.contractorType}
                      onValueChange={v => setInviteForm(f => ({ ...f, contractorType: v }))}
                    >
                      <SelectTrigger data-testid="select-contractor-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="contractor">Contractor (Team Member)</SelectItem>
                        <SelectItem value="notary">Notary</SelectItem>
                        <SelectItem value="subcontractor">Subcontractor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {inviteForm.contractorType === "subcontractor" && (
                    <>
                      <div>
                        <Label>Trade Specialty</Label>
                        <Select
                          value={inviteForm.specialty}
                          onValueChange={v => setInviteForm(f => ({ ...f, specialty: v }))}
                        >
                          <SelectTrigger data-testid="select-specialty">
                            <SelectValue placeholder="Select specialty..." />
                          </SelectTrigger>
                          <SelectContent>
                            {SUBCONTRACTOR_SPECIALTIES.map(s => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Assign to Project <span className="text-muted-foreground text-xs">(optional)</span></Label>
                        <Select
                          value={inviteForm.projectId}
                          onValueChange={v => setInviteForm(f => ({ ...f, projectId: v === "_none" ? "" : v }))}
                        >
                          <SelectTrigger data-testid="select-project">
                            <SelectValue placeholder="Select project..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">No specific project</SelectItem>
                            {projects.map((p: any) => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
                  <Button
                    onClick={() => inviteMutation.mutate({
                      email: inviteForm.email,
                      contractorType: inviteForm.contractorType,
                      specialty: inviteForm.specialty,
                      projectId: inviteForm.projectId || undefined,
                    })}
                    disabled={!inviteForm.email || inviteMutation.isPending}
                    data-testid="button-send-invite"
                  >
                    {inviteMutation.isPending ? "Sending..." : "Send Invite"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Owner card */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-primary/5 border border-primary/10">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
                      <Crown className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{user?.name || user?.username}</p>
                      <p className="text-xs text-muted-foreground">{user?.email}</p>
                    </div>
                  </div>
                  <Badge>Company Owner</Badge>
                </div>

                {membersLoading ? (
                  <div className="text-center py-4 text-muted-foreground text-sm">Loading members...</div>
                ) : members.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No team members yet. Invite your first member above.</p>
                  </div>
                ) : (
                  members.map((member: any) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/30"
                      data-testid={`member-row-${member.userId}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                          <Wrench className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">{member.user?.name || member.user?.username || "Unknown"}</p>
                          <p className="text-xs text-muted-foreground">
                            {member.user?.contractorType === "notary" ? "Notary" : 
                             member.user?.contractorType === "subcontractor" 
                               ? `Subcontractor · ${member.user?.subcontractorSpecialty || "General"}`
                               : "Contractor"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {roleDefs.length > 0 && (
                          <Select
                            value={member.roleDefinitionId || "_none"}
                            onValueChange={v => assignRoleMutation.mutate({ userId: member.userId, roleDefinitionId: v === "_none" ? null : v })}
                          >
                            <SelectTrigger className="h-7 w-32 text-xs" data-testid={`select-role-${member.userId}`}>
                              <SelectValue placeholder="Assign role..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_none">No role</SelectItem>
                              {roleDefs.map((rd: any) => (
                                <SelectItem key={rd.id} value={rd.id}>{rd.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        <div className="flex items-center gap-1" title={member.user?.isCompanyAdmin ? "Company Admin" : "Make Admin"}>
                          <ShieldCheck className={`w-4 h-4 ${member.user?.isCompanyAdmin ? "text-primary" : "text-muted-foreground/30"}`} />
                          <Switch
                            checked={!!member.user?.isCompanyAdmin}
                            onCheckedChange={v => toggleAdminMutation.mutate({ userId: member.userId, isCompanyAdmin: v })}
                            disabled={toggleAdminMutation.isPending}
                            data-testid={`toggle-admin-${member.userId}`}
                          />
                        </div>
                        <Badge variant="outline" className="capitalize">
                          {member.status}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => removeMemberMutation.mutate(member.userId)}
                          disabled={removeMemberMutation.isPending}
                          data-testid={`button-remove-member-${member.userId}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>


        {/* Subscription Tab */}
        <TabsContent value="subscription" className="space-y-6">
          {!isOwnerOrCompanyAdmin ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                <CreditCard className="w-8 h-8 mx-auto mb-3 opacity-40" />
                <p className="text-sm">Billing information is only available to company owners and admins.</p>
              </CardContent>
            </Card>
          ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Billing & Access
              </CardTitle>
              <CardDescription>Your BuildVision billing and access details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Stripe not configured — informational only */}
              {stripeConfig && !stripeConfig.configured && company?.billingType === "in_app" && (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-400" data-testid="stripe-not-configured-alert">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <p>In-app billing is enabled but Stripe is not yet configured for this account. Contact BuildVision support to complete setup.</p>
                </div>
              )}

              {/* Current status card */}
              <div className={`rounded-lg border p-4 ${isBlocked ? "bg-destructive/5 border-destructive/30" : "bg-muted/30"}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold capitalize text-lg">
                      {(STATUS_LABEL[subscriptionStatus] ?? subscriptionStatus) || "—"}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {isBlocked
                        ? "Your company access is not active. Please contact support."
                        : `Access status: ${STATUS_LABEL[subscriptionStatus] ?? subscriptionStatus}`}
                    </p>
                    {/* Stripe payment state overlay */}
                    {stripeBillingDisplay && (
                      <p className={`text-sm font-medium mt-1 ${stripeBillingDisplay.color}`} data-testid="stripe-billing-state">
                        {stripeBillingDisplay.label}
                      </p>
                    )}
                  </div>
                  <Badge
                    variant={isActive ? "default" : isBlocked ? "destructive" : "secondary"}
                    className="capitalize"
                    data-testid="subscription-status-badge"
                  >
                    {(STATUS_LABEL[subscriptionStatus] ?? subscriptionStatus) || "—"}
                  </Badge>
                </div>
              </div>

              <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm" data-testid="billing-details">
                <div>
                  <dt className="text-muted-foreground text-xs mb-0.5">Billing Type</dt>
                  <dd className="font-medium capitalize" data-testid="display-billing-type">
                    {company?.billingType?.replace(/_/g, " ") || "Manual"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs mb-0.5">Monthly Price</dt>
                  <dd className="font-medium" data-testid="display-monthly-price">
                    {company?.monthlyPrice
                      ? `$${parseFloat(company.monthlyPrice).toFixed(2)}/mo`
                      : "—"}
                  </dd>
                </div>
                {company?.prepaidThroughDate && (
                  <div>
                    <dt className="text-muted-foreground text-xs mb-0.5">Prepaid Through</dt>
                    <dd className="font-medium" data-testid="display-prepaid-through">
                      {new Date(company.prepaidThroughDate).toLocaleDateString()}
                    </dd>
                  </div>
                )}
                {company?.stripePaymentStatus && (
                  <div>
                    <dt className="text-muted-foreground text-xs mb-0.5">Payment Status</dt>
                    <dd className="font-medium capitalize" data-testid="display-stripe-payment-status">
                      {company.stripePaymentStatus.replace(/_/g, " ")}
                    </dd>
                  </div>
                )}
                {company?.stripeCurrentPeriodEnd && (
                  <div>
                    <dt className="text-muted-foreground text-xs mb-0.5">Current Period Ends</dt>
                    <dd className="font-medium" data-testid="display-stripe-period-end">
                      {new Date(company.stripeCurrentPeriodEnd).toLocaleDateString()}
                    </dd>
                  </div>
                )}
                {company?.stripeGraceEndsAt && (
                  <div className="sm:col-span-2">
                    <dt className="text-muted-foreground text-xs mb-0.5">Grace Period Ends</dt>
                    <dd className="font-medium text-orange-600" data-testid="display-stripe-grace-ends">
                      {new Date(company.stripeGraceEndsAt).toLocaleDateString()}
                    </dd>
                  </div>
                )}
                {company?.lastPaymentFailureReason && (
                  <div className="sm:col-span-2">
                    <dt className="text-muted-foreground text-xs mb-0.5">Last Payment Issue</dt>
                    <dd className="text-sm text-destructive" data-testid="display-payment-failure-reason">
                      {company.lastPaymentFailureReason}
                    </dd>
                  </div>
                )}
              </dl>

              {/* Placeholder billing action buttons — always shown disabled for Phase 10A */}
              <div className="flex flex-wrap gap-2 pt-1" data-testid="stripe-billing-actions">
                <Button
                  variant="outline"
                  size="sm"
                  disabled
                  title="Coming soon — will be available in a future release"
                  data-testid="button-start-subscription"
                >
                  <CreditCard className="w-4 h-4 mr-1.5" /> Manage Subscription
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled
                  title="Coming soon — will be available in a future release"
                  data-testid="button-manage-payment"
                >
                  <CreditCard className="w-4 h-4 mr-1.5" /> Manage Payment Method
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled
                  title="Coming soon — will be available in a future release"
                  data-testid="button-retry-payment"
                >
                  <RefreshCw className="w-4 h-4 mr-1.5" /> Retry Payment
                </Button>
              </div>

              <div className="rounded-lg border border-dashed p-4 text-center text-muted-foreground" data-testid="contact-support-note">
                <p className="text-sm">To change your Billing &amp; Access settings, contact BuildVision support.</p>
              </div>
            </CardContent>
          </Card>
          )}
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Company Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Company Name</Label>
                <Input defaultValue={company?.name} data-testid="input-company-name" />
              </div>
              <div className="pt-2">
                <Button data-testid="button-save-company">Save Changes</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <ConfirmDialog />
    </div>
  );
}
