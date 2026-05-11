import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiRequest, parseErrorMessage } from "@/lib/queryClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { SuperAdminLayout } from "@/components/super-admin-layout";
import { CreateCompanyDialog } from "@/components/create-company-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Link } from "wouter";
import {
  Building2,
  Search,
  Plus,
  Eye,
  Mail,
  Pencil,
  Ban,
  PlayCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface AdminCompany {
  id: string;
  name: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerUserId?: string;
  companyType?: string;
  subscriptionStatus?: string;
  monthlyPrice?: string | null;
  trialStartedAt?: string | null;
  trialEndsAt?: string | null;
  userCount?: number;
  projectCount?: number;
}

export default function AdminCompanies() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [companySearch, setCompanySearch] = useState("");
  const [companyStatusFilter, setCompanyStatusFilter] = useState("all");
  const [companiesPage, setCompaniesPage] = useState(1);
  const [companiesPageSize, setCompaniesPageSize] = useState(25);

  const [createCompanyOpen, setCreateCompanyOpen] = useState(false);
  const [companySubDialogOpen, setCompanySubDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<AdminCompany | null>(null);
  const [companySubForm, setCompanySubForm] = useState({
    subscriptionStatus: "trialing",
  });

  useEffect(() => {
    setCompaniesPage(1);
  }, [companySearch, companyStatusFilter]);

  const { data: allCompaniesRaw = [] } = useQuery<AdminCompany[]>({
    queryKey: ["/api/admin/companies"],
    queryFn: () => apiRequest("GET", "/api/admin/companies").then((r) => r.json()),
    enabled: user?.role === "admin",
  });

  const { data: companies = [] } = useQuery<AdminCompany[]>({
    queryKey: ["/api/admin/companies", companySearch, companyStatusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (companySearch) params.set("search", companySearch);
      if (companyStatusFilter !== "all") params.set("status", companyStatusFilter);
      const qs = params.toString();
      return apiRequest("GET", `/api/admin/companies${qs ? `?${qs}` : ""}`).then((r) => r.json());
    },
    enabled: user?.role === "admin",
  });

  const companiesTotalPages = Math.max(1, Math.ceil(companies.length / companiesPageSize));
  const companiesStart = (companiesPage - 1) * companiesPageSize;
  const companiesEnd = Math.min(companiesStart + companiesPageSize, companies.length);
  const pagedCompanies = companies.slice(companiesStart, companiesEnd);

  const updateCompanySubMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof companySubForm }) =>
      apiRequest("PATCH", `/api/admin/companies/${id}/subscription`, data).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies"] });
      setCompanySubDialogOpen(false);
      toast({ title: "Access updated" });
    },
    onError: (err: Error) =>
      toast({ title: "Error", description: parseErrorMessage(err), variant: "destructive" }),
  });

  const suspendCompanyMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("PATCH", `/api/admin/companies/${id}/suspend`).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies"] });
      toast({ title: "Company suspended" });
    },
    onError: (err: Error) =>
      toast({ title: "Error", description: parseErrorMessage(err), variant: "destructive" }),
  });

  const reactivateCompanyMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("PATCH", `/api/admin/companies/${id}/reactivate`).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies"] });
      toast({ title: "Company reactivated" });
    },
    onError: (err: Error) =>
      toast({ title: "Error", description: parseErrorMessage(err), variant: "destructive" }),
  });

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

  const openCompanySubEdit = (company: AdminCompany) => {
    setEditingCompany(company);
    setCompanySubForm({
      subscriptionStatus: company.subscriptionStatus || "trialing",
    });
    setCompanySubDialogOpen(true);
  };

  return (
    <SuperAdminLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            <h1 className="text-2xl font-bold text-foreground">Companies</h1>
          </div>
          <Button
            size="sm"
            onClick={() => setCreateCompanyOpen(true)}
            data-testid="button-create-company"
          >
            <Plus className="w-4 h-4 mr-1" /> Create Company
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or owner email..."
              className="pl-9"
              value={companySearch}
              onChange={(e) => setCompanySearch(e.target.value)}
              data-testid="input-search-companies"
            />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {(["all", "active", "trialing", "suspended", "expired"] as const).map((status) => (
              <button
                key={status}
                onClick={() => setCompanyStatusFilter(status)}
                data-testid={`filter-company-${status}`}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors capitalize ${
                  companyStatusFilter === status
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                {status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {allCompaniesRaw.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No companies registered yet.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Access Status</TableHead>
                    <TableHead>Monthly Price</TableHead>
                    <TableHead>Trial Ends</TableHead>
                    <TableHead className="text-center">Users</TableHead>
                    <TableHead className="text-center">Projects</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedCompanies.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="text-center text-muted-foreground py-8"
                      >
                        No companies match your search.
                      </TableCell>
                    </TableRow>
                  )}
                  {pagedCompanies.map((company) => {
                    const trialEnd = company.trialEndsAt
                      ? new Date(company.trialEndsAt)
                      : company.trialStartedAt
                      ? new Date(new Date(company.trialStartedAt).getTime() + 7 * 24 * 60 * 60 * 1000)
                      : null;
                    const now = new Date();
                    const isSuspended = company.subscriptionStatus === "suspended";
                    const isExpired =
                      company.subscriptionStatus === "expired" ||
                      (company.subscriptionStatus === "trialing" &&
                        trialEnd &&
                        now > trialEnd);
                    const price = company.monthlyPrice ? parseFloat(company.monthlyPrice) : null;
                    return (
                      <TableRow key={company.id} data-testid={`company-row-${company.id}`}>
                        <TableCell className="font-medium">{company.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {company.ownerName || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {company.companyType || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              company.subscriptionStatus === "active"
                                ? "default"
                                : isSuspended
                                ? "destructive"
                                : isExpired
                                ? "destructive"
                                : "secondary"
                            }
                            className="capitalize text-xs"
                          >
                            {isSuspended
                              ? "Suspended"
                              : isExpired && company.subscriptionStatus !== "expired"
                              ? "Expired"
                              : company.subscriptionStatus}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {price === null
                            ? "—"
                            : price === 0
                            ? "Free"
                            : `$${price % 1 === 0 ? price.toFixed(0) : price.toFixed(2)}/mo`}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {trialEnd ? trialEnd.toLocaleDateString() : "—"}
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          {company.userCount ?? 0}
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          {company.projectCount ?? 0}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1.5 flex-wrap">
                            <Link href={`/admin/companies/${company.id}`}>
                              <Button
                                size="sm"
                                variant="ghost"
                                title="View company detail"
                                data-testid={`button-view-company-${company.id}`}
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                            </Link>
                            {company.ownerUserId && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  sendPasswordResetMutation.mutate(company.ownerUserId!)
                                }
                                disabled={
                                  sendPasswordResetMutation.isPending || !company.ownerEmail
                                }
                                data-testid={`button-send-reset-${company.id}`}
                                title={
                                  company.ownerEmail
                                    ? `Send password reset to ${company.ownerEmail}`
                                    : "Owner has no email"
                                }
                              >
                                <Mail className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openCompanySubEdit(company)}
                              data-testid={`button-edit-sub-${company.id}`}
                            >
                              <Pencil className="w-3.5 h-3.5 mr-1" />
                              Edit Access
                            </Button>
                            {isSuspended ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600 border-green-300 hover:bg-green-50"
                                onClick={() => reactivateCompanyMutation.mutate(company.id)}
                                disabled={reactivateCompanyMutation.isPending}
                                data-testid={`button-reactivate-${company.id}`}
                              >
                                <PlayCircle className="w-3.5 h-3.5 mr-1" />
                                Reactivate
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 border-red-200 hover:bg-red-50"
                                onClick={() => suspendCompanyMutation.mutate(company.id)}
                                disabled={suspendCompanyMutation.isPending}
                                data-testid={`button-suspend-${company.id}`}
                              >
                                <Ban className="w-3.5 h-3.5 mr-1" />
                                Suspend
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {companies.length > 0 && (
                <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span data-testid="companies-pagination-info">
                      Showing {companiesStart + 1}–{companiesEnd} of {companies.length}
                    </span>
                    <span className="text-xs">·</span>
                    <label className="text-xs flex items-center gap-1.5">
                      Rows per page
                      <Select
                        value={String(companiesPageSize)}
                        onValueChange={(val) => {
                          setCompaniesPageSize(Number(val));
                          setCompaniesPage(1);
                        }}
                      >
                        <SelectTrigger
                          className="h-7 w-[70px] text-xs"
                          data-testid="select-companies-page-size"
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
                      onClick={() => setCompaniesPage((p) => Math.max(1, p - 1))}
                      disabled={companiesPage === 1}
                      data-testid="button-companies-prev"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </Button>
                    <span className="px-3 text-xs font-medium">
                      Page {companiesPage} of {companiesTotalPages}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setCompaniesPage((p) => Math.min(companiesTotalPages, p + 1))
                      }
                      disabled={companiesPage === companiesTotalPages}
                      data-testid="button-companies-next"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <CreateCompanyDialog
        open={createCompanyOpen}
        onOpenChange={setCreateCompanyOpen}
      />

      <Dialog open={companySubDialogOpen} onOpenChange={setCompanySubDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Access</DialogTitle>
            <DialogDescription>
              Update plan and status for {editingCompany?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={companySubForm.subscriptionStatus}
                onValueChange={(v) =>
                  setCompanySubForm((f) => ({ ...f, subscriptionStatus: v }))
                }
              >
                <SelectTrigger data-testid="select-company-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trialing">Trialing</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="past_due">Past Due</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCompanySubDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                editingCompany &&
                updateCompanySubMutation.mutate({
                  id: editingCompany.id,
                  data: companySubForm,
                })
              }
              disabled={updateCompanySubMutation.isPending}
              data-testid="button-save-company-sub"
            >
              {updateCompanySubMutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SuperAdminLayout>
  );
}
