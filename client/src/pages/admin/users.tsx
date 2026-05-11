import { useState, useMemo, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiRequest, parseErrorMessage } from "@/lib/queryClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useSearch } from "wouter";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Link } from "wouter";
import {
  Users,
  Search,
  Mail,
  ChevronLeft,
  ChevronRight,
  Building2,
  Check,
  X,
  UserX,
  UserCheck,
  Eye,
  Clock,
  FolderOpen,
  AlertTriangle,
  Loader2,
  User as UserIcon,
} from "lucide-react";
import type { User, ContractorRequest } from "@shared/schema";

type UserWithoutPassword = Omit<User, "password">;

type UserDetail = UserWithoutPassword & {
  company: { id: string; name: string } | null;
  projects: { id: string; name: string; status: string; companyName?: string }[];
  pendingInviteCount: number;
};

function getUserStatus(u: UserWithoutPassword): "active" | "pending" | "disabled" {
  if (u.isDisabled) return "disabled";
  if (u.isApproved === false) return "pending";
  return "active";
}

function StatusBadge({ u }: { u: UserWithoutPassword }) {
  const status = getUserStatus(u);
  if (status === "disabled")
    return <Badge className="bg-red-100 text-red-700 border-0 text-xs">Disabled</Badge>;
  if (status === "pending")
    return <Badge className="bg-orange-100 text-orange-700 border-0 text-xs">Pending</Badge>;
  return <Badge className="bg-green-100 text-green-700 border-0 text-xs">Active</Badge>;
}

function RoleBadge({ u }: { u: UserWithoutPassword }) {
  const label =
    u.role === "company_owner"
      ? "Company Owner"
      : u.role === "contractor"
      ? u.contractorType
        ? `Team · ${u.contractorType}`
        : "Team Member"
      : u.role === "admin"
      ? "Admin"
      : u.role === "client"
      ? "Client"
      : u.role ?? "—";
  return (
    <Badge variant="outline" className="text-xs capitalize">
      {label}
    </Badge>
  );
}

function CompanyCell({ u, companies }: { u: UserWithoutPassword; companies: { id: string; name: string }[] }) {
  if (u.role === "client") return <span className="text-xs text-muted-foreground italic">Global Client</span>;
  if (!u.companyId) return <span className="text-muted-foreground">—</span>;
  const co = companies.find((c) => c.id === u.companyId);
  return (
    <Link href={`/admin/companies/${u.companyId}`}>
      <span className="text-primary hover:underline text-sm">{co?.name ?? u.companyName ?? u.companyId}</span>
    </Link>
  );
}

// ── User detail drawer ────────────────────────────────────────────────────────

interface UserDetailDrawerProps {
  userId: string | null;
  onClose: () => void;
  onActionDone: () => void;
  currentAdminId: string;
}

