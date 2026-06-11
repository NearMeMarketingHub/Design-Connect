import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, parseErrorMessage } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { DollarSign, AlertCircle, FileText, TrendingUp, TrendingDown } from "lucide-react";

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

interface ProjectBudgetTabProps {
  projectId: string;
  canWrite: boolean;
}

export default function ProjectBudgetTab({ projectId, canWrite }: ProjectBudgetTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedEstimateId, setSelectedEstimateId] = useState<string>("");

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

  const createBudgetMutation = useMutation({
    mutationFn: async (sourceEstimateId: string) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/budget`, {
        sourceEstimateId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "budget"] });
      setSelectedEstimateId("");
      toast({
        title: "Budget created",
        description: "Project budget created from estimate.",
      });
    },
    onError: (err: unknown) => {
      toast({
        title: "Could not create budget",
        description: parseErrorMessage(err),
        variant: "destructive",
      });
    },
  });

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
              Create a budget from an approved estimate to start tracking planned project costs.
            </p>
          </div>

          {canWrite && (
            <div className="pt-2 max-w-sm mx-auto space-y-3">
              {estimatesLoading ? (
                <div className="h-9 bg-muted rounded animate-pulse" />
              ) : projectEstimates.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  No estimates available for this project yet.
                </p>
              ) : (
                <>
                  <Select
                    value={selectedEstimateId}
                    onValueChange={setSelectedEstimateId}
                    data-testid="select-source-estimate"
                  >
                    <SelectTrigger data-testid="select-source-estimate">
                      <SelectValue placeholder="Select an estimate…" />
                    </SelectTrigger>
                    <SelectContent>
                      {projectEstimates.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          <span className="flex items-center gap-2">
                            {e.projectName || e.customId}
                            <span className="text-xs text-muted-foreground">
                              ({e.status})
                            </span>
                            <span className="text-xs font-medium">
                              {formatCurrency(e.amount)}
                            </span>
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
                    data-testid="button-create-budget"
                  >
                    {createBudgetMutation.isPending ? "Creating…" : "Create Budget from Estimate"}
                  </Button>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
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
            <StatusBadge status={budget.status} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Total Estimated
              </p>
              <p className="text-xl font-semibold">{formatCurrency(budget.totalEstimated)}</p>
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
              <p className={`text-xl font-semibold flex items-center gap-1 ${variance >= 0 ? "text-green-600" : "text-red-600"}`}>
                {variance >= 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                {formatCurrency(Math.abs(variance))}
              </p>
            </div>
          </div>
          {budget.notes && (
            <p className="mt-4 text-sm text-muted-foreground border-t pt-3">{budget.notes}</p>
          )}
        </CardContent>
      </Card>

      {/* Budget items table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Budget Line Items</CardTitle>
          <CardDescription>
            {items.length} item{items.length !== 1 ? "s" : ""} — snapshot from source estimate
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No budget items found.
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
