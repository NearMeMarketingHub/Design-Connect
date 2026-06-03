import { useState, useEffect, useMemo } from "react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { Link } from "wouter";
import {
  Link2,
  RefreshCw,
  X,
  Search,
  Eye,
  Building2,
  FolderOpen,
  UserCheck,
  Clock,
  CalendarX2,
  CheckCircle2,
  XCircle,
  Send,
  RotateCcw,
  Mail,
  ExternalLink,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

// ── Types ─────────────────────────────────────────────────────────────────────
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

// ── Constants ─────────────────────────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending:  { label: "Pending",  color: "bg-amber-100 text-amber-700", icon: <Clock className="w-3 h-3" /> },
  accepted: { label: "Accepted", color: "bg-green-100 text-green-700", icon: <CheckCircle2 className="w-3 h-3" /> },
  expired:  { label: "Expired",  color: "bg-red-100 text-red-700",    icon: <CalendarX2 className="w-3 h-3" /> },
  revoked:  { label: "Revoked",  color: "bg-gray-100 text-gray-500",  icon: <XCircle className="w-3 h-3" /> },
};

const TYPE_META: Record<string, { label: string; color: string }> = {
  client:        { label: "Client Invite",    color: "bg-blue-100 text-blue-700" },
  contractor:    { label: "Team Member",      color: "bg-violet-100 text-violet-700" },
  subcontractor: { label: "Sub-Contractor",   color: "bg-orange-100 text-orange-700" },
  notary:        { label: "Notary",           color: "bg-teal-100 text-teal-700" },
};

// ── Hooks ─────────────────────────────────────────────────────────────────────
function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

// ── Sub-components ────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const s = STATUS_META[status] ?? { label: status, color: "bg-gray-100 text-gray-500", icon: null };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium capitalize ${s.color}`}>
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

// ── Detail Drawer ─────────────────────────────────────────────────────────────
interface DrawerProps {
  invite: AdminInvite | null;
  onClose: () => void;
  onResend: (invite: AdminInvite) => void;
  onRevokeRequest: (invite: AdminInvite) => void;
  isResending: boolean;
  isRevoking: boolean;
}

