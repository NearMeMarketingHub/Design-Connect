import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, AlertCircle, Wallet } from "lucide-react";

interface Expense {
  id: string;
  companyId: string;
  projectId: string | null;
  budgetItemId: string | null;
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

interface BudgetItem {
  id: string;
  category: string;
  description: string;
  budgetId: string;
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
  budgetItemId: "",
  paymentMethod: "",
  status: "pending",
  notes: "",
};

interface ProjectExpensesTabProps {
  projectId: string;
  canWrite: boolean;
}

export default function ProjectExpensesTab({ projectId, canWrite }: ProjectExpensesTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [submitError, setSubmitError] = useState("");

  const { data: expenses = [], isLoading, isError } = useQuery<Expense[]>({
    queryKey: ["/api/projects", projectId, "expenses"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/expenses`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load expenses");
      return res.json();
    },
    enabled: !!projectId,
  });

  const { data: budgetResult } = useQuery<{ budget: { id: string }; items: BudgetItem[] } | null>({
    queryKey: ["/api/projects", projectId, "budget"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/budget`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: dialogOpen && canWrite,
  });
  const budgetItems: BudgetItem[] = budgetResult?.items ?? [];

  const invalidateExpenses = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "expenses"] });
    queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "budget"] });
    queryClient.invalidateQueries({ queryKey: ["/api/company/expenses"] });
  };

  const createMutation = useMutation({
    mutationFn: async (data: typeof emptyForm) => {
      const res = await fetch("/api/company/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...data,
          projectId,
          budgetItemId: data.budgetItemId || null,
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
      invalidateExpenses();
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
          projectId,
          budgetItemId: data.budgetItemId || null,
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
      invalidateExpenses();
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
      invalidateExpenses();
      toast({ title: "Expense deleted" });
      setDeleteTarget(null);
    },
    onError: () =>
      toast({ title: "Error", description: "Could not delete expense", variant: "destructive" }),
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
      budgetItemId: expense.budgetItemId ?? "",
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

  const total = expenses.reduce((sum, e) => sum + parseFloat(e.amount ?? "0"), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-orange-600" />
          <h2 className="text-lg font-semibold">Project Expenses</h2>
          {expenses.length > 0 && (
            <span className="text-sm text-muted-foreground">
              — {expenses.length} record{expenses.length !== 1 ? "s" : ""}, total {fmt(String(total))}
            </span>
          )}
        </div>
        {canWrite && (
          <Button size="sm" onClick={openCreate} data-testid="button-add-project-expense">
            <Plus className="w-4 h-4 mr-1" />
            Add Expense
          </Button>
        )}
      </div>

      <div className="rounded-lg border bg-card">
        {isLoading && (
          <div className="p-6 space-y-3" data-testid="project-expenses-loading">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        )}
        {isError && (
          <div className="flex items-center gap-2 p-6 text-destructive text-sm" data-testid="project-expenses-error">
            <AlertCircle className="w-4 h-4" />
            <span>Failed to load expenses. Please refresh and try again.</span>
          </div>
        )}
        {!isLoading && !isError && expenses.length === 0 && (
          <div className="p-12 text-center text-muted-foreground text-sm" data-testid="project-expenses-empty">
            No expenses recorded for this project yet.
            {canWrite && (
              <div className="mt-3">
                <Button size="sm" variant="outline" onClick={openCreate} data-testid="button-add-project-expense-empty">
                  <Plus className="w-4 h-4 mr-1" />
                  Add Expense
                </Button>
              </div>
            )}
          </div>
        )}
        {!isLoading && !isError && expenses.length > 0 && (
          <Table data-testid="project-expenses-table">
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Description / Vendor</TableHead>
                <TableHead>Budget Item</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                {canWrite && <TableHead className="w-20" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((expense) => {
                const linkedItem = budgetItems.find((b) => b.id === expense.budgetItemId);
                return (
                  <TableRow key={expense.id} data-testid={`row-project-expense-${expense.id}`}>
                    <TableCell className="text-sm whitespace-nowrap">{expense.expenseDate}</TableCell>
                    <TableCell className="text-sm">{expense.category}</TableCell>
                    <TableCell className="text-sm">
                      <div>{expense.description}</div>
                      {expense.vendorName && (
                        <div className="text-xs text-muted-foreground">{expense.vendorName}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {linkedItem ? `${linkedItem.category} — ${linkedItem.description}` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`text-xs capitalize ${STATUS_COLORS[expense.status] ?? "bg-gray-100 text-gray-700"}`}
                        data-testid={`badge-project-expense-status-${expense.id}`}
                      >
                        {expense.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium text-sm" data-testid={`text-project-expense-amount-${expense.id}`}>
                      {fmt(expense.amount)}
                    </TableCell>
                    {canWrite && (
                      <TableCell>
                        <div className="flex items-center gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEdit(expense)}
                            data-testid={`button-edit-project-expense-${expense.id}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(expense)}
                            data-testid={`button-delete-project-expense-${expense.id}`}
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
        <DialogContent className="max-w-lg" data-testid="dialog-project-expense-form">
          <DialogHeader>
            <DialogTitle>{editingExpense ? "Edit Expense" : "Add Expense"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="pe-category">Category *</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
                >
                  <SelectTrigger id="pe-category" data-testid="select-pe-category">
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
                <Label htmlFor="pe-date">Date *</Label>
                <Input
                  id="pe-date"
                  type="date"
                  value={form.expenseDate}
                  onChange={(e) => setForm((f) => ({ ...f, expenseDate: e.target.value }))}
                  data-testid="input-pe-date"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pe-description">Description *</Label>
              <Input
                id="pe-description"
                placeholder="e.g. 2x4 lumber for framing"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                data-testid="input-pe-description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="pe-amount">Amount ($) *</Label>
                <Input
                  id="pe-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  data-testid="input-pe-amount"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pe-vendor">Vendor</Label>
                <Input
                  id="pe-vendor"
                  placeholder="Vendor name"
                  value={form.vendorName}
                  onChange={(e) => setForm((f) => ({ ...f, vendorName: e.target.value }))}
                  data-testid="input-pe-vendor"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="pe-payment-method">Payment Method</Label>
                <Select
                  value={form.paymentMethod || "none"}
                  onValueChange={(v) => setForm((f) => ({ ...f, paymentMethod: v === "none" ? "" : v }))}
                >
                  <SelectTrigger id="pe-payment-method" data-testid="select-pe-payment-method">
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

              <div className="space-y-1.5">
                <Label htmlFor="pe-status">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
                >
                  <SelectTrigger id="pe-status" data-testid="select-pe-status">
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
            </div>

            {canWrite && (
              <div className="space-y-1.5">
                <Label htmlFor="pe-budget-item">Budget Line Item</Label>
                <Select
                  value={form.budgetItemId || "none"}
                  onValueChange={(v) => setForm((f) => ({ ...f, budgetItemId: v === "none" ? "" : v }))}
                >
                  <SelectTrigger id="pe-budget-item" data-testid="select-pe-budget-item">
                    <SelectValue placeholder="Not linked to budget" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not linked to budget</SelectItem>
                    {budgetItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.category} — {item.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {budgetItems.length === 0 && (
                  <p className="text-xs text-muted-foreground">No budget line items for this project yet.</p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="pe-notes">Notes</Label>
              <Textarea
                id="pe-notes"
                placeholder="Optional notes"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                data-testid="textarea-pe-notes"
              />
            </div>

            {submitError && (
              <p className="text-sm text-destructive" data-testid="text-pe-error">
                {submitError}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                data-testid="button-pe-cancel"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isMutating} data-testid="button-pe-submit">
                {isMutating ? "Saving…" : editingExpense ? "Save Changes" : "Add Expense"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent data-testid="dialog-project-expense-delete">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <span className="font-medium">{deleteTarget?.description}</span>{" "}
              ({deleteTarget && fmt(deleteTarget.amount)}).
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-pe-delete-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-pe-delete-confirm"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
