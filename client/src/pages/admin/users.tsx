import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiRequest, parseErrorMessage } from "@/lib/queryClient";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { Link } from "wouter";
import {
  Users,
  Search,
  Mail,
  ChevronLeft,
  ChevronRight,
  Building2,
  ExternalLink,
} from "lucide-react";
import type { User } from "@shared/schema";

export default function AdminUsers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const searchStr = useSearch();

  const filterCompanyId = useMemo(() => {
    const params = new URLSearchParams(searchStr);
    return params.get("companyId") ?? null;
  }, [searchStr]);

  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [usersPage, setUsersPage] = useState(1);
  const [usersPageSize, setUsersPageSize] = useState(25);

  useEffect(() => {
    setUsersPage(1);
  }, [userSearch, userRoleFilter, filterCompanyId]);

  const { data: allUsersRaw = [] } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    queryFn: () => apiRequest("GET", "/api/admin/users").then((r) => r.json()),
    enabled: user?.role === "admin",
  });

  const { data: filteredUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/admin/users", userSearch, userRoleFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (userSearch) params.set("search", userSearch);
      if (userRoleFilter !== "all") params.set("role", userRoleFilter);
      const qs = params.toString();
      return apiRequest("GET", `/api/admin/users${qs ? `?${qs}` : ""}`).then((r) => r.json());
    },
    enabled: user?.role === "admin",
  });

  const displayedUsers = useMemo(() => {
    if (!filterCompanyId) return filteredUsers;
    return filteredUsers.filter((u) => u.companyId === filterCompanyId);
  }, [filteredUsers, filterCompanyId]);

  const usersTotalPages = Math.max(1, Math.ceil(displayedUsers.length / usersPageSize));
  const usersStart = (usersPage - 1) * usersPageSize;
  const usersEnd = Math.min(usersStart + usersPageSize, displayedUsers.length);
  const pagedUsers = displayedUsers.slice(usersStart, usersEnd);

  const sendPasswordResetMutation = useMutation({
    mutationFn: (userId: string) =>
      apiRequest("POST", `/api/admin/users/${userId}/send-password-reset`).then((r) => r.json()),
    onSuccess: (data) => toast({ title: "Password Reset Sent", description: data.message }),
    onError: (err: Error) =>
      toast({
        title: "Failed to Send Reset",
        description: parseErrorMessage(err),
        variant: "destructive",
      }),
  });

  const filterCompanyName = displayedUsers[0]?.companyName;

  return (
    <SuperAdminLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-violet-600" />
            <h1 className="text-2xl font-bold text-foreground">Users</h1>
          </div>
          <Link href="/admin/contractors">
            <Button size="sm" variant="outline" data-testid="link-full-user-management">
              <ExternalLink className="w-4 h-4 mr-1.5" />
              Full Users & Approvals
            </Button>
          </Link>
        </div>

        {filterCompanyId && (
          <div
            className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 px-4 py-3"
            data-testid="banner-company-filter"
          >
            <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="text-sm text-blue-800 dark:text-blue-300">
              Filtered to company{" "}
              <span className="font-semibold">{filterCompanyName ?? filterCompanyId}</span>
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

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              className="pl-9"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              data-testid="input-search-users"
            />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { value: "all", label: "All" },
              { value: "admin", label: "Admin" },
              { value: "company_owner", label: "Company Owner" },
              { value: "contractor", label: "Contractor" },
              { value: "client", label: "Client" },
            ].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setUserRoleFilter(value)}
                data-testid={`filter-user-${value}`}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  userRoleFilter === value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
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
                {pagedUsers.map((u) => (
                  <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
                    <TableCell className="font-medium">
                      {u.name || u.username || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.email || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize text-xs">
                        {u.role?.replace("_", " ") || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {u.isApproved === false ? (
                        <Badge
                          variant="secondary"
                          className="bg-orange-100 text-orange-700 text-xs"
                        >
                          Pending
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="bg-green-100 text-green-700 text-xs"
                        >
                          Active
                        </Badge>
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
                {displayedUsers.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-muted-foreground py-8"
                    >
                      {allUsersRaw.length === 0 ? "No users found." : "No users match your search."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {displayedUsers.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span data-testid="users-pagination-info">
                    Showing {usersStart + 1}–{usersEnd} of {displayedUsers.length}
                  </span>
                  <span className="text-xs">·</span>
                  <label className="text-xs flex items-center gap-1.5">
                    Rows per page
                    <Select
                      value={String(usersPageSize)}
                      onValueChange={(val) => {
                        setUsersPageSize(Number(val));
                        setUsersPage(1);
                      }}
                    >
                      <SelectTrigger
                        className="h-7 w-[70px] text-xs"
                        data-testid="select-users-page-size"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[10, 25, 50, 100].map((n) => (
                          <SelectItem key={n} value={String(n)} className="text-xs">
                            {n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setUsersPage((p) => Math.max(1, p - 1))}
                    disabled={usersPage === 1}
                    data-testid="button-users-prev"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </Button>
                  <span className="px-3 text-xs font-medium">
                    Page {usersPage} of {usersTotalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setUsersPage((p) => Math.min(usersTotalPages, p + 1))}
                    disabled={usersPage === usersTotalPages}
                    data-testid="button-users-next"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SuperAdminLayout>
  );
}