function InviteDrawer({ invite, onClose, onResend, onRevokeRequest, isResending, isRevoking }: DrawerProps) {
  if (!invite) return null;

  const canResend = invite.status === "pending" || invite.status === "expired";
  const canRevoke = invite.status === "pending";
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
          {/* Recipient / accepted user */}
          <div className="grid grid-cols-2 gap-3">
            {invite.clientName && (
              <Field label="Recipient Name">
                <span>{invite.clientName}</span>
              </Field>
            )}
            {invite.acceptedUserName && (
              <Field label="Accepted By">
                <Link
                  href={`/admin/users?search=${encodeURIComponent(invite.acceptedUserName)}`}
                  className="text-green-700 font-medium hover:underline inline-flex items-center gap-1"
                  data-testid="link-accepted-user"
                >
                  {invite.acceptedUserName}
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </Field>
            )}
          </div>

          {/* Context */}
          <div className="space-y-3">
            {invite.companyName && (
              <Field label="Company">
                <div className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                  {invite.companyId ? (
                    <Link
                      href={`/admin/companies/${invite.companyId}`}
                      className="text-blue-600 hover:underline inline-flex items-center gap-1"
                      data-testid="link-company"
                    >
                      {invite.companyName}
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  ) : (
                    <span>{invite.companyName}</span>
                  )}
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
                      className="text-blue-600 hover:underline inline-flex items-center gap-1"
                      data-testid="link-project"
                    >
                      {invite.projectName}
                      <ExternalLink className="w-3 h-3" />
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

          {/* Resend history */}
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
                onClick={() => onRevokeRequest(invite)}
                data-testid="button-drawer-revoke"
              >
                <XCircle className="w-3.5 h-3.5 text-red-500" />
                <span className="text-red-600">{isRevoking ? "Revoking…" : "Revoke Invite"}</span>
              </Button>
            )}
          </div>

          {/* Status callout */}
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
          {invite.status === "expired" && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              <p className="font-semibold">Expired</p>
              <p className="text-xs mt-0.5">Use "Resend" to issue a fresh 7-day invite to the same address.</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminInvites() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchRaw, setSearchRaw] = useState("");
  const search = useDebounce(searchRaw, 250);

  const [statusFilter, setStatusFilter]   = useState("all");
  const [typeFilter, setTypeFilter]       = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");

  const [selectedInvite, setSelectedInvite] = useState<AdminInvite | null>(null);
  const [revokeTarget, setRevokeTarget]     = useState<AdminInvite | null>(null);

  // ── Data ────────────────────────────────────────────────────────────────────
  const { data: adminInvites = [], isLoading } = useQuery<AdminInvite[]>({
    queryKey: ["/api/admin/invites"],
    queryFn: () => apiRequest("GET", "/api/admin/invites").then((r) => r.json()),
    enabled: user?.role === "admin",
  });

  // Keep drawer in sync with fresh data after mutations
  useEffect(() => {
    if (selectedInvite) {
      const fresh = adminInvites.find((i) => i.id === selectedInvite.id);
      if (fresh) setSelectedInvite(fresh);
    }
  }, [adminInvites]);

  // ── Mutations ───────────────────────────────────────────────────────────────
  const resendMutation = useMutation({
    mutationFn: ({ id, type }: { id: string; type: string }) =>
      apiRequest("POST", `/api/admin/invites/${id}/resend`, { type }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invites"] });
      toast({ title: "Invite resent", description: "A fresh 7-day invite has been sent." });
    },
    onError: (err: Error) =>
      toast({ title: "Failed to resend", description: parseErrorMessage(err), variant: "destructive" }),
  });

  const revokeMutation = useMutation({
    mutationFn: ({ id, type }: { id: string; type: string }) =>
      apiRequest("POST", `/api/admin/invites/${id}/revoke`, { type }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invites"] });
      setRevokeTarget(null);
      toast({ title: "Invite revoked" });
    },
    onError: (err: Error) => {
      setRevokeTarget(null);
      toast({ title: "Failed to revoke", description: parseErrorMessage(err), variant: "destructive" });
    },
  });

  // ── Filter options ──────────────────────────────────────────────────────────
  const companyOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const inv of adminInvites) {
      if (inv.companyName) map.set(inv.companyId ?? inv.companyName, inv.companyName);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [adminInvites]);

  // Project options constrained to selected company
  const projectOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const inv of adminInvites) {
      if (!inv.projectId || !inv.projectName) continue;
      if (companyFilter !== "all") {
        const invCompanyKey = inv.companyId ?? inv.companyName;
        if (invCompanyKey !== companyFilter) continue;
      }
      map.set(inv.projectId, inv.projectName);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [adminInvites, companyFilter]);

  // Reset project filter when company changes
  useEffect(() => { setProjectFilter("all"); }, [companyFilter]);

  // ── Filtered list ───────────────────────────────────────────────────────────
  const filtered = useMemo(() => adminInvites.filter((inv) => {
    if (statusFilter  !== "all" && inv.status     !== statusFilter)  return false;
    if (typeFilter    !== "all" && inv.inviteType  !== typeFilter)    return false;
    if (companyFilter !== "all" && (inv.companyId ?? inv.companyName) !== companyFilter) return false;
    if (projectFilter !== "all" && inv.projectId  !== projectFilter)  return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const haystack = [inv.email, inv.clientName, inv.projectName, inv.companyName, inv.invitedByName, inv.acceptedUserName];
      if (!haystack.some((f) => f?.toLowerCase().includes(q))) return false;
    }
    return true;
  }), [adminInvites, statusFilter, typeFilter, companyFilter, projectFilter, search]);

  const hasFilters = searchRaw || statusFilter !== "all" || typeFilter !== "all" || companyFilter !== "all" || projectFilter !== "all";
  const pendingCount = adminInvites.filter((i) => i.status === "pending").length;
  const expiredCount = adminInvites.filter((i) => i.status === "expired").length;

  // ── Render ──────────────────────────────────────────────────────────────────
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
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700" data-testid="badge-pending-count">
                <Clock className="w-3 h-3" />{pendingCount} pending
              </span>
            )}
            {expiredCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700" data-testid="badge-expired-count">
                <CalendarX2 className="w-3 h-3" />{expiredCount} expired
              </span>
            )}
            <Badge variant="secondary" data-testid="badge-total-invites">{adminInvites.length} total</Badge>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-8 h-9 text-sm"
              placeholder="Search email, project, company…"
              value={searchRaw}
              onChange={(e) => setSearchRaw(e.target.value)}
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
            <SelectTrigger className="w-[150px] h-9 text-sm" data-testid="select-filter-type">
              <SelectValue placeholder="Invite Type" />
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
                  <SelectItem key={id} value={id} className="text-sm">{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {projectOptions.length > 0 && (
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-[160px] h-9 text-sm" data-testid="select-filter-project">
                <SelectValue placeholder="Project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{companyFilter !== "all" ? "All Projects" : "All Projects"}</SelectItem>
                {projectOptions.map(([id, name]) => (
                  <SelectItem key={id} value={id} className="text-sm">{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-sm"
              onClick={() => { setSearchRaw(""); setStatusFilter("all"); setTypeFilter("all"); setCompanyFilter("all"); setProjectFilter("all"); }}
              data-testid="button-clear-filters"
            >
              Clear
            </Button>
          )}
        </div>

        {/* Table */}
        {isLoading ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground text-sm">Loading invites…</CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-14 text-center text-muted-foreground space-y-1">
              <Mail className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="font-medium">
                {hasFilters ? "No invitations match your filters." : "No invitations found."}
              </p>
              {hasFilters && <p className="text-xs">Try clearing filters to see all invitations.</p>}
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
                    <TableHead>Accepted At</TableHead>
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
                      <TableCell className="text-sm font-medium">
                        <div>
                          <span>{inv.email}</span>
                          {inv.clientName && <p className="text-xs text-muted-foreground">{inv.clientName}</p>}
                        </div>
                      </TableCell>
                      <TableCell><TypeBadge type={inv.inviteType} /></TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[120px] truncate">
                        {inv.companyName || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[120px] truncate">
                        {inv.projectName || "—"}
                      </TableCell>
                      <TableCell><StatusBadge status={inv.status} /></TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {format(new Date(inv.sentAt), "MMM d, yyyy")}
                        {inv.resendCount > 0 && (
                          <p className="text-xs text-blue-600">
                            <RotateCcw className="w-2.5 h-2.5 inline mr-0.5" />{inv.resendCount}×
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap" data-testid={`cell-accepted-at-${inv.id}`}>
                        {inv.acceptedAt ? format(new Date(inv.acceptedAt), "MMM d, yyyy") : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        <span className={inv.status === "expired" ? "text-red-500" : ""}>
                          {format(new Date(inv.expiresAt), "MMM d, yyyy")}
                        </span>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          {(inv.status === "pending" || inv.status === "expired") && (
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
                          )}
                          {inv.status === "pending" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => setRevokeTarget(inv)}
                              disabled={revokeMutation.isPending}
                              data-testid={`button-revoke-${inv.id}`}
                              title="Revoke invite"
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
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

      {/* Detail drawer */}
      <InviteDrawer
        invite={selectedInvite}
        onClose={() => setSelectedInvite(null)}
        onResend={(inv) => resendMutation.mutate({ id: inv.id, type: inv.inviteType })}
        onRevokeRequest={(inv) => setRevokeTarget(inv)}
        isResending={resendMutation.isPending}
        isRevoking={revokeMutation.isPending}
      />

      {/* Revoke confirmation dialog */}
      <AlertDialog open={!!revokeTarget} onOpenChange={(o) => { if (!o) setRevokeTarget(null); }}>
        <AlertDialogContent data-testid="dialog-revoke-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this invitation?</AlertDialogTitle>
            <AlertDialogDescription>
              The invite sent to <strong>{revokeTarget?.email}</strong> will be permanently cancelled. The recipient's link
              will stop working immediately. This cannot be undone — you would need to send a new invite.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-revoke-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => revokeTarget && revokeMutation.mutate({ id: revokeTarget.id, type: revokeTarget.inviteType })}
              disabled={revokeMutation.isPending}
              data-testid="button-revoke-confirm"
            >
              {revokeMutation.isPending ? "Revoking…" : "Yes, Revoke"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SuperAdminLayout>
  );
}
