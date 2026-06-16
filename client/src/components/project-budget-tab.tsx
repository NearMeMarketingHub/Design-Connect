import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, parseErrorMessage } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DollarSign, AlertCircle, FileText, TrendingUp, TrendingDown, Pencil, Trash2, Plus } from "lucide-react";

type ProjectBudget = {
  id: string;
  projectId: string;
  companyId: string;
  sourceEstimateId: string | null;
  title: string;
  status: string;
  totalEstimated: string;
  totalActual: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type ProjectBudgetItem = {
  id: string;
  budgetId: string;
  category: string;
  description: string;
  quantity: string;
  unit: string;
  unitCostEstimated: string;
  totalEstimated: string;
  totalActual: string;
  notes: string | null;
  displayOrder: number;
};

type Estimate = {
  id: string;
  customId: string;
  clientName: string;
  projectName: string;
  amount: string;
  status: string;
  date: string;
  projectId: string | null;
  companyId: string | null;
};

type BudgetResult = { budget: ProjectBudget; items: ProjectBudgetItem[] } | null;

function formatCurrency(value: string | number | null | undefined): string {
  const n = parseFloat(String(value ?? "0"));
  if (isNaN(n)) return "$0.00";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatSignedCurrency(value: number): string {
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString("en-US", { style: "currency", currency: "USD" });
  return value < 0 ? `-${formatted}` : formatted;
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700 border-gray-200",
    active: "bg-green-100 text-green-700 border-green-200",
    locked: "bg-blue-100 text-blue-700 border-blue-200",
  };
  const cls = variants[status] ?? "bg-gray-100 text-gray-700 border-gray-200";
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

const BUDGET_STATUSES = ["draft", "active", "locked"] as const;

const UNIT_OPTIONS = ["EA", "SF", "LF", "HR", "LS", "CY", "SY", "TON", "GAL", "LB"];

type ItemFormState = {
  category: string;
  description: string;
  quantity: string;
  unit: string;
  unitCostEstimated: string;
  notes: string;
};

const emptyItemForm = (): ItemFormState => ({
  category: "",
  description: "",
  quantity: "",
  unit: "EA",
  unitCostEstimated: "",
  notes: "",
});

function itemFormFromItem(item: ProjectBudgetItem): ItemFormState {
  return {
    category: item.category,
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    unitCostEstimated: item.unitCostEstimated,
    notes: item.notes ?? "",
  };
}

interface ProjectBudgetTabProps {
  projectId: string;
  canWrite: boolean;
}

export default function ProjectBudgetTab({ projectId, canWrite }: ProjectBudgetTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedEstimateId, setSelectedEstimateId] = useState<string>("");
  const [showEstimateFlow, setShowEstimateFlow] = useState(false);

  const [createEmptyDialogOpen, setCreateEmptyDialogOpen] = useState(false);
  const [emptyBudgetTitle, setEmptyBudgetTitle] = useState("");
  const [emptyBudgetNotes, setEmptyBudgetNotes] = useState("");

  const [editBudgetOpen, setEditBudgetOpen] = useState(false);
  const [editBudgetTitle, setEditBudgetTitle] = useState("");
  const [editBudgetStatus, setEditBudgetStatus] = useState<string>("draft");
  const [editBudgetNotes, setEditBudgetNotes] = useState("");

  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ProjectBudgetItem | null>(null);
  const [itemForm, setItemForm] = useState<ItemFormState>(emptyItemForm());

  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  const {
    data: budgetResult,
    isLoading: budgetLoading,
    isError: budgetError,
    error: budgetErrorObj,
  } = useQuery<BudgetResult>({
    queryKey: ["/api/projects", projectId, "budget"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/projects/${projectId}/budget`);
      return res.json();
    },
    enabled: !!projectId,
  });

  const {
    data: allEstimates = [],
    isLoading: estimatesLoading,
  } = useQuery<Estimate[]>({
    queryKey: ["/api/estimates"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/estimates");
      return res.json();
    },
    enabled: canWrite && budgetResult === null && !budgetLoading,
  });

  const projectEstimates = allEstimates
    .filter((e) => e.projectId === projectId)
    .sort((a, b) => {
      if (a.status === "approved" && b.status !== "approved") return -1;
      if (b.status === "approved" && a.status !== "approved") return 1;
      return 0;
    });

  const approvedEstimates = projectEstimates.filter((e) => e.status === "approved");

  const invalidateBudget = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "budget"] });
    queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
    queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}`] });
    queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/projects", projectId] });
  };

  const createBudgetMutation = useMutation({
    mutationFn: async (sourceEstimateId: string) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/budget`, {
        sourceEstimateId,
      });
      return res.json();
    },
    onSuccess: () => {
      invalidateBudget();
      setSelectedEstimateId("");
      setShowEstimateFlow(false);
      toast({ title: "Budget created", description: "Project budget created from estimate." });
    },
    onError: (err: unknown) => {
      toast({ title: "Could not create budget", description: parseErrorMessage(err), variant: "destructive" });
    },
  });

  const createEmptyBudgetMutation = useMutation({
    mutationFn: async ({ title, notes }: { title: string; notes: string }) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/budget`, {
        title: title.trim(),
        notes: notes.trim() || null,
      });
      return res.json();
    },
    onSuccess: () => {
      invalidateBudget();
      setCreateEmptyDialogOpen(false);
      setEmptyBudgetTitle("");
      setEmptyBudgetNotes("");
      toast({ title: "Budget created", description: "Empty project budget created." });
    },
    onError: (err: unknown) => {
      toast({ title: "Could not create budget", description: parseErrorMessage(err), variant: "destructive" });
    },
  });

  const updateBudgetMutation = useMutation({
    mutationFn: async (data: { title: string; status: string; notes: string }) => {
      const res = await apiRequest("PATCH", `/api/projects/${projectId}/budget`, {
        title: data.title.trim(),
        status: data.status,
        notes: data.notes.trim() || null,
      });
      return res.json();
    },
    onSuccess: () => {
      invalidateBudget();
      setEditBudgetOpen(false);
      toast({ title: "Budget updated", description: "Budget details saved." });
    },
    onError: (err: unknown) => {
      toast({ title: "Could not update budget", description: parseErrorMessage(err), variant: "destructive" });
    },
  });

  const createItemMutation = useMutation({
    mutationFn: async (data: ItemFormState) => {
      const qty = parseFloat(data.quantity);
      const cost = parseFloat(data.unitCostEstimated);
      const total = parseFloat((qty * cost).toFixed(2));
      const res = await apiRequest("POST", `/api/projects/${projectId}/budget/items`, {
        category: data.category.trim(),
        description: data.description.trim(),
        quantity: qty,
        unit: data.unit.trim(),
        unitCostEstimated: cost,
        totalEstimated: total,
        notes: data.notes.trim() || null,
      });
      return res.json();
    },
    onSuccess: () => {
      invalidateBudget();
      setItemDialogOpen(false);
      setItemForm(emptyItemForm());
      toast({ title: "Item added", description: "Budget line item added." });
    },
    onError: (err: unknown) => {
      toast({ title: "Could not add item", description: parseErrorMessage(err), variant: "destructive" });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ItemFormState }) => {
      const qty = parseFloat(data.quantity);
      const cost = parseFloat(data.unitCostEstimated);
      const total = parseFloat((qty * cost).toFixed(2));
      const res = await apiRequest("PATCH", `/api/projects/${projectId}/budget/items/${id}`, {
        category: data.category.trim(),
        description: data.description.trim(),
        quantity: qty,
        unit: data.unit.trim(),
        unitCostEstimated: cost,
        totalEstimated: total,
        notes: data.notes.trim() || null,
      });
      return res.json();
    },
    onSuccess: () => {
      invalidateBudget();
      setItemDialogOpen(false);
      setEditingItem(null);
      setItemForm(emptyItemForm());
      toast({ title: "Item updated", description: "Budget line item updated." });
    },
    onError: (err: unknown) => {
      toast({ title: "Could not update item", description: parseErrorMessage(err), variant: "destructive" });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      await apiRequest("DELETE", `/api/projects/${projectId}/budget/items/${itemId}`);
    },
    onSuccess: () => {
      invalidateBudget();
      setDeletingItemId(null);
      toast({ title: "Item deleted", description: "Budget line item removed." });
    },
    onError: (err: unknown) => {
      setDeletingItemId(null);
      toast({ title: "Could not delete item", description: parseErrorMessage(err), variant: "destructive" });
    },
  });

  function openEditBudget(budget: ProjectBudget) {
    setEditBudgetTitle(budget.title);
    setEditBudgetStatus(budget.status);
    setEditBudgetNotes(budget.notes ?? "");
    setEditBudgetOpen(true);
  }

  function openAddItem() {
    setEditingItem(null);
    setItemForm(emptyItemForm());
    setItemDialogOpen(true);
  }

  function openEditItem(item: ProjectBudgetItem) {
    setEditingItem(item);
    setItemForm(itemFormFromItem(item));
    setItemDialogOpen(true);
  }

  function handleItemFormSubmit() {
    const qty = parseFloat(itemForm.quantity);
    const cost = parseFloat(itemForm.unitCostEstimated);
    if (!itemForm.category.trim()) {
      toast({ title: "Validation error", description: "Category is required.", variant: "destructive" });
      return;
    }
    if (!itemForm.description.trim()) {
      toast({ title: "Validation error", description: "Description is required.", variant: "destructive" });
      return;
    }
    if (!itemForm.unit.trim()) {
      toast({ title: "Validation error", description: "Unit is required.", variant: "destructive" });
      return;
    }
    if (isNaN(qty) || qty <= 0) {
      toast({ title: "Validation error", description: "Quantity must be a positive number.", variant: "destructive" });
      return;
    }
    if (isNaN(cost) || cost < 0) {
      toast({ title: "Validation error", description: "Unit cost must be a non-negative number.", variant: "destructive" });
      return;
    }
    if (editingItem) {
      updateItemMutation.mutate({ id: editingItem.id, data: itemForm });
    } else {
      createItemMutation.mutate(itemForm);
    }
  }

  const itemFormPending = createItemMutation.isPending || updateItemMutation.isPending;

  const previewTotal =
    parseFloat(itemForm.quantity) > 0 && parseFloat(itemForm.unitCostEstimated) >= 0
      ? parseFloat((parseFloat(itemForm.quantity) * parseFloat(itemForm.unitCostEstimated)).toFixed(2))
      : null;

  if (budgetLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse space-y-3">
              <div className="h-6 bg-muted rounded w-1/3" />
              <div className="h-4 bg-muted rounded w-1/2" />
              <div className="h-4 bg-muted rounded w-2/3" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (budgetError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{parseErrorMessage(budgetErrorObj)}</AlertDescription>
      </Alert>
    );
  }

  if (!budgetResult) {
    return (
      <>
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-4 bg-muted rounded-full">
                <DollarSign className="h-8 w-8 text-muted-foreground" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold">No project budget yet.</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                Start tracking project costs by creating a budget from an approved estimate, or create an empty budget and add line items manually.
              </p>
            </div>

            {canWrite && (
              <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center items-center max-w-md mx-auto">
                {estimatesLoading ? (
                  <div className="h-9 bg-muted rounded animate-pulse w-48" />
                ) : (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Button
                            variant="outline"
                            disabled={approvedEstimates.length === 0 || createBudgetMutation.isPending}
                            onClick={() => setShowEstimateFlow((v) => !v)}
                            data-testid="button-create-budget-from-estimate"
                          >
                            <FileText className="h-4 w-4 mr-1.5" />
                            Create from Estimate
                          </Button>
                        </span>
                      </TooltipTrigger>
                      {approvedEstimates.length === 0 && (
                        <TooltipContent>
                          No approved estimates linked to this project yet.
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                )}

                <Button
                  onClick={() => {
                    setEmptyBudgetTitle("");
                    setEmptyBudgetNotes("");
                    setCreateEmptyDialogOpen(true);
                  }}
                  disabled={createEmptyBudgetMutation.isPending}
                  data-testid="button-create-empty-budget"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Create Empty Budget
                </Button>
              </div>
            )}

            {canWrite && showEstimateFlow && approvedEstimates.length > 0 && (
              <div className="pt-2 max-w-sm mx-auto space-y-3">
                <Select
                  value={selectedEstimateId}
                  onValueChange={setSelectedEstimateId}
                >
                  <SelectTrigger data-testid="select-source-estimate">
                    <SelectValue placeholder="Select an approved estimate…" />
                  </SelectTrigger>
                  <SelectContent>
                    {approvedEstimates.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        <span className="flex items-center gap-2">
                          {e.projectName || e.customId}
                          <span className="text-xs text-muted-foreground">({e.status})</span>
                          <span className="text-xs font-medium">{formatCurrency(e.amount)}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  className="w-full"
                  disabled={!selectedEstimateId || createBudgetMutation.isPending}
                  onClick={() => {
                    if (selectedEstimateId) createBudgetMutation.mutate(selectedEstimateId);
                  }}
                  data-testid="button-confirm-create-from-estimate"
                >
                  {createBudgetMutation.isPending ? "Creating…" : "Create Budget from Estimate"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Empty Budget Dialog */}
        <Dialog open={createEmptyDialogOpen} onOpenChange={setCreateEmptyDialogOpen}>
          <DialogContent className="sm:max-w-md" data-testid="dialog-create-empty-budget">
            <DialogHeader>
              <DialogTitle>Create Empty Budget</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="empty-budget-title">
                  Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="empty-budget-title"
                  value={emptyBudgetTitle}
                  onChange={(e) => setEmptyBudgetTitle(e.target.value.slice(0, 120))}
                  placeholder="e.g. Kitchen Renovation Budget"
                  maxLength={120}
                  data-testid="input-empty-budget-title"
                />
                <p className="text-xs text-muted-foreground text-right">
                  {emptyBudgetTitle.length}/120
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="empty-budget-notes">
                  Notes <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Textarea
                  id="empty-budget-notes"
                  value={emptyBudgetNotes}
                  onChange={(e) => setEmptyBudgetNotes(e.target.value)}
                  placeholder="Optional notes about this budget…"
                  rows={3}
                  data-testid="textarea-empty-budget-notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCreateEmptyDialogOpen(false)}
                disabled={createEmptyBudgetMutation.isPending}
                data-testid="button-cancel-empty-budget"
              >
                Cancel
              </Button>
              <Button
                onClick={() =>
                  createEmptyBudgetMutation.mutate({
                    title: emptyBudgetTitle,
                    notes: emptyBudgetNotes,
                  })
                }
                disabled={createEmptyBudgetMutation.isPending || !emptyBudgetTitle.trim()}
                data-testid="button-confirm-empty-budget"
              >
                {createEmptyBudgetMutation.isPending ? "Creating…" : "Create Budget"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  const { budget, items } = budgetResult;
  const totalEstimated = parseFloat(budget.totalEstimated ?? "0");
  const totalActual = parseFloat(budget.totalActual ?? "0");
  const variance = totalEstimated - totalActual;

  return (
    <div className="space-y-6">
      {/* Budget summary card */}
      <Card data-testid="card-budget-summary">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                {budget.title}
              </CardTitle>
              {budget.sourceEstimateId && (
                <CardDescription>
                  <FileText className="h-3.5 w-3.5 inline mr-1" />
                  Created from estimate
                </CardDescription>
              )}
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={budget.status} />
              {canWrite && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openEditBudget(budget)}
                  data-testid="button-edit-budget"
                >
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  Edit Budget
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Total Estimated
              </p>
              <p className="text-xl font-semibold" data-testid="text-total-estimated">
                {formatCurrency(budget.totalEstimated)}
              </p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Total Actual
              </p>
              <p className="text-xl font-semibold text-muted-foreground">
                {formatCurrency(budget.totalActual)}
              </p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Variance
              </p>
              <p className={`text-xl font-semibold flex items-center gap-1 ${variance >= 0 ? "text-green-600" : "text-red-600"}`} data-testid="text-variance">
                {variance >= 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                {formatSignedCurrency(variance)}
              </p>
            </div>
          </div>
          {budget.notes && (
            <p className="mt-4 text-sm text-muted-foreground border-t pt-3" data-testid="text-budget-notes">
              {budget.notes}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Budget items table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">Budget Line Items</CardTitle>
              <CardDescription>
                {items.length} item{items.length !== 1 ? "s" : ""}
              </CardDescription>
            </div>
            {canWrite && (
              <Button
                size="sm"
                variant="outline"
                onClick={openAddItem}
                data-testid="button-add-budget-item"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Budget Item
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="p-6 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                {canWrite ? "No budget items yet." : "No budget items have been added to this budget."}
              </p>
              {canWrite && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={openAddItem}
                  data-testid="button-add-budget-item-empty"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Budget Item
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table data-testid="table-budget-items">
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Unit Cost Est.</TableHead>
                    <TableHead className="text-right">Total Est.</TableHead>
                    <TableHead>Notes</TableHead>
                    {canWrite && <TableHead className="w-20">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id} data-testid={`row-budget-item-${item.id}`}>
                      <TableCell className="font-medium">{item.category}</TableCell>
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-right">
                        {parseFloat(item.quantity).toLocaleString()}
                      </TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.unitCostEstimated)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(item.totalEstimated)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {item.notes ?? "—"}
                      </TableCell>
                      {canWrite && (
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => openEditItem(item)}
                              data-testid={`button-edit-item-${item.id}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              <span className="sr-only">Edit item</span>
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => setDeletingItemId(item.id)}
                              data-testid={`button-delete-item-${item.id}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span className="sr-only">Delete item</span>
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Budget dialog */}
      <Dialog open={editBudgetOpen} onOpenChange={setEditBudgetOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-edit-budget">
          <DialogHeader>
            <DialogTitle>Edit Budget</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-budget-title">Title</Label>
              <Input
                id="edit-budget-title"
                value={editBudgetTitle}
                onChange={(e) => setEditBudgetTitle(e.target.value)}
                placeholder="Budget title"
                data-testid="input-budget-title"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-budget-status">Status</Label>
              <Select value={editBudgetStatus} onValueChange={setEditBudgetStatus}>
                <SelectTrigger id="edit-budget-status" data-testid="select-budget-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BUDGET_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-budget-notes">Notes</Label>
              <Textarea
                id="edit-budget-notes"
                value={editBudgetNotes}
                onChange={(e) => setEditBudgetNotes(e.target.value)}
                placeholder="Optional notes…"
                rows={3}
                data-testid="textarea-budget-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditBudgetOpen(false)}
              disabled={updateBudgetMutation.isPending}
              data-testid="button-cancel-edit-budget"
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                updateBudgetMutation.mutate({
                  title: editBudgetTitle,
                  status: editBudgetStatus,
                  notes: editBudgetNotes,
                })
              }
              disabled={updateBudgetMutation.isPending || !editBudgetTitle.trim()}
              data-testid="button-save-edit-budget"
            >
              {updateBudgetMutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Budget Item dialog */}
      <Dialog
        open={itemDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setItemDialogOpen(false);
            setEditingItem(null);
            setItemForm(emptyItemForm());
          }
        }}
      >
        <DialogContent className="sm:max-w-lg" data-testid="dialog-budget-item">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Budget Item" : "Add Budget Item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="item-category">Category</Label>
                <Input
                  id="item-category"
                  value={itemForm.category}
                  onChange={(e) => setItemForm((f) => ({ ...f, category: e.target.value }))}
                  placeholder="e.g. Electrical"
                  data-testid="input-item-category"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="item-unit">Unit</Label>
                <Input
                  id="item-unit"
                  list="unit-options"
                  value={itemForm.unit}
                  onChange={(e) => setItemForm((f) => ({ ...f, unit: e.target.value }))}
                  placeholder="EA"
                  data-testid="input-item-unit"
                />
                <datalist id="unit-options">
                  {UNIT_OPTIONS.map((u) => <option key={u} value={u} />)}
                </datalist>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-description">Description</Label>
              <Input
                id="item-description"
                value={itemForm.description}
                onChange={(e) => setItemForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Line item description"
                data-testid="input-item-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="item-quantity">Quantity</Label>
                <Input
                  id="item-quantity"
                  type="number"
                  min="0.01"
                  step="any"
                  value={itemForm.quantity}
                  onChange={(e) => setItemForm((f) => ({ ...f, quantity: e.target.value }))}
                  placeholder="1"
                  data-testid="input-item-quantity"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="item-unit-cost">Unit Cost ($)</Label>
                <Input
                  id="item-unit-cost"
                  type="number"
                  min="0"
                  step="any"
                  value={itemForm.unitCostEstimated}
                  onChange={(e) => setItemForm((f) => ({ ...f, unitCostEstimated: e.target.value }))}
                  placeholder="0.00"
                  data-testid="input-item-unit-cost"
                />
              </div>
            </div>
            {previewTotal !== null && (
              <p className="text-sm text-muted-foreground">
                Total Estimated: <span className="font-medium text-foreground">{formatCurrency(previewTotal)}</span>
              </p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="item-notes">Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                id="item-notes"
                value={itemForm.notes}
                onChange={(e) => setItemForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optional notes…"
                rows={2}
                data-testid="textarea-item-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setItemDialogOpen(false);
                setEditingItem(null);
                setItemForm(emptyItemForm());
              }}
              disabled={itemFormPending}
              data-testid="button-cancel-item"
            >
              Cancel
            </Button>
            <Button
              onClick={handleItemFormSubmit}
              disabled={itemFormPending}
              data-testid="button-save-item"
            >
              {itemFormPending ? "Saving…" : editingItem ? "Save Changes" : "Add Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation AlertDialog */}
      <AlertDialog
        open={!!deletingItemId}
        onOpenChange={(open) => { if (!open) setDeletingItemId(null); }}
      >
        <AlertDialogContent data-testid="dialog-delete-item">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete budget item?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the line item from the budget. Budget totals will be recalculated. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-item">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deletingItemId) deleteItemMutation.mutate(deletingItemId); }}
              data-testid="button-confirm-delete-item"
            >
              {deleteItemMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
