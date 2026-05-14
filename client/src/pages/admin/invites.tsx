import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiRequest, parseErrorMessage } from "@/lib/queryClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { SuperAdminLayout } from "@/components/super-admin-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Link } from "wouter";
import {
  Link2,
  RefreshCw,
  X,
  Search,
  Eye,
  Mail,
  Building2,
  FolderOpen,
  UserCheck,
  Clock,
  CalendarX2,
  CheckCircle2,
  XCircle,
  Send,
  RotateCcw,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface AdminInvite {
  id: string;
  inviteType: string;
  email: string;
  clientName: string | null;
  status: string;
  projectId: string | null;
  projectName: string | null;
  companyId: string | null;
  companyName: string | null;
  invitedByName: string | null;
  acceptedUserId: string | null;
  acceptedUserName: string | null;
  sentAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  expiresAt: string;
  resendCount: number;
  lastResentAt: string | null;
}

const STATUS_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: {
    label: "Pending",
    color: "bg-amber-100 text-amber-700",
    icon: <Clock className="w-3 h-3" />,
  },
  accepted: {
    label: "Accepted",
    color: "bg-green-100 text-green-700",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  expired: {
    label: "Expired",
    color: "bg-red-100 text-red-700",
    icon: <CalendarX2 className="w-3 h-3" />,
  },
  revoked: {
    label: "Revoked",
    color: "bg-gray-100 text-gray-500",
    icon: <XCircle className="w-3 h-3" />,
  },
};

const TYPE_META: Record<string, { label: string; color: string }> = {
  client: { label: "Client", color: "bg-blue-100 text-blue-700" },
  contractor: { label: "Contractor", color: "bg-violet-100 text-violet-700" },
  subcontractor: { label: "Sub", color: "bg-orange-100 text-orange-700" },
  notary: { label: "Notary", color: "bg-teal-100 text-teal-700" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_META[status] ?? { label: status, color: "bg-gray-100 text-gray-500", icon: null };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium capitalize ${s.color}`}
      data-testid={`badge-status-${status}`}
    >
      {s.icon}
      {s.label}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const t = TYPE_META[type] ?? { label: type, color: "bg-gray-100 text-gray-500" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${t.color}`}>
      {t.label}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-0.5">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  );
}

interface DrawerProps {
  invite: AdminInvite | null;
  onClose: () => void;
  onResend: (invite: AdminInvite) => void;
  onRevoke: (invite: AdminInvite) => void;
  isResending: boolean;
  isRevoking: boolean;
}

function InviteDrawer({ invite, onClose, onResend, onRevoke, isResending, isRevoking }: DrawerProps) {
  if (!invite) return null;

  const canResend = invite.status === "pending" || invite.status === "expired";
  const canRevoke = invite.status === "pending" || invite.status === "expired";
  const isProcessing = isResending || isRevoking;

  return (
    <Sheet open={!!invite} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto" data-testid="drawer-invite-detail">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-base font-semibold truncate">{invite.email}</SheetTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={invite.status} />
            <TypeBadge type={invite.inviteType} />
          </div>
        </SheetHeader>

        <div className="space-y-5 pb-10">
          {/* Identity */}
          <div className="grid grid-cols-2 gap-3">
            {invite.clientName && (
              <Field label="Recipient Name">
                <span>{invite.clientName}</span>
              </Field>
            )}
            {invite.acceptedUserName && (
              <Field label="Accepted By">
                <span className="text-green-700 font-medium">{invite.acceptedUserName}</span>
              </Field>
            )}
          </div>

          {/* Context */}
          <div className="grid grid-cols-1 gap-3">
            {invite.companyName && (
              <Field label="Company">
                <div className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>{invite.companyName}</span>
                </div>
              </Field>
            )}
            {invite.projectName && (
              <Field label="Project">
                <div className="flex items-center gap-1.5">
                  <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
                  {invite.projectId ? (
                    <Link
                      href={`/admin/project/${invite.projectId}`}
                      className="text-blue-600 hover:underline"
                      data-testid="link-project"
                    >
                      {invite.projectName}
                    </Link>
                  ) : (
                    <span>{invite.projectName}</span>
                  )}
                </div>
              </Field>
            )}
            {invite.invitedByName && (
              <Field label="Invited By">
                <div className="flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>{invite.invitedByName}</span>
                </div>
              </Field>
            )}
          </div>

          <Separator />

          {/* Timeline */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sent">
              <span>{format(new Date(invite.sentAt), "MMM d, yyyy")}</span>
              <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(invite.sentAt), { addSuffix: true })}</p>
            </Field>
            <Field label="Expires">
              <span className={invite.status === "expired" ? "text-red-600" : ""}>
                {format(new Date(invite.expiresAt), "MMM d, yyyy")}
              </span>
            </Field>
            {invite.acceptedAt && (
              <Field label="Accepted">
                <span className="text-green-700">{format(new Date(invite.acceptedAt), "MMM d, yyyy")}</span>
              </Field>
            )}
            {invite.revokedAt && (
              <Field label="Revoked">
                <span className="text-gray-500">{format(new Date(invite.revokedAt), "MMM d, yyyy")}</span>
              </Field>
            )}
          </div>

          <Separator />

          {/* Resend metadata */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Times Resent">
              <span className="tabular-nums font-medium">{invite.resendCount}</span>
            </Field>
            {invite.lastResentAt && (
              <Field label="Last Resent">
                <span>{format(new Date(invite.lastResentAt), "MMM d, yyyy")}</span>
                <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(invite.lastResentAt), { addSuffix: true })}</p>
              </Field>
            )}
          </div>

          <Separator />

          {/* Actions */}
          <div className="space-y-2">
            {canResend && (
              <Button
                className="w-full gap-2"
                size="sm"
                variant="outline"
                disabled={isProcessing}
                onClick={() => onResend(invite)}
                data-testid="button-drawer-resend"
              >
                <Send className={`w-3.5 h-3.5 ${isResending ? "animate-pulse" : ""}`} />
                {isResending ? "Sending…" : "Resend Invite Email"}
              </Button>
            )}
            {canRevoke && (
              <Button
                className="w-full gap-2"
                size="sm"
                variant="outline"
                disabled={isProcessing}
                onClick={() => onRevoke(invite)}
                data-testid="button-drawer-revoke"
              >
                <XCircle className="w-3.5 h-3.5 text-red-500" />
                <span className="text-red-600">{isRevoking ? "Revoking…" : "Revoke Invite"}</span>
              </Button>
            )}
            {invite.projectId && (
              <Link href={`/admin/project/${invite.projectId}`}>
                <Button
                  className="w-full gap-2"
                  size="sm"
                  variant="ghost"
                  data-testid="button-drawer-view-project"
                >
                  <Eye className="w-3.5 h-3.5" />
                  View Project
                </Button>
              </Link>
            )}
          </div>

          {invite.status === "accepted" && (
            <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800">
              <p className="font-semibold">Accepted</p>
              <p className="text-xs mt-0.5 text-green-700">
                {invite.acceptedUserName
                  ? `${invite.acceptedUserName} accepted this invite.`
                  : "This invite has been accepted."}
              </p>
            </div>
          )}
          {invite.status === "revoked" && (
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-sm text-gray-600">
              <p className="font-semibold">Revoked</p>
              <p className="text-xs mt-0.5">This invitation has been cancelled and can no longer be used.</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function AdminInvites() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [selectedInvite, setSelectedInvite] = useState<AdminInvite | null>(null);

  const { data: adminInvites = [], isLoading } = useQuery<AdminInvite[]>({
    queryKey: ["/api/admin/invites"],
    queryFn: () => apiRequest("GET", "/api/admin/invites").then((r) => r.json()),
    enabled: user?.role === "admin",
  });

  // Keep drawer in sync with fresh data
  useEffect(() => {
    if (selectedInvite) {
      const fresh = adminInvites.find((i) => i.id === selectedInvite.id);
      if (fresh) setSelectedInvite(fresh);
    }
  }, [adminInvites]);

  const resendMutation = useMutation({
    mutationFn: ({ id, type }: { id: string; type: string }) =>
      apiRequest("POST", `/api/admin/invites/${id}/resend`, { type }).then((r) => r.json()),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invites"] });
      toast({ title: "Invite resent", description: "A fresh invite email has been sent." });
    },
    onError: (err: Error) =>
      toast({ title: "Failed to resend", description: parseErrorMessage(err), variant: "destructive" }),
  });

  const revokeMutation = useMutation({
    mutationFn: ({ id, type }: { id: string; type: string }) =>
      apiRequest("POST", `/api/admin/invites/${id}/revoke`, { type }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invites"] });
      toast({ title: "Invite revoked" });
    },
    onError: (err: Error) =>
      toast({ title: "Failed to revoke", description: parseErrorMessage(err), variant: "destructive" }),
  });

  // Build unique company list for filter
  const companyOptions = Array.from(
    new Map(
      adminInvites
        .filter((i) => i.companyName)
        .map((i) => [i.companyId ?? i.companyName, i.companyName!])
    ).entries()
  ).sort((a, b) => a[1].localeCompare(b[1]));

  const filtered = adminInvites.filter((inv) => {
    if (statusFilter !== "all" && inv.status !== statusFilter) return false;
    if (typeFilter !== "all" && inv.inviteType !== typeFilter) return false;
    if (companyFilter !== "all" && (inv.companyId ?? inv.companyName) !== companyFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const fields = [
        inv.email,
        inv.clientName,
        inv.projectName,
        inv.companyName,
        inv.invitedByName,
        inv.acceptedUserName,
      ];
      if (!fields.some((f) => f?.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  const hasFilters = search || statusFilter !== "all" || typeFilter !== "all" || companyFilter !== "all";

  // Counts for filter pills
  const pendingCount = adminInvites.filter((i) => i.status === "pending").length;
  const expiredCount = adminInvites.filter((i) => i.status === "expired").length;

  return (
    <SuperAdminLayout>
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-teal-600" />
            <h1 className="text-2xl font-bold text-foreground">Invite Status</h1>
          </div>
          <div className="flex items-center gap-2">
            {pendingCount > 0 && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700"
                data-testid="badge-pending-count"
              >
                <Clock className="w-3 h-3" />
                {pendingCount} pending
              </span>
            )}
            {expiredCount > 0 && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"
                data-testid="badge-expired-count"
              >
                <CalendarX2 className="w-3 h-3" />
                {expiredCount} expired
              </span>
            )}
            <Badge variant="secondary" data-testid="badge-total-invites">
              {adminInvites.length} total
            </Badge>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-8 h-9 text-sm"
              placeholder="Search email, project, company…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-invites"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-9 text-sm" data-testid="select-filter-status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(STATUS_META).map(([val, { label }]) => (
                <SelectItem key={val} value={val} className="text-sm">{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px] h-9 text-sm" data-testid="select-filter-type">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {Object.entries(TYPE_META).map(([val, { label }]) => (
                <SelectItem key={val} value={val} className="text-sm">{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {companyOptions.length > 0 && (
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger className="w-[160px] h-9 text-sm" data-testid="select-filter-company">
                <SelectValue placeholder="Company" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                {companyOptions.map(([id, name]) => (
                  <SelectItem key={id ?? name} value={id ?? name} className="text-sm">{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-sm"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
                setTypeFilter("all");
                setCompanyFilter("all");
              }}
              data-testid="button-clear-filters"
            >
              Clear
            </Button>
          )}
        </div>

        {/* Table */}
        {isLoading ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              Loading invites…
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-14 text-center text-muted-foreground space-y-1">
              <Mail className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="font-medium">
                {adminInvites.length === 0
                  ? "No invites have been sent yet."
                  : "No invites match your filters."}
              </p>
              {hasFilters && (
                <p className="text-xs">
                  Try clearing filters to see all invites.
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((inv) => (
                    <TableRow
                      key={inv.id}
                      data-testid={`invite-row-${inv.id}`}
                      className="cursor-pointer hover:bg-muted/30"
                      onClick={() => setSelectedInvite(inv)}
                    >
                      <TableCell className="text-sm font-medium max-w-[180px] truncate">
                        <div>
                          <span>{inv.email}</span>
                          {inv.clientName && (
                            <p className="text-xs text-muted-foreground">{inv.clientName}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <TypeBadge type={inv.inviteType} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[120px] truncate">
                        {inv.companyName || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[120px] truncate">
                        {inv.projectName || "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={inv.status} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {format(new Date(inv.sentAt), "MMM d, yyyy")}
                        {inv.resendCount > 0 && (
                          <p className="text-xs text-blue-600">
                            <RotateCcw className="w-2.5 h-2.5 inline mr-0.5" />
                            {inv.resendCount}×
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        <span className={inv.status === "expired" ? "text-red-500" : ""}>
                          {format(new Date(inv.expiresAt), "MMM d, yyyy")}
                        </span>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          {(inv.status === "pending" || inv.status === "expired") && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                onClick={() => resendMutation.mutate({ id: inv.id, type: inv.inviteType })}
                                disabled={resendMutation.isPending}
                                data-testid={`button-resend-${inv.id}`}
                                title="Resend invite"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => revokeMutation.mutate({ id: inv.id, type: inv.inviteType })}
                                disabled={revokeMutation.isPending}
                                data-testid={`button-revoke-${inv.id}`}
                                title="Revoke invite"
                              >
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => setSelectedInvite(inv)}
                            data-testid={`button-details-${inv.id}`}
                            title="View details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-muted-foreground text-right">
          {filtered.length} of {adminInvites.length} invite{adminInvites.length !== 1 ? "s" : ""}
        </p>
      </div>

      <InviteDrawer
        invite={selectedInvite}
        onClose={() => setSelectedInvite(null)}
        onResend={(inv) => resendMutation.mutate({ id: inv.id, type: inv.inviteType })}
        onRevoke={(inv) => revokeMutation.mutate({ id: inv.id, type: inv.inviteType })}
        isResending={resendMutation.isPending}
        isRevoking={revokeMutation.isPending}
      />
    </SuperAdminLayout>
  );
}
