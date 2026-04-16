import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  HardHat, FolderOpen, Clock, CheckCircle, RefreshCw, Building2,
  ChevronRight, FileText, DollarSign, MessageSquare, Upload, Eye,
  Layers, Shield, User, Briefcase, Bell, X, Check, AlertCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { parseErrorMessage } from "@/lib/queryClient";

type Permissions = {
  canViewDocuments?: boolean;
  canUploadDocuments?: boolean;
  canViewBudget?: boolean;
  canViewMessages?: boolean;
  canPostMessages?: boolean;
  canViewEstimates?: boolean;
};

type ProjectWithDetails = {
  id: string;
  name: string;
  address?: string;
  status: string;
  progress?: number;
  companyName?: string;
  companyId?: string;
  companyLogo?: string | null;
  permissions?: Permissions;
  membershipId: string;
};

function PermissionChip({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5">
      {icon}
      {label}
    </span>
  );
}

function ProjectCard({ project, onClick }: { project: ProjectWithDetails; onClick: () => void }) {
  const perms: Permissions = project.permissions || {};
  const activePerms = [
    { key: "canViewDocuments", label: "Docs", icon: <FileText className="w-3 h-3" /> },
    { key: "canUploadDocuments", label: "Upload", icon: <Upload className="w-3 h-3" /> },
    { key: "canViewBudget", label: "Budget", icon: <DollarSign className="w-3 h-3" /> },
    { key: "canViewMessages", label: "Messages", icon: <MessageSquare className="w-3 h-3" /> },
    { key: "canViewEstimates", label: "Estimates", icon: <Eye className="w-3 h-3" /> },
  ].filter(p => perms[p.key as keyof Permissions]);

  return (
    <div
      className="p-4 rounded-lg border border-border hover:border-primary/40 hover:bg-muted/30 cursor-pointer transition-all group"
      onClick={onClick}
      data-testid={`project-card-${project.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-semibold truncate" data-testid={`project-title-${project.id}`}>{project.name}</p>
            <Badge
              variant={project.status === "active" ? "default" : project.status === "completed" ? "secondary" : "outline"}
              className="capitalize text-xs shrink-0"
            >
              {project.status}
            </Badge>
          </div>
          {project.companyName && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-2">
              {project.companyLogo ? (
                <img src={project.companyLogo} alt={project.companyName} className="w-4 h-4 rounded object-contain shrink-0" />
              ) : (
                <Building2 className="w-3.5 h-3.5 shrink-0" />
              )}
              <span className="truncate">{project.companyName}</span>
            </div>
          )}
          {project.address && (
            <p className="text-xs text-muted-foreground truncate mb-2">{project.address}</p>
          )}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {activePerms.length > 0 ? (
              activePerms.map(p => (
                <PermissionChip key={p.key} label={p.label} icon={p.icon} />
              ))
            ) : (
              <span className="text-xs text-muted-foreground">View-only access</span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className="text-sm font-medium text-muted-foreground">{project.progress ?? 0}%</span>
          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${project.progress ?? 0}%` }}
            />
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors mt-1" />
        </div>
      </div>
    </div>
  );
}

type PendingInvite = {
  id: string;
  email: string;
  contractorType?: string;
  projectId?: string;
  companyId?: string;
  status: string;
  expiresAt: string;
  projectName?: string | null;
  companyName?: string | null;
};

