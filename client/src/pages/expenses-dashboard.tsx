import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Wallet, Plus, Pencil, Trash2, ChevronLeft, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Expense {
  id: string;
  companyId: string;
  projectId: string | null;
  vendorName: string | null;
  category: string;
  description: string;
  amount: string;
  expenseDate: string;
  paymentMethod: string | null;
  status: string;
  notes: string | null;
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

interface Project {
  id: string;
  name: string;
}

const EXPENSE_STATUSES = ["pending", "approved", "reimbursed", "rejected", "paid"] as const;
const EXPENSE_CATEGORIES = [
  "Materials",
  "Labor",
  "Equipment",
  "Subcontractor",
  "Permits & Fees",
  "Tools",
  "Fuel & Travel",
  "Office & Admin",
  "Utilities",
  "Insurance",
  "Other",
];
const PAYMENT_METHODS = ["cash", "check", "card", "transfer", "other"];

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  reimbursed: "bg-blue-100 text-blue-800",
  rejected: "bg-red-100 text-red-800",
  paid: "bg-purple-100 text-purple-800",
};

function fmt(amount: string): string {
  const n = parseFloat(amount);
  if (isNaN(n)) return "—";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const emptyForm = {
  category: "",
  description: "",
  amount: "",
  expenseDate: today(),
  vendorName: "",
  projectId: "",
  paymentMethod: "",
  status: "pending",
  notes: "",
};

export default function ExpensesDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isWriter =
    user?.role === "company_owner" ||
    (user?.role === "contractor" &&
      user?.isCompanyAdmin === true &&
      user?.contractorType !== "subcontractor" &&
      user?.contractorType !== "notary");

  // Filters
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterProject, setFilterProject] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [submitError, setSubmitError] = useState("");

  // Build query params
  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    if (filterStatus !== "all") p.set("status", filterStatus);
    if (filterCategory !== "all") p.set("category", filterCategory);
    if (filterProject !== "all") p.set("projectId", filterProject);
    if (filterDateFrom) p.set("dateFrom", filterDateFrom);
    if (filterDateTo) p.set("dateTo", filterDateTo);
    return p.toString();
  }, [filterStatus, filterCategory, filterProject, filterDateFrom, filterDateTo]);

  const { data: expenses = [], isLoading, isError } = useQuery<Expense[]>({
    queryKey: ["/api/company/expenses", queryParams],
    queryFn: async () => {
      const url = "/api/company/expenses" + (queryParams ? `?${queryParams}` : "");
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load expenses");
      return res.json();
    },
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const total = useMemo(
    () => expenses.reduce((sum, e) => sum + parseFloat(e.amount ?? "0"), 0),
    [expenses]
  );

  const createMutation = useMutation({
    mutationFn: async (data: typeof emptyForm) => {
      const res = await fetch("/api/company/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...data,
          projectId: data.projectId || null,
          vendorName: data.vendorName || null,
          paymentMethod: data.paymentMethod || null,
          notes: data.notes || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? "Failed to create expense");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/expenses"] });
      setDialogOpen(false);
      toast({ title: "Expense added" });
    },
    onError: (err: Error) => setSubmitError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof emptyForm }) => {
      const res = await fetch(`/api/company/expenses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...data,
          projectId: data.projectId || null,
          vendorName: data.vendorName || null,
          paymentMethod: data.paymentMethod || null,
          notes: data.notes || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? "Failed to update expense");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/expenses"] });
      setDialogOpen(false);
      toast({ title: "Expense updated" });
    },
    onError: (err: Error) => setSubmitError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/company/expenses/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok && res.status !== 204) throw new Error("Failed to delete expense");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/expenses"] });
      toast({ title: "Expense deleted" });
      setDeleteTarget(null);
    },
    onError: () => toast({ title: "Error", description: "Could not delete expense", variant: "destructive" }),
  });

  function openCreate() {
    setEditingExpense(null);
    setForm({ ...emptyForm });
    setSubmitError("");
    setDialogOpen(true);
  }

  function openEdit(expense: Expense) {
    setEditingExpense(expense);
    setForm({
      category: expense.category,
      description: expense.description,
      amount: expense.amount,
      expenseDate: expense.expenseDate,
      vendorName: expense.vendorName ?? "",
      projectId: expense.projectId ?? "",
      paymentMethod: expense.paymentMethod ?? "",
      status: expense.status,
      notes: expense.notes ?? "",
    });
    setSubmitError("");
    setDialogOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");
    if (!form.category) { setSubmitError("Category is required"); return; }
    if (!form.description.trim()) { setSubmitError("Description is required"); return; }
    const amt = parseFloat(form.amount);
    if (isNaN(amt) || amt <= 0) { setSubmitError("Amount must be a positive number"); return; }
    if (!form.expenseDate) { setSubmitError("Date is required"); return; }

    if (editingExpense) {
      updateMutation.mutate({ id: editingExpense.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  }

  const isMutating = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/company/financials">
          <Button variant="ghost" size="sm" className="gap-1" data-testid="button-back-financials">
            <ChevronLeft className="w-4 h-4" />
            Financials
          </Button>
        </Link>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-orange-600" />
          <h1 className="text-2xl font-bold text-foreground">Expenses</h1>
        </div>
        {isWriter && (
          <Button size="sm" onClick={openCreate} data-testid="button-add-expense">
            <Plus className="w-4 h-4 mr-1" />
            Add Expense
          </Button>
        )}
      </div>

      {/* Totals strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-normal">Total (filtered)</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-semibold text-foreground" data-testid="text-expenses-total">
              {fmt(String(total))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-normal">Pending</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-semibold text-yellow-700" data-testid="text-expenses-pending">
              {fmt(String(expenses.filter(e => e.status === "pending").reduce((s, e) => s + parseFloat(e.amount ?? "0"), 0)))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs text-muted-foreground font-normal">Count</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-semibold text-foreground" data-testid="text-expenses-count">
              {expenses.length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36 h-8 text-sm" data-testid="select-filter-status">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {EXPENSE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Category</Label>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-44 h-8 text-sm" data-testid="select-filter-category">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {EXPENSE_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Project</Label>
          <Select value={filterProject} onValueChange={setFilterProject}>
            <SelectTrigger className="w-48 h-8 text-sm" data-testid="select-filter-project">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {(projects as Project[]).map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">From</Label>
          <Input
            type="date"
            className="h-8 text-sm w-36"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            data-testid="input-filter-date-from"
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">To</Label>
          <Input
            type="date"
            className="h-8 text-sm w-36"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            data-testid="input-filter-date-to"
          />
        </div>

        {(filterStatus !== "all" || filterCategory !== "all" || filterProject !== "all" || filterDateFrom || filterDateTo) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              setFilterStatus("all");
              setFilterCategory("all");
              setFilterProject("all");
              setFilterDateFrom("");
              setFilterDateTo("");
            }}
            data-testid="button-clear-filters"
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        {isLoading && (
          <div className="p-6 space-y-3" data-testid="expenses-loading">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        )}
        {isError && (
          <div className="flex items-center gap-2 p-6 text-destructive text-sm" data-testid="expenses-error">
            <AlertCircle className="w-4 h-4" />
            <span>Failed to load expenses. Please refresh and try again.</span>
          </div>
        )}
        {!isLoading && !isError && expenses.length === 0 && (
          <div className="p-12 text-center text-muted-foreground text-sm" data-testid="expenses-empty">
            No expenses found. {isWriter && "Click \"Add Expense\" to record your first one."}
          </div>
        )}
        {!isLoading && !isError && expenses.length > 0 && (
          <Table data-testid="expenses-table">
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                {isWriter && <TableHead className="w-20" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((expense) => {
                const proj = (projects as Project[]).find((p) => p.id === expense.projectId);
                return (
                  <TableRow key={expense.id} data-testid={`row-expense-${expense.id}`}>
                    <TableCell className="text-sm whitespace-nowrap">{expense.expenseDate}</TableCell>
                    <TableCell className="text-sm">{expense.category}</TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate" title={expense.description}>
                      {expense.description}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {expense.vendorName ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {proj ? (
                        <Link href={`/projects/${proj.id}`} className="hover:underline text-blue-600">
                          {proj.name}
                        </Link>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground capitalize">
                      {expense.paymentMethod ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`text-xs capitalize ${STATUS_COLORS[expense.status] ?? "bg-gray-100 text-gray-700"}`}
                        data-testid={`badge-status-${expense.id}`}
                      >
                        {expense.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium text-sm" data-testid={`text-amount-${expense.id}`}>
                      {fmt(expense.amount)}
                    </TableCell>
                    {isWriter && (
                      <TableCell>
                        <div className="flex items-center gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEdit(expense)}
                            data-testid={`button-edit-expense-${expense.id}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(expense)}
                            data-testid={`button-delete-expense-${expense.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg" data-testid="dialog-expense-form">
          <DialogHeader>
            <DialogTitle>{editingExpense ? "Edit Expense" : "Add Expense"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="expense-category">Category *</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
                >
                  <SelectTrigger id="expense-category" data-testid="select-expense-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="expense-date">Date *</Label>
                <Input
                  id="expense-date"
                  type="date"
                  value={form.expenseDate}
                  onChange={(e) => setForm((f) => ({ ...f, expenseDate: e.target.value }))}
                  data-testid="input-expense-date"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="expense-description">Description *</Label>
              <Input
                id="expense-description"
                placeholder="e.g. 2x4 lumber for framing"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                data-testid="input-expense-description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="expense-amount">Amount ($) *</Label>
                <Input
                  id="expense-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  data-testid="input-expense-amount"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="expense-vendor">Vendor</Label>
                <Input
                  id="expense-vendor"
                  placeholder="Vendor name"
                  value={form.vendorName}
                  onChange={(e) => setForm((f) => ({ ...f, vendorName: e.target.value }))}
                  data-testid="input-expense-vendor"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="expense-project">Project</Label>
                <Select
                  value={form.projectId || "none"}
                  onValueChange={(v) => setForm((f) => ({ ...f, projectId: v === "none" ? "" : v }))}
                >
                  <SelectTrigger id="expense-project" data-testid="select-expense-project">
                    <SelectValue placeholder="No project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No project</SelectItem>
                    {(projects as Project[]).map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="expense-payment-method">Payment Method</Label>
                <Select
                  value={form.paymentMethod || "none"}
                  onValueChange={(v) => setForm((f) => ({ ...f, paymentMethod: v === "none" ? "" : v }))}
                >
                  <SelectTrigger id="expense-payment-method" data-testid="select-expense-payment-method">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="expense-status">Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
              >
                <SelectTrigger id="expense-status" data-testid="select-expense-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="expense-notes">Notes</Label>
              <Textarea
                id="expense-notes"
                placeholder="Optional notes"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                data-testid="textarea-expense-notes"
              />
            </div>

            {submitError && (
              <p className="text-sm text-destructive" data-testid="text-expense-error">
                {submitError}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                data-testid="button-expense-cancel"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isMutating} data-testid="button-expense-submit">
                {isMutating ? "Saving…" : editingExpense ? "Save Changes" : "Add Expense"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent data-testid="dialog-expense-delete">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <span className="font-medium">{deleteTarget?.description}</span> ({deleteTarget && fmt(deleteTarget.amount)}).
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-expense-delete-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-expense-delete-confirm"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
