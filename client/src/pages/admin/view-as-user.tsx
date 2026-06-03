import { useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { Eye, Search, Building2, User, FolderOpen, Loader2, X, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ViewAsUser {
  id: string;
  username: string;
  name: string | null;
  email: string;
  role: string;
  companyId: string | null;
  companyName: string | null;
  relatedCompanyId: string | null;
  relatedCompanyName: string | null;
  projectCount: number;
  isDisabled: boolean;
  isApproved: boolean | null;
  isSandbox: boolean;
}

interface AdminCompany {
  id: string;
  name: string;
}

const ROLE_LABELS: Record<string, string> = {
  company_owner: "Company Owner",
  client: "Client",
};

const ROLE_COLORS: Record<string, string> = {
  company_owner: "bg-blue-100 text-blue-700",
  client: "bg-green-100 text-green-700",
};

export default function AdminViewAsUser() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [pending, setPending] = useState<ViewAsUser | null>(null);
  const [starting, setStarting] = useState(false);

  const hasActiveFilters = search !== "" || roleFilter !== "all" || companyFilter !== "all";

  const resetFilters = () => {
    setSearch("");
    setRoleFilter("all");
    setCompanyFilter("all");
  };

  const queryParams = useMemo(() => {
    const p: Record<string, string> = {};
    if (search) p.search = search;
    if (roleFilter !== "all") p.role = roleFilter;
    if (companyFilter !== "all") p.companyId = companyFilter;
    return new URLSearchParams(p).toString();
  }, [search, roleFilter, companyFilter]);

  const { data: users = [], isLoading } = useQuery<ViewAsUser[]>({
    queryKey: ["/api/admin/view-as/users", queryParams],
    queryFn: () =>
      apiRequest("GET", `/api/admin/view-as/users?${queryParams}`).then((r) => r.json()),
    enabled: user?.role === "admin",
  });

  const { data: companies = [] } = useQuery<AdminCompany[]>({
    queryKey: ["/api/admin/companies"],
    queryFn: () =>
      apiRequest("GET", "/api/admin/companies?limit=500").then((r) =>
        r.json().then((d: any) => d.companies ?? d)
      ),
    enabled: user?.role === "admin",
  });

  const startViewAs = async (target: ViewAsUser) => {
    setStarting(true);
    setPending(null);
    try {
      const res = await apiRequest("POST", "/api/admin/view-as", { userId: target.id });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? "Failed to start view-as session");
      }
      const data = await res.json();
      // Reload the page to pick up the session change, then navigate to target dashboard
      window.location.href = data.targetDashboard;
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setStarting(false);
    }
  };

  return (
    <SuperAdminLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">View As User</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Browse the platform from a company owner's or client's perspective. Your admin session
            is preserved and a visible banner lets you exit at any time.
          </p>
        </div>

        {/* Safety callout */}
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
          <CardContent className="p-4 flex gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800 dark:text-amber-300">
              <span className="font-semibold">Support tool only.</span> A yellow banner will appear
              across all pages while a View As session is active. Click "Exit View As" at any time
              to return here. All sessions are logged in the Audit Log.
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-8 h-9"
                  placeholder="Search by name, email, or username…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  data-testid="input-view-as-search"
                />
              </div>

              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="h-9 w-44" data-testid="select-role-filter">
                  <SelectValue placeholder="All roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All roles</SelectItem>
                  <SelectItem value="company_owner">Company Owners</SelectItem>
                  <SelectItem value="client">Clients</SelectItem>
                </SelectContent>
              </Select>

              <Select value={companyFilter} onValueChange={setCompanyFilter}>
                <SelectTrigger className="h-9 w-48" data-testid="select-company-filter">
                  <SelectValue placeholder="All companies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All companies</SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                  className="h-9 text-muted-foreground hover:text-foreground gap-1.5"
                  data-testid="button-reset-filters"
                >
                  <X className="w-3.5 h-3.5" />
                  Reset Filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Results table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : users.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center" data-testid="view-as-empty-state">
                <div className="p-3 bg-muted rounded-full">
                  <Eye className="w-6 h-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {hasActiveFilters ? "No users match your filters." : "No eligible users found."}
                  </p>
                  {hasActiveFilters && (
                    <button
                      onClick={resetFilters}
                      className="text-xs text-primary hover:underline mt-1"
                      data-testid="button-reset-filters-empty"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead className="w-28">Projects</TableHead>
                      <TableHead className="w-24">Status</TableHead>
                      <TableHead className="w-28 text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => {
                      const isEligible = !u.isDisabled && u.isApproved !== false;
                      return (
                        <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                                <User className="w-3.5 h-3.5 text-muted-foreground" />
                              </div>
                              <div>
                                <div className="text-sm font-medium">{u.name ?? u.username}</div>
                                {u.name && (
                                  <div className="text-xs text-muted-foreground">@{u.username}</div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                          <TableCell>
                            <Badge className={`text-xs border-0 font-medium ${ROLE_COLORS[u.role] ?? "bg-gray-100 text-gray-700"}`}>
                              {ROLE_LABELS[u.role] ?? u.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {u.relatedCompanyName ? (
                              <div className="flex items-center gap-1.5 text-sm">
                                <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                <span className="truncate max-w-36">{u.relatedCompanyName}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <FolderOpen className="w-3.5 h-3.5 shrink-0" />
                              {u.projectCount}
                            </div>
                          </TableCell>
                          <TableCell>
                            {u.isDisabled ? (
                              <Badge className="text-xs border-0 bg-red-100 text-red-700">Disabled</Badge>
                            ) : u.isApproved === false ? (
                              <Badge className="text-xs border-0 bg-yellow-100 text-yellow-700">Pending</Badge>
                            ) : (
                              <Badge className="text-xs border-0 bg-green-100 text-green-700">Active</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {isEligible ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1.5"
                                onClick={() => setPending(u)}
                                disabled={starting}
                                data-testid={`button-view-as-${u.id}`}
                              >
                                <Eye className="w-3.5 h-3.5" />
                                View As
                              </Button>
                            ) : (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs gap-1.5 opacity-40 cursor-not-allowed"
                                      disabled
                                      data-testid={`button-view-as-disabled-${u.id}`}
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                      View As
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {u.isDisabled ? "Account is disabled" : "Account is pending approval"}
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Confirmation dialog */}
      <AlertDialog open={!!pending} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent data-testid="dialog-confirm-view-as">
          <AlertDialogHeader>
            <AlertDialogTitle>Start View As session?</AlertDialogTitle>
            <AlertDialogDescription>
              You will be viewing the app as{" "}
              <strong>{pending?.name ?? pending?.username}</strong>{" "}
              ({pending?.email}). A yellow banner will appear on every page. You can exit at any
              time. This session will be logged in the Audit Log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-view-as">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pending && startViewAs(pending)}
              disabled={starting}
              data-testid="button-confirm-view-as"
            >
              {starting && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              Start Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SuperAdminLayout>
  );
}