export default function SubcontractorDashboard() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { toast } = useToast();
  const isNotary = user?.contractorType === "notary";
  const roleLabel = isNotary ? "Notary" : "Sub-Contractor";

  const { data: projects = [], isLoading, isError } = useQuery<ProjectWithDetails[]>({
    queryKey: ["/api/my-projects"],
    queryFn: async () => {
      const res = await fetch("/api/my-projects", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load projects");
      return res.json();
    },
  });

  const { data: pendingInvites = [] } = useQuery<PendingInvite[]>({
    queryKey: ["/api/my-invites"],
    queryFn: async () => {
      const res = await fetch("/api/my-invites", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const acceptInviteMutation = useMutation({
    mutationFn: async (inviteId: string) => {
      const res = await fetch(`/api/my-invites/${inviteId}/accept`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to accept invite");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-invites"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-projects"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: parseErrorMessage(err), variant: "destructive" });
    },
  });

  const declineInviteMutation = useMutation({
    mutationFn: async (inviteId: string) => {
      const res = await fetch(`/api/my-invites/${inviteId}/decline`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to decline invite");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-invites"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: parseErrorMessage(err), variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <AlertCircle className="w-10 h-10 text-destructive" />
        <div>
          <p className="font-semibold text-lg">Failed to load your assignments</p>
          <p className="text-muted-foreground text-sm mt-1">There was a problem connecting to the server. Please refresh the page.</p>
        </div>
      </div>
    );
  }

  const activeProjects = projects.filter(p => p.status !== "completed");
  const completedProjects = projects.filter(p => p.status === "completed");
  const uniqueCompanies = new Set(projects.map(p => p.companyId).filter(Boolean)).size;

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-heading font-bold" data-testid="subcontractor-welcome">
              Welcome, {user?.name || user?.username}
            </h1>
            <Badge variant="outline" className="text-sm">
              {roleLabel}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            {user?.subcontractorSpecialty
              ? user.subcontractorSpecialty
              : `Your ${roleLabel.toLowerCase()} project hub`}
          </p>
        </div>
        {isNotary && (
          <Button variant="outline" onClick={() => navigate("/notary/portal")} data-testid="button-notary-portal">
            <Shield className="w-4 h-4 mr-2" />
            Notary Portal
          </Button>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card data-testid="card-active-projects">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Assignments</p>
                <p className="text-3xl font-bold mt-1" data-testid="stat-active">{activeProjects.length}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-companies">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Companies</p>
                <p className="text-3xl font-bold mt-1" data-testid="stat-companies">{uniqueCompanies}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-completed-projects">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-3xl font-bold mt-1" data-testid="stat-completed">{completedProjects.length}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-pending-invites">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Invites</p>
                <p className="text-3xl font-bold mt-1" data-testid="stat-pending-invites">{pendingInvites.length}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                <Bell className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
              <Bell className="w-5 h-5" />
              Pending Project Invitations
              <Badge className="ml-auto bg-blue-600 text-white">{pendingInvites.length}</Badge>
            </CardTitle>
            <CardDescription>You have been invited to collaborate on these projects</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingInvites.map(invite => (
              <div
                key={invite.id}
                className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-muted border"
                data-testid={`pending-invite-${invite.id}`}
              >
                <div>
                  <p className="text-sm font-medium">
                    {invite.projectName ? invite.projectName : `${invite.contractorType === "notary" ? "Notary" : "Sub-Contractor"} Assignment`}
                  </p>
                  {invite.companyName && (
                    <p className="text-xs font-medium text-primary">{invite.companyName}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Expires {new Date(invite.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => declineInviteMutation.mutate(invite.id)}
                    disabled={declineInviteMutation.isPending}
                    data-testid={`button-decline-invite-${invite.id}`}
                  >
                    <X className="w-3 h-3 mr-1" />
                    Decline
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => acceptInviteMutation.mutate(invite.id)}
                    disabled={acceptInviteMutation.isPending}
                    data-testid={`button-accept-invite-${invite.id}`}
                  >
                    <Check className="w-3 h-3 mr-1" />
                    Accept
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Projects + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Assignments */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5" />
                Active Assignments
              </CardTitle>
              <CardDescription>Projects you are currently assigned to</CardDescription>
            </CardHeader>
            <CardContent>
              {activeProjects.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <HardHat className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No active assignments</p>
                  <p className="text-sm mt-1">
                    A company will assign you to projects once work begins.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeProjects.map(project => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      onClick={() => navigate(`/subcontractor/project/${project.id}`)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4">
          {/* Access Legend */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="w-4 h-4" />
                Your Access
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground mb-3">
                Each company sets your access independently per project.
              </p>
              <div className="space-y-1.5">
                {[
                  { icon: <FileText className="w-3.5 h-3.5" />, label: "View Documents" },
                  { icon: <Upload className="w-3.5 h-3.5" />, label: "Upload Documents" },
                  { icon: <DollarSign className="w-3.5 h-3.5" />, label: "View Budget" },
                  { icon: <MessageSquare className="w-3.5 h-3.5" />, label: "Messages" },
                  { icon: <Eye className="w-3.5 h-3.5" />, label: "View Estimates" },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-2 text-muted-foreground">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Completed Projects */}
          {completedProjects.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Completed
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {completedProjects.map(project => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between text-sm cursor-pointer hover:text-primary py-1"
                    onClick={() => navigate(`/subcontractor/project/${project.id}`)}
                    data-testid={`completed-project-${project.id}`}
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{project.name}</p>
                      {project.companyName && (
                        <p className="text-xs text-muted-foreground truncate">{project.companyName}</p>
                      )}
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 ml-2" />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Profile Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4" />
                My Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="font-medium">{roleLabel}</span>
              </div>
              {user?.subcontractorSpecialty && (
                <p className="text-muted-foreground">{user.subcontractorSpecialty}</p>
              )}
              {user?.email && (
                <p className="text-muted-foreground truncate">{user.email}</p>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2"
                onClick={() => navigate("/contractor/settings")}
                data-testid="button-edit-profile"
              >
                Edit Profile
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
