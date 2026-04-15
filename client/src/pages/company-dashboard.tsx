import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { 
  Building2, Users, CreditCard, Settings, Plus, Mail, Trash2,
  CheckCircle, Clock, Crown, Wrench, FileText, UserPlus, ChevronRight,
  RefreshCw, AlertCircle, ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";

const SUBCONTRACTOR_SPECIALTIES = [
  "Plumber", "Electrician", "HVAC Technician", "Roofer", "Carpenter",
  "Painter", "Flooring Specialist", "Mason", "Landscaper", "General Labor"
];

export default function CompanyDashboard() {
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
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

  const { data: company, isLoading: companyLoading } = useQuery({
    queryKey: ["/api/company/mine"],
    queryFn: async () => {
      const res = await fetch("/api/company/mine", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load company");
      return res.json();
    },
    enabled: user?.role === "company_owner" || user?.isCompanyAdmin === true,
  });

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ["/api/company/members", company?.id],
    queryFn: async () => {
      const res = await fetch(`/api/company/${company.id}/members`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load members");
      return res.json();
    },
    enabled: !!company?.id,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["/api/projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load projects");
      return res.json();
    },
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
      toast({ title: "Error", description: err.message, variant: "destructive" });
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
      toast({ title: "Error", description: err.message, variant: "destructive" });
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
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/company/${company?.id}/members/${userId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to remove member");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/members"] });
      toast({ title: "Member removed" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
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
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold" data-testid="company-name">{company?.name || "My Company"}</h1>
          <p className="text-muted-foreground mt-1">Manage your company, team, and subscription</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant={company?.subscriptionStatus === "active" ? "default" : "secondary"}
            className="capitalize"
            data-testid="subscription-status"
          >
            {company?.subscriptionPlan || "free"} plan
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/contractor/dashboard")}
            data-testid="button-switch-to-contractor"
          >
            Switch to Contractor View
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList data-testid="company-tabs">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="team" data-testid="tab-team">Team</TabsTrigger>
          <TabsTrigger value="subscription" data-testid="tab-subscription">Subscription</TabsTrigger>
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
                        <p className="font-medium">{project.title}</p>
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
                              <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Subscription Plan
              </CardTitle>
              <CardDescription>Manage your BuildVision subscription</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Current plan */}
              <div className="rounded-lg border p-4 bg-muted/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold capitalize text-lg">{company?.subscriptionPlan || "Free"} Plan</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Status: <span className="capitalize font-medium">{company?.subscriptionStatus || "active"}</span>
                    </p>
                  </div>
                  <Badge variant={company?.subscriptionStatus === "active" ? "default" : "secondary"} className="capitalize">
                    {company?.subscriptionStatus || "active"}
                  </Badge>
                </div>
              </div>

              {/* Plan tiers */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { name: "Free", price: "$0/mo", features: ["Up to 3 projects", "Basic reporting", "Email support"] },
                  { name: "Pro", price: "$49/mo", features: ["Unlimited projects", "Advanced analytics", "Priority support", "Team members"] },
                  { name: "Enterprise", price: "Custom", features: ["Everything in Pro", "Custom integrations", "Dedicated support", "SLA guarantee"] },
                ].map(plan => (
                  <div
                    key={plan.name}
                    className={`rounded-lg border p-4 space-y-3 ${company?.subscriptionPlan === plan.name.toLowerCase() ? "border-primary bg-primary/5" : ""}`}
                    data-testid={`plan-card-${plan.name.toLowerCase()}`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{plan.name}</p>
                      {company?.subscriptionPlan === plan.name.toLowerCase() && (
                        <Badge className="text-xs">Current</Badge>
                      )}
                    </div>
                    <p className="text-2xl font-bold">{plan.price}</p>
                    <ul className="space-y-1">
                      {plan.features.map(f => (
                        <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CheckCircle className="w-3 h-3 text-green-500 shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    {company?.subscriptionPlan !== plan.name.toLowerCase() && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        data-testid={`button-upgrade-${plan.name.toLowerCase()}`}
                        onClick={() => toast({ title: "Coming soon", description: "Subscription upgrades will be available soon!" })}
                      >
                        {plan.name === "Free" ? "Downgrade" : "Upgrade"}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
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
    </div>
  );
}