function UserDetailDrawer({ userId, onClose, onActionDone, currentAdminId }: UserDetailDrawerProps) {
  const { toast } = useToast();

  const { data: detail, isLoading } = useQuery<UserDetail>({
    queryKey: ["/api/admin/users", userId],
    queryFn: () => apiRequest("GET", `/api/admin/users/${userId}`).then((r) => r.json()),
    enabled: !!userId,
  });

  const resetMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("POST", `/api/admin/users/${id}/send-password-reset`).then((r) => r.json()),
    onSuccess: (d) => toast({ title: "Reset Sent", description: d.message }),
    onError: (e: Error) => toast({ title: "Failed", description: parseErrorMessage(e), variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("POST", `/api/admin/users/${id}/approve`).then((r) => r.json()),
    onSuccess: () => { toast({ title: "User Approved" }); onActionDone(); },
    onError: (e: Error) => toast({ title: "Failed", description: parseErrorMessage(e), variant: "destructive" }),
  });

  const disableMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("PATCH", `/api/admin/users/${id}/disable`).then((r) => r.json()),
    onSuccess: () => { toast({ title: "User Disabled" }); onActionDone(); },
    onError: (e: Error) => toast({ title: "Failed", description: parseErrorMessage(e), variant: "destructive" }),
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("PATCH", `/api/admin/users/${id}/reactivate`).then((r) => r.json()),
    onSuccess: () => { toast({ title: "User Reactivated" }); onActionDone(); },
    onError: (e: Error) => toast({ title: "Failed", description: parseErrorMessage(e), variant: "destructive" }),
  });

  const isSelf = detail?.id === currentAdminId;
  const status = detail ? getUserStatus(detail) : null;

  return (
    <Sheet open={!!userId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-full sm:max-w-[520px] overflow-y-auto">
        {isLoading || !detail ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <SheetHeader className="mb-4">
              <SheetTitle className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <UserIcon className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-base truncate">{detail.name || detail.username}</div>
                  <div className="text-xs text-muted-foreground font-normal">@{detail.username}</div>
                </div>
              </SheetTitle>
            </SheetHeader>

            {/* Status */}
            <div className="flex flex-wrap gap-2 mb-4">
              <StatusBadge u={detail} />
              <RoleBadge u={detail} />
              {isSelf && <Badge className="bg-violet-100 text-violet-700 border-0 text-xs">You</Badge>}
            </div>

            <Separator className="mb-4" />

            {/* Identity */}
            <div className="space-y-2 text-sm mb-4">
              <div className="grid grid-cols-[120px_1fr] gap-1 items-start">
                <span className="text-muted-foreground">Email</span>
                <span>{detail.email || "—"}</span>
              </div>
              <div className="grid grid-cols-[120px_1fr] gap-1 items-start">
                <span className="text-muted-foreground">Username</span>
                <span className="font-mono text-xs">{detail.username}</span>
              </div>
              <div className="grid grid-cols-[120px_1fr] gap-1 items-start">
                <span className="text-muted-foreground">Role</span>
                <span className="capitalize">{detail.role?.replace("_", " ")}</span>
              </div>
              {detail.contractorType && (
                <div className="grid grid-cols-[120px_1fr] gap-1 items-start">
                  <span className="text-muted-foreground">Member type</span>
                  <span className="capitalize">{detail.contractorType}</span>
                </div>
              )}
              {detail.company && (
                <div className="grid grid-cols-[120px_1fr] gap-1 items-start">
                  <span className="text-muted-foreground">Company</span>
                  <Link href={`/admin/companies/${detail.company.id}`}>
                    <span className="text-primary hover:underline">{detail.company.name}</span>
                  </Link>
                </div>
              )}
              {detail.role === "client" && (
                <div className="grid grid-cols-[120px_1fr] gap-1 items-start">
                  <span className="text-muted-foreground">Account type</span>
                  <span className="text-muted-foreground italic">Global Client — not owned by a company</span>
                </div>
              )}
            </div>

            <Separator className="mb-4" />

            {/* Related projects */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2 text-sm font-medium">
                <FolderOpen className="w-4 h-4 text-muted-foreground" />
                Related Projects
                <Badge variant="secondary" className="text-xs">{detail.projects.length}</Badge>
                {detail.pendingInviteCount > 0 && (
                  <Badge className="text-xs bg-orange-100 text-orange-700 border-0">
                    {detail.pendingInviteCount} pending invite{detail.pendingInviteCount !== 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
              {detail.projects.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No projects found.</p>
              ) : (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {detail.projects.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-md bg-muted/40 px-2 py-1.5 text-xs"
                    >
                      <a
                        href={`/admin/project/${p.id}`}
                        className="font-medium truncate text-primary hover:underline"
                        data-testid={`link-project-${p.id}`}
                      >
                        {p.name}
                      </a>
                      <div className="flex items-center gap-2 ml-2 shrink-0">
                        {p.companyName && (
                          <span className="text-muted-foreground">{p.companyName}</span>
                        )}
                        <Badge variant="outline" className="text-[10px] capitalize">{p.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator className="mb-4" />

            {/* Actions */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Actions</p>

              <Button
                size="sm"
                variant="outline"
                className="w-full justify-start"
                onClick={() => resetMutation.mutate(detail.id)}
                disabled={resetMutation.isPending || !detail.email}
                data-testid={`drawer-btn-reset-${detail.id}`}
                title={detail.email ? undefined : "No email on file"}
              >
                <Mail className="w-4 h-4 mr-2" />
                Send Password Reset
              </Button>

              {status === "pending" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full justify-start border-green-500 text-green-700 hover:bg-green-50"
                  onClick={() => approveMutation.mutate(detail.id)}
                  disabled={approveMutation.isPending}
                  data-testid={`drawer-btn-approve-${detail.id}`}
                >
                  <Check className="w-4 h-4 mr-2" />
                  Approve User
                </Button>
              )}

              {status !== "disabled" && !isSelf && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full justify-start border-red-400 text-red-600 hover:bg-red-50"
                  onClick={() => disableMutation.mutate(detail.id)}
                  disabled={disableMutation.isPending}
                  data-testid={`drawer-btn-disable-${detail.id}`}
                >
                  <UserX className="w-4 h-4 mr-2" />
                  Disable User
                </Button>
              )}

              {status === "disabled" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full justify-start border-blue-400 text-blue-600 hover:bg-blue-50"
                  onClick={() => reactivateMutation.mutate(detail.id)}
                  disabled={reactivateMutation.isPending}
                  data-testid={`drawer-btn-reactivate-${detail.id}`}
                >
                  <UserCheck className="w-4 h-4 mr-2" />
                  Reactivate User
                </Button>
              )}

              {detail.company && (
                <Link href={`/admin/companies/${detail.company.id}`}>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full justify-start text-muted-foreground"
                    data-testid={`drawer-btn-view-company-${detail.id}`}
                  >
                    <Building2 className="w-4 h-4 mr-2" />
                    View Company
                  </Button>
                </Link>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ── Shared user table ─────────────────────────────────────────────────────────

interface UserTableProps {
  users: UserWithoutPassword[];
  companies: { id: string; name: string }[];
  onViewUser: (id: string) => void;
  onApprove?: (id: string) => void;
  onDisable?: (id: string) => void;
  onReactivate?: (id: string) => void;
  onReset: (id: string) => void;
  currentAdminId: string;
  pendingMutationId?: string | null;
  emptyMessage?: string;
}

function UserTable({
  users,
  companies,
  onViewUser,
  onApprove,
  onDisable,
  onReactivate,
  onReset,
  currentAdminId,
  pendingMutationId,
  emptyMessage = "No users found.",
}: UserTableProps) {
  if (users.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground text-sm">{emptyMessage}</div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Company</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((u) => {
          const status = getUserStatus(u);
          const isSelf = u.id === currentAdminId;
          return (
            <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
              <TableCell className="font-medium">
                <button
                  className="text-primary hover:underline text-left"
                  onClick={() => onViewUser(u.id)}
                  data-testid={`btn-view-user-${u.id}`}
                >
                  {u.name || u.username || "—"}
                </button>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{u.email || "—"}</TableCell>
              <TableCell>
                <RoleBadge u={u} />
              </TableCell>
              <TableCell>
                <CompanyCell u={u} companies={companies} />
              </TableCell>
              <TableCell>
                <StatusBadge u={u} />
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1 flex-wrap">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onViewUser(u.id)}
                    data-testid={`btn-detail-user-${u.id}`}
                    title="View details"
                    className="h-7 w-7 p-0"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onReset(u.id)}
                    disabled={!u.email || pendingMutationId === u.id}
                    data-testid={`btn-reset-user-${u.id}`}
                    title={u.email ? "Send password reset" : "No email on file"}
                    className="h-7 w-7 p-0"
                  >
                    <Mail className="w-3.5 h-3.5" />
                  </Button>
                  {status === "pending" && onApprove && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onApprove(u.id)}
                      disabled={pendingMutationId === u.id}
                      data-testid={`btn-approve-user-${u.id}`}
                      title="Approve user"
                      className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  {status !== "disabled" && !isSelf && onDisable && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onDisable(u.id)}
                      disabled={pendingMutationId === u.id}
                      data-testid={`btn-disable-user-${u.id}`}
                      title="Disable user"
                      className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                    >
                      <UserX className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  {status === "disabled" && onReactivate && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onReactivate(u.id)}
                      disabled={pendingMutationId === u.id}
                      data-testid={`btn-reactivate-user-${u.id}`}
                      title="Reactivate user"
                      className="h-7 w-7 p-0 text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

// ── Pagination helper ─────────────────────────────────────────────────────────

function usePagination<T>(items: T[], pageSize: number) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const start = (page - 1) * pageSize;
  const paged = items.slice(start, Math.min(start + pageSize, items.length));

  const reset = useCallback(() => setPage(1), []);

  return { page, setPage, totalPages, start, paged, reset, total: items.length };
}

function PaginationBar({
  page,
  setPage,
  totalPages,
  start,
  end,
  total,
}: {
  page: number;
  setPage: (p: number) => void;
  totalPages: number;
  start: number;
  end: number;
  total: number;
}) {
  if (total === 0) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
      <span data-testid="pagination-info">
        {start + 1}–{end} of {total}
      </span>
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setPage(Math.max(1, page - 1))}
          disabled={page === 1}
          data-testid="btn-prev"
        >
          <ChevronLeft className="w-4 h-4" />
          Prev
        </Button>
        <span className="px-3 text-xs font-medium">
          {page} / {totalPages}
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setPage(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          data-testid="btn-next"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

export default function AdminUsers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const searchStr = useSearch();

  const filterCompanyIdFromUrl = useMemo(() => {
    const params = new URLSearchParams(searchStr);
    return params.get("companyId") ?? null;
  }, [searchStr]);

  const [activeTab, setActiveTab] = useState<string>(
    filterCompanyIdFromUrl ? "all" : "all"
  );
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState(filterCompanyIdFromUrl ?? "all");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const { data: allUsers = [], isLoading: usersLoading } = useQuery<UserWithoutPassword[]>({
    queryKey: ["/api/admin/users"],
    queryFn: () => apiRequest("GET", "/api/admin/users").then((r) => r.json()),
    enabled: user?.role === "admin",
  });

  const { data: companies = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/admin/companies"],
    queryFn: () => apiRequest("GET", "/api/admin/companies").then((r) => r.json()),
    enabled: user?.role === "admin",
  });

  const { data: pendingContractors = [] } = useQuery<UserWithoutPassword[]>({
    queryKey: ["/api/admin/contractors/pending"],
    queryFn: () => apiRequest("GET", "/api/admin/contractors/pending").then((r) => r.json()),
    enabled: user?.role === "admin",
  });

  const { data: legacyRequests = [] } = useQuery<ContractorRequest[]>({
    queryKey: ["/api/contractor-requests"],
    queryFn: () => apiRequest("GET", "/api/contractor-requests").then((r) => r.json()),
    enabled: user?.role === "admin",
  });

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/contractors/pending"] });
    if (selectedUserId) {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users", selectedUserId] });
    }
  }, [queryClient, selectedUserId]);

  const resetMutation = useMutation({
    mutationFn: (id: string) => {
      setPendingId(id);
      return apiRequest("POST", `/api/admin/users/${id}/send-password-reset`).then((r) => r.json());
    },
    onSuccess: (d) => { toast({ title: "Reset Sent", description: d.message }); setPendingId(null); },
    onError: (e: Error) => { toast({ title: "Failed", description: parseErrorMessage(e), variant: "destructive" }); setPendingId(null); },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => {
      setPendingId(id);
      return apiRequest("POST", `/api/admin/users/${id}/approve`).then((r) => r.json());
    },
    onSuccess: () => { toast({ title: "User Approved" }); setPendingId(null); invalidateAll(); },
    onError: (e: Error) => { toast({ title: "Failed", description: parseErrorMessage(e), variant: "destructive" }); setPendingId(null); },
  });

  const disableMutation = useMutation({
    mutationFn: (id: string) => {
      setPendingId(id);
      return apiRequest("PATCH", `/api/admin/users/${id}/disable`).then((r) => r.json());
    },
    onSuccess: () => { toast({ title: "User Disabled" }); setPendingId(null); invalidateAll(); },
    onError: (e: Error) => { toast({ title: "Failed", description: parseErrorMessage(e), variant: "destructive" }); setPendingId(null); },
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: string) => {
      setPendingId(id);
      return apiRequest("PATCH", `/api/admin/users/${id}/reactivate`).then((r) => r.json());
    },
    onSuccess: () => { toast({ title: "User Reactivated" }); setPendingId(null); invalidateAll(); },
    onError: (e: Error) => { toast({ title: "Failed", description: parseErrorMessage(e), variant: "destructive" }); setPendingId(null); },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => {
      setPendingId(id);
      return apiRequest("POST", `/api/admin/users/${id}/reject`).then((r) => r.json());
    },
    onSuccess: () => { toast({ title: "User Rejected & Removed" }); setPendingId(null); invalidateAll(); },
    onError: (e: Error) => { toast({ title: "Failed", description: parseErrorMessage(e), variant: "destructive" }); setPendingId(null); },
  });

  // Filter logic for the All Users / company owner / team / client tabs
  const filtered = useMemo(() => {
    let list = allUsers;

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) =>
          (u.name?.toLowerCase() || "").includes(q) ||
          (u.username?.toLowerCase() || "").includes(q) ||
          (u.email?.toLowerCase() || "").includes(q)
      );
    }

    if (roleFilter !== "all") {
      if (roleFilter === "contractor") {
        list = list.filter((u) => u.role === "contractor");
      } else {
        list = list.filter((u) => u.role === roleFilter);
      }
    }

    if (statusFilter !== "all") {
      if (statusFilter === "active") list = list.filter((u) => !u.isDisabled && u.isApproved !== false);
      else if (statusFilter === "pending") list = list.filter((u) => u.isApproved === false && !u.isDisabled);
      else if (statusFilter === "disabled") list = list.filter((u) => u.isDisabled);
    }

    // Company filter – for clients, match projects (here we do a simple companyId match on user for owners/members;
    // clients don't have companyId so they never match a company filter unless "all"
    if (companyFilter !== "all") {
      list = list.filter((u) => u.companyId === companyFilter);
    } else if (filterCompanyIdFromUrl) {
      list = list.filter((u) => u.companyId === filterCompanyIdFromUrl);
    }

    return list;
  }, [allUsers, search, roleFilter, statusFilter, companyFilter, filterCompanyIdFromUrl]);

  const owners = useMemo(() => filtered.filter((u) => u.role === "company_owner"), [filtered]);
  const teamMembers = useMemo(() => filtered.filter((u) => u.role === "contractor"), [filtered]);
  const clients = useMemo(() => filtered.filter((u) => u.role === "client"), [filtered]);
  const disabled = useMemo(() => allUsers.filter((u) => u.isDisabled), [allUsers]);

  const allPag = usePagination(filtered, PAGE_SIZE);
  const ownersPag = usePagination(owners, PAGE_SIZE);
  const teamPag = usePagination(teamMembers, PAGE_SIZE);
  const clientsPag = usePagination(clients, PAGE_SIZE);
  const disabledPag = usePagination(disabled, PAGE_SIZE);

  const filterCompanyName = useMemo(() => {
    if (!filterCompanyIdFromUrl) return null;
    return companies.find((c) => c.id === filterCompanyIdFromUrl)?.name ?? filterCompanyIdFromUrl;
  }, [filterCompanyIdFromUrl, companies]);

  const pendingCount = pendingContractors.length;
  const disabledCount = disabled.length;
  const legacyCount = legacyRequests.length;

  // Shared action handlers
  const sharedProps = {
    companies,
    onViewUser: setSelectedUserId,
    onApprove: (id: string) => approveMutation.mutate(id),
    onDisable: (id: string) => disableMutation.mutate(id),
    onReactivate: (id: string) => reactivateMutation.mutate(id),
    onReset: (id: string) => resetMutation.mutate(id),
    currentAdminId: user?.id ?? "",
    pendingMutationId: pendingId,
  };

  return (
    <SuperAdminLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-violet-600" />
          <h1 className="text-2xl font-bold text-foreground">Users & Approvals</h1>
        </div>

        {/* Company filter banner */}
        {filterCompanyIdFromUrl && (
          <div
            className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 px-4 py-3"
            data-testid="banner-company-filter"
          >
            <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="text-sm text-blue-800 dark:text-blue-300">
              Filtered to company{" "}
              <span className="font-semibold">{filterCompanyName}</span>
            </span>
            <Link href="/admin/users">
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto text-blue-700 dark:text-blue-300 hover:text-blue-900"
                data-testid="btn-clear-company-filter"
              >
                Clear filter
              </Button>
            </Link>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or username..."
              className="pl-9"
              value={search}
              onChange={(e) => { setSearch(e.target.value); allPag.reset(); }}
              data-testid="input-search-users"
            />
          </div>

          <Select
            value={roleFilter}
            onValueChange={(v) => { setRoleFilter(v); allPag.reset(); }}
          >
            <SelectTrigger className="w-[170px]" data-testid="select-role-filter">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="company_owner">Company Owner</SelectItem>
              <SelectItem value="contractor">Team Member</SelectItem>
              <SelectItem value="client">Client</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={(v) => { setStatusFilter(v); allPag.reset(); }}
          >
            <SelectTrigger className="w-[150px]" data-testid="select-status-filter">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
            </SelectContent>
          </Select>

          {!filterCompanyIdFromUrl && (
            <Select
              value={companyFilter}
              onValueChange={(v) => { setCompanyFilter(v); allPag.reset(); }}
            >
              <SelectTrigger className="w-[180px]" data-testid="select-company-filter">
                <SelectValue placeholder="All Companies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="all" data-testid="tab-all-users">
              All Users
              <Badge variant="secondary" className="ml-1.5 text-xs">{filtered.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="owners" data-testid="tab-company-owners">
              Company Owners
              <Badge variant="secondary" className="ml-1.5 text-xs">{owners.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="team" data-testid="tab-team-members">
              Team Members
              <Badge variant="secondary" className="ml-1.5 text-xs">{teamMembers.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="clients" data-testid="tab-clients">
              Clients
              <Badge variant="secondary" className="ml-1.5 text-xs">{clients.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="pending" data-testid="tab-pending">
              Pending Approvals
              {pendingCount > 0 && (
                <Badge className="ml-1.5 text-xs bg-orange-100 text-orange-700 border-0">{pendingCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="disabled" data-testid="tab-disabled">
              Disabled
              {disabledCount > 0 && (
                <Badge className="ml-1.5 text-xs bg-red-100 text-red-700 border-0">{disabledCount}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* All Users */}
          <TabsContent value="all">
            <Card>
              <CardContent className="p-0">
                {usersLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    <UserTable {...sharedProps} users={allPag.paged} emptyMessage="No users match your filters." />
                    <PaginationBar
                      page={allPag.page}
                      setPage={allPag.setPage}
                      totalPages={allPag.totalPages}
                      start={allPag.start}
                      end={Math.min(allPag.start + PAGE_SIZE, allPag.total)}
                      total={allPag.total}
                    />
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Company Owners */}
          <TabsContent value="owners">
            <Card>
              <CardContent className="p-0">
                <UserTable {...sharedProps} users={ownersPag.paged} emptyMessage="No company owners found." />
                <PaginationBar
                  page={ownersPag.page}
                  setPage={ownersPag.setPage}
                  totalPages={ownersPag.totalPages}
                  start={ownersPag.start}
                  end={Math.min(ownersPag.start + PAGE_SIZE, ownersPag.total)}
                  total={ownersPag.total}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Team Members */}
          <TabsContent value="team">
            <Card>
              <CardContent className="p-0">
                <UserTable {...sharedProps} users={teamPag.paged} emptyMessage="No team members found." />
                <PaginationBar
                  page={teamPag.page}
                  setPage={teamPag.setPage}
                  totalPages={teamPag.totalPages}
                  start={teamPag.start}
                  end={Math.min(teamPag.start + PAGE_SIZE, teamPag.total)}
                  total={teamPag.total}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Clients */}
          <TabsContent value="clients">
            <Card>
              <CardContent className="p-0">
                <div className="px-4 py-3 border-b bg-muted/30 text-xs text-muted-foreground flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  Clients are global users and are not owned by a company. They are related to companies through projects.
                </div>
                <UserTable {...sharedProps} users={clientsPag.paged} emptyMessage="No clients found." />
                <PaginationBar
                  page={clientsPag.page}
                  setPage={clientsPag.setPage}
                  totalPages={clientsPag.totalPages}
                  start={clientsPag.start}
                  end={Math.min(clientsPag.start + PAGE_SIZE, clientsPag.total)}
                  total={clientsPag.total}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pending Approvals */}
          <TabsContent value="pending">
            <Card>
              <CardContent className="p-0">
                {pendingCount === 0 ? (
                  <div className="py-12 text-center">
                    <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm">No pending approvals.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingContractors.map((u) => (
                        <TableRow key={u.id} data-testid={`row-pending-${u.id}`}>
                          <TableCell className="font-medium">
                            <button
                              className="text-primary hover:underline text-left"
                              onClick={() => setSelectedUserId(u.id)}
                            >
                              {u.name || u.username || "—"}
                            </button>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{u.email || "—"}</TableCell>
                          <TableCell><RoleBadge u={u} /></TableCell>
                          <TableCell><CompanyCell u={u} companies={companies} /></TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-green-500 text-green-600 hover:bg-green-50 h-7 text-xs"
                                onClick={() => approveMutation.mutate(u.id)}
                                disabled={pendingId === u.id}
                                data-testid={`btn-approve-pending-${u.id}`}
                              >
                                <Check className="w-3.5 h-3.5 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-red-400 text-red-600 hover:bg-red-50 h-7 text-xs"
                                onClick={() => rejectMutation.mutate(u.id)}
                                disabled={pendingId === u.id}
                                data-testid={`btn-reject-pending-${u.id}`}
                              >
                                <X className="w-3.5 h-3.5 mr-1" />
                                Reject
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
          </TabsContent>

          {/* Disabled Users */}
          <TabsContent value="disabled">
            <Card>
              <CardContent className="p-0">
                <UserTable
                  {...sharedProps}
                  users={disabledPag.paged}
                  emptyMessage="No disabled users."
                />
                <PaginationBar
                  page={disabledPag.page}
                  setPage={disabledPag.setPage}
                  totalPages={disabledPag.totalPages}
                  start={disabledPag.start}
                  end={Math.min(disabledPag.start + PAGE_SIZE, disabledPag.total)}
                  total={disabledPag.total}
                />
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>

        {/* Legacy Access Requests — collapsible, shown only when records exist */}
        {legacyCount > 0 && (
          <details className="mt-6 group" data-testid="section-legacy-requests">
            <summary className="flex items-center gap-2 cursor-pointer list-none select-none rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 px-4 py-2.5 text-sm font-medium text-amber-800 dark:text-amber-300 hover:bg-amber-100 transition-colors">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Legacy Access Requests
              <Badge variant="secondary" className="ml-1 text-xs">{legacyCount}</Badge>
              <span className="ml-auto text-xs font-normal text-amber-600 group-open:hidden">Click to expand</span>
              <span className="ml-auto text-xs font-normal text-amber-600 hidden group-open:inline">Click to collapse</span>
            </summary>
            <Card className="mt-2 border-amber-200">
              <CardContent className="p-0">
                <div className="px-4 py-2.5 border-b bg-amber-50 dark:bg-amber-950/20 text-xs text-amber-700 dark:text-amber-400">
                  These are legacy access requests from the old public signup flow. Public access requests are now
                  disabled. These records are read-only for historical reference.
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {legacyRequests.map((r) => (
                      <TableRow key={r.id} data-testid={`row-legacy-${r.id}`}>
                        <TableCell className="font-medium">
                          {r.firstName} {r.lastName}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{r.username}</TableCell>
                        <TableCell>{r.companyName}</TableCell>
                        <TableCell>{r.companyType}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              r.status === "approved"
                                ? "text-green-700 border-green-400"
                                : r.status === "rejected"
                                ? "text-red-700 border-red-400"
                                : "text-orange-700 border-orange-400"
                            }
                          >
                            {r.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </details>
        )}
      </div>

      {/* User detail drawer */}
      <UserDetailDrawer
        userId={selectedUserId}
        onClose={() => setSelectedUserId(null)}
        onActionDone={() => { invalidateAll(); setSelectedUserId(null); }}
        currentAdminId={user?.id ?? ""}
      />
    </SuperAdminLayout>
  );
}
