import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Plus, Trash2, Save, FileText, AlertTriangle, FolderOpen } from "lucide-react";
import type { Project, Estimate, EstimateLineItem } from "@shared/schema";

type LineItem = {
  _id: number;
  category: string;
  item: string;
  quantity: number;
  unit: string;
  rate: number;
  total: number;
};

type EstimateWithLineItems = Estimate & { lineItems: EstimateLineItem[] };

const UNITS = ["EA", "SF", "LF", "HR", "LS", "CY", "SY", "LB", "GAL", "TON"];
const CATEGORIES = ["Labor", "Materials", "Equipment", "Subcontractor", "Permits", "Overhead", "Other"];
const BLOCKED_STATUSES = new Set(["suspended", "cancelled", "expired", "trialing", "past_due"]);

function generateCustomId() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rand = Math.random().toString(16).slice(2, 6).toUpperCase();
  return `EST-${y}${m}${day}-${rand}`;
}

function formatCurrency(n: number) {
  if (isNaN(n)) return "$0.00";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  const s = status.toLowerCase();
  if (s === "approved") return "default";
  if (s === "sent") return "secondary";
  if (s === "rejected") return "destructive";
  return "outline";
}

export default function Estimator() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [projectClientName, setProjectClientName] = useState<string>("");
  const [isFetchingClient, setIsFetchingClient] = useState(false);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [lineItemCounter, setLineItemCounter] = useState(0);
  const [loadedEstimateId, setLoadedEstimateId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({
    category: "Materials",
    item: "",
    quantity: "1",
    unit: "EA",
    rate: "0",
  });

  const { data: projects = [], isLoading: projectsLoading, isError: projectsError } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    queryFn: () => apiRequest("GET", "/api/projects").then((r) => r.json()),
  });

  const { data: estimates = [], isLoading: estimatesLoading, isError: estimatesError } = useQuery<Estimate[]>({
    queryKey: ["/api/estimates"],
    queryFn: () => apiRequest("GET", "/api/estimates").then((r) => r.json()),
  });

  const { data: company } = useQuery({
    queryKey: ["/api/company/mine"],
    queryFn: () => apiRequest("GET", "/api/company/mine").then((r) => r.json()),
    enabled: user?.role === "company_owner" || user?.isCompanyAdmin === true,
  });

  const isBlocked = company ? BLOCKED_STATUSES.has(company.subscriptionStatus ?? "") : false;

  // Fetch client name whenever the selected project changes
  useEffect(() => {
    if (!selectedProjectId) {
      setProjectClientName("");
      return;
    }
    setIsFetchingClient(true);
    apiRequest("GET", `/api/projects/${selectedProjectId}`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        const clientName =
          data.client?.name || data.client?.username || data.name || "";
        setProjectClientName(clientName);
      })
      .catch(() => setProjectClientName(""))
      .finally(() => setIsFetchingClient(false));
  }, [selectedProjectId]);

  // Auto-load estimate from ?load= URL param on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const loadId = params.get("load");
    if (!loadId) return;
    apiRequest("GET", `/api/estimates/${loadId}`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast({
            title: "Could not load estimate",
            description: (err as any).message || "Access denied or estimate not found.",
            variant: "destructive",
          });
          return;
        }
        const data: EstimateWithLineItems = await res.json();
        setSelectedProjectId(data.projectId ?? "");
        let ctr = 0;
        setLineItems(
          data.lineItems.map((li) => ({
            _id: ctr++,
            category: li.category,
            item: li.item,
            quantity: parseFloat(String(li.quantity)),
            unit: li.unit,
            rate: parseFloat(String(li.rate)),
            total: parseFloat(String(li.total)),
          }))
        );
        setLineItemCounter(ctr);
        setLoadedEstimateId(loadId);
        toast({ title: "Estimate loaded", description: `Loaded ${data.customId} — save to create a new copy.` });
      })
      .catch(() => {
        toast({
          title: "Could not load estimate",
          description: "An error occurred while loading the estimate.",
          variant: "destructive",
        });
      });
  }, []);

  const subtotal = lineItems.reduce((acc, i) => acc + i.total, 0);
  const overhead = subtotal * 0.1;
  const profit = subtotal * 0.15;
  const grandTotal = subtotal + overhead + profit;

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const handleAddItem = () => {
    const qty = parseFloat(addForm.quantity) || 0;
    const rate = parseFloat(addForm.rate) || 0;
    const total = qty * rate;
    setLineItems((prev) => [
      ...prev,
      { _id: lineItemCounter, category: addForm.category || "Other", item: addForm.item, quantity: qty, unit: addForm.unit, rate, total },
    ]);
    setLineItemCounter((c) => c + 1);
    setAddForm((f) => ({ ...f, item: "", quantity: "1", rate: "0" }));
  };

  const handleLoadEstimate = async (estimateId: string) => {
    try {
      const res = await apiRequest("GET", `/api/estimates/${estimateId}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: "Could not load estimate", description: (err as any).message || "Access denied.", variant: "destructive" });
        return;
      }
      const data: EstimateWithLineItems = await res.json();
      setSelectedProjectId(data.projectId ?? "");
      let ctr = 0;
      setLineItems(
        data.lineItems.map((li) => ({
          _id: ctr++,
          category: li.category,
          item: li.item,
          quantity: parseFloat(String(li.quantity)),
          unit: li.unit,
          rate: parseFloat(String(li.rate)),
          total: parseFloat(String(li.total)),
        }))
      );
      setLineItemCounter(ctr);
      setLoadedEstimateId(estimateId);
      setShowAddForm(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
      toast({ title: "Estimate loaded", description: `Loaded ${data.customId} — save to create a new copy.` });
    } catch {
      toast({ title: "Error", description: "Could not load estimate.", variant: "destructive" });
    }
  };

  const handleSave = async () => {
    if (!selectedProjectId || !selectedProject) {
      toast({ title: "No project selected", description: "Please select a project before saving.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        customId: generateCustomId(),
        clientName: projectClientName || selectedProject.name,
        projectName: selectedProject.name,
        amount: grandTotal.toFixed(2),
        status: "draft",
        date: new Date().toISOString().split("T")[0],
        projectId: selectedProjectId,
        lineItems: lineItems.map((li) => ({
          category: li.category,
          item: li.item,
          quantity: String(li.quantity),
          unit: li.unit,
          rate: String(li.rate),
          total: String(li.total),
        })),
      };
      const res = await apiRequest("POST", "/api/estimates", payload);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: "Save failed", description: (err as any).message || "Could not save estimate.", variant: "destructive" });
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/estimates"] });
      toast({ title: "Estimate saved", description: "Saved as a draft estimate." });
      setLineItems([]);
      setSelectedProjectId("");
      setLoadedEstimateId(null);
      setShowAddForm(false);
    } catch {
      toast({ title: "Save failed", description: "Could not save estimate.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setLineItems([]);
    setSelectedProjectId("");
    setLoadedEstimateId(null);
    setShowAddForm(false);
    navigate("/company/estimates");
  };

  const addItemTotal = (parseFloat(addForm.quantity) || 0) * (parseFloat(addForm.rate) || 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold">Estimator</h1>
          <p className="text-muted-foreground">Build and save project cost estimates.</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          {loadedEstimateId && (
            <Button variant="ghost" size="sm" onClick={handleReset} data-testid="button-new-estimate">
              New Estimate
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={isSaving || isBlocked || !selectedProjectId || lineItems.length === 0}
            data-testid="button-save-estimate"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {loadedEstimateId ? "Save as New Estimate" : "Save Estimate"}
          </Button>
        </div>
      </div>

      {isBlocked && (
        <Alert variant="destructive" data-testid="alert-access-blocked">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Company access is not active — contact support.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="project-select">
                Project <span className="text-destructive">*</span>
              </Label>
              {projectsLoading ? (
                <div className="flex items-center gap-2 h-10 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading projects…
                </div>
              ) : projectsError ? (
                <Alert variant="destructive" data-testid="alert-projects-error">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>Could not load projects. Please refresh and try again.</AlertDescription>
                </Alert>
              ) : projects.length === 0 ? (
                <Alert data-testid="alert-no-projects">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    No projects yet — create a project first before saving an estimate.
                  </AlertDescription>
                </Alert>
              ) : (
                <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                  <SelectTrigger id="project-select" data-testid="select-project" className="w-full">
                    <SelectValue placeholder="Select a project…" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id} data-testid={`option-project-${p.id}`}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            {selectedProject && (
              <div className="text-sm text-muted-foreground pb-0.5 space-y-1">
                <div>
                  <span className="font-medium">Status:</span>{" "}
                  <span className="capitalize">{selectedProject.status}</span>
                  {selectedProject.phase && (
                    <>
                      {" · "}
                      <span className="font-medium">Phase:</span> {selectedProject.phase}
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-medium">Client:</span>{" "}
                  {isFetchingClient ? (
                    <Loader2 className="w-3 h-3 animate-spin inline" />
                  ) : (
                    <span data-testid="text-project-client">
                      {projectClientName || "—"}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Line Items</CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAddForm((v) => !v)}
                  data-testid="button-add-item"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {showAddForm && (
                <div className="border-b p-4 bg-muted/30 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                    <div className="col-span-1 space-y-1">
                      <Label className="text-xs text-muted-foreground">Category</Label>
                      <Select
                        value={addForm.category}
                        onValueChange={(v) => setAddForm((f) => ({ ...f, category: v }))}
                      >
                        <SelectTrigger className="h-8 text-sm" data-testid="input-add-category">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs text-muted-foreground">Description</Label>
                      <Input
                        className="h-8 text-sm"
                        placeholder="e.g. Framing labor"
                        value={addForm.item}
                        onChange={(e) => setAddForm((f) => ({ ...f, item: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === "Enter" && addForm.item.trim()) handleAddItem(); }}
                        data-testid="input-add-item"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Qty</Label>
                      <Input
                        className="h-8 text-sm"
                        type="number"
                        min="0"
                        step="any"
                        value={addForm.quantity}
                        onChange={(e) => setAddForm((f) => ({ ...f, quantity: e.target.value }))}
                        data-testid="input-add-quantity"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Unit</Label>
                      <Select
                        value={addForm.unit}
                        onValueChange={(v) => setAddForm((f) => ({ ...f, unit: v }))}
                      >
                        <SelectTrigger className="h-8 text-sm" data-testid="input-add-unit">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {UNITS.map((u) => (
                            <SelectItem key={u} value={u}>
                              {u}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Rate ($)</Label>
                      <Input
                        className="h-8 text-sm"
                        type="number"
                        min="0"
                        step="any"
                        value={addForm.rate}
                        onChange={(e) => setAddForm((f) => ({ ...f, rate: e.target.value }))}
                        data-testid="input-add-rate"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                      Total: <strong>{formatCurrency(addItemTotal)}</strong>
                    </span>
                    <div className="flex gap-2 ml-auto">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowAddForm(false)}
                        data-testid="button-cancel-add-item"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleAddItem}
                        disabled={!addForm.item.trim()}
                        data-testid="button-confirm-add-item"
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[160px]">Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-[70px]">Qty</TableHead>
                    <TableHead className="w-[70px]">Unit</TableHead>
                    <TableHead className="w-[100px]">Rate</TableHead>
                    <TableHead className="text-right w-[110px]">Total</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-12">
                        <div className="text-center text-muted-foreground" data-testid="empty-line-items">
                          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                          <p className="font-medium">No line items yet</p>
                          <p className="text-sm mt-1">Click "Add Item" to start building this estimate.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    lineItems.map((item) => (
                      <TableRow key={item._id} data-testid={`row-line-item-${item._id}`}>
                        <TableCell className="text-xs text-muted-foreground font-medium">
                          {item.category}
                        </TableCell>
                        <TableCell>{item.item}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{item.unit}</TableCell>
                        <TableCell>{formatCurrency(item.rate)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.total)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive opacity-50 hover:opacity-100"
                            onClick={() =>
                              setLineItems((prev) => prev.filter((i) => i._id !== item._id))
                            }
                            data-testid={`button-remove-item-${item._id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle>Financial Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal Material &amp; Labor</span>
                <span className="font-medium" data-testid="text-subtotal">
                  {formatCurrency(subtotal)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Overhead (10%)</span>
                <span data-testid="text-overhead">{formatCurrency(overhead)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Profit (15%)</span>
                <span data-testid="text-profit">{formatCurrency(profit)}</span>
              </div>
              <div className="pt-4 border-t border-border flex justify-between items-center">
                <span className="font-heading font-bold text-lg">Grand Total</span>
                <span
                  className="font-heading font-bold text-xl text-primary"
                  data-testid="text-grand-total"
                >
                  {formatCurrency(grandTotal)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Estimate Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1 text-sm">
                <span className="text-muted-foreground">Date</span>
                <p className="font-medium">{new Date().toLocaleDateString()}</p>
              </div>
              <div className="space-y-1 text-sm">
                <span className="text-muted-foreground">Status on save</span>
                <div>
                  <Badge variant="outline">Draft</Badge>
                </div>
              </div>
              {loadedEstimateId && (
                <div
                  className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-300"
                  data-testid="notice-loaded-estimate"
                >
                  Loaded from an existing estimate. Saving will create a new copy.
                </div>
              )}
              {!selectedProjectId && projects.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Select a project above to enable saving.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5" />
              Recent Estimates
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {estimatesLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : estimatesError ? (
            <div className="text-center py-8 text-destructive" data-testid="error-estimates">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-60" />
              <p className="font-medium text-sm">Could not load estimates</p>
              <p className="text-xs mt-1 text-muted-foreground">Please refresh the page and try again.</p>
            </div>
          ) : estimates.length === 0 ? (
            <div
              className="text-center py-8 text-muted-foreground"
              data-testid="empty-estimates"
            >
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="font-medium text-sm">No saved estimates yet</p>
              <p className="text-xs mt-1">
                Select a project, add line items, and save your first estimate above.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {estimates.map((est) => (
                  <TableRow key={est.id} data-testid={`row-estimate-${est.id}`}>
                    <TableCell className="font-medium text-sm">{est.customId}</TableCell>
                    <TableCell>{est.projectName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{est.date}</TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(parseFloat(est.amount ?? "0"))}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(est.status)}>
                        {est.status.charAt(0).toUpperCase() + est.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleLoadEstimate(est.id)}
                        data-testid={`button-load-estimate-${est.id}`}
                      >
                        Load
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
