import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation, Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, parseErrorMessage } from "@/lib/queryClient";
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
import { Loader2, Plus, Trash2, Save, FileText, AlertTriangle, FolderOpen, Search, BookOpen, Settings } from "lucide-react";
import type { Project, Estimate, EstimateLineItem, BudgetCategory, BudgetItem } from "@shared/schema";

interface CompanyFinancialSettings {
  defaultOverheadPct: string | null;
  defaultMarkupPct: string | null;
  defaultLaborBurdenPct: string | null;
  defaultMaterialMarkupPct: string | null;
  defaultSubcontractorMarkupPct: string | null;
  defaultEquipmentCostPct: string | null;
  overheadNotes: string | null;
}

type LineItem = {
  _id: number;
  category: string;
  item: string;
  quantity: number;
  unit: string;
  rate: number;
  total: number;
  priceBookItemId?: string | null;
};

type EstimateWithLineItems = Estimate & { lineItems: EstimateLineItem[] };

const UNITS = ["EA", "SF", "LF", "HR", "LS", "CY", "SY", "LB", "GAL", "TON"];
const CATEGORIES = ["Labor", "Materials", "Equipment", "Subcontractor", "Permits", "Overhead", "Other"];

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

// Clamp a budget item's unitType to the allowed UNITS list; fall back to "EA"
function clampUnit(unitType: string | null | undefined): string {
  if (!unitType) return "EA";
  const upper = unitType.toUpperCase();
  return UNITS.includes(upper) ? upper : "EA";
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

  const [overheadPct, setOverheadPct] = useState<number>(10);
  const [markupPct, setMarkupPct] = useState<number>(15);
  const [overheadSource, setOverheadSource] = useState<"company" | "platform" | "custom">("platform");
  const [markupSource, setMarkupSource] = useState<"company" | "platform" | "custom">("platform");
  const settingsPrefilledRef = useRef(false);

  const [showAddForm, setShowAddForm] = useState(false);
  // "manual" = existing entry form; "pricebook" = price book picker
  const [addFormTab, setAddFormTab] = useState<"manual" | "pricebook">("manual");
  const [addForm, setAddForm] = useState({
    category: "Materials",
    item: "",
    quantity: "1",
    unit: "EA",
    rate: "0",
    priceBookItemId: undefined as string | undefined,
  });

  // Price book picker local state
  const [pbSearch, setPbSearch] = useState("");
  const [pbCategoryFilter, setPbCategoryFilter] = useState<string>("all");

  const { data: projects = [], isLoading: projectsLoading, isError: projectsError } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    queryFn: () => apiRequest("GET", "/api/projects").then((r) => r.json()),
  });

  const { data: estimates = [], isLoading: estimatesLoading, isError: estimatesError } = useQuery<Estimate[]>({
    queryKey: ["/api/estimates"],
    queryFn: () => apiRequest("GET", "/api/estimates").then((r) => r.json()),
  });

  // Internal contractor: regular company team member (not a subcontractor or notary)
  const isInternalContractor =
    user?.role === "contractor" && !!user?.companyId && !user?.contractorType;

  const isOwnerOrAdmin = user?.role === "company_owner" || user?.isCompanyAdmin === true;

  // Price book read access: company_owner, isCompanyAdmin contractors, and regular internal
  // contractors with a companyId. Platform admins are deliberately excluded — they have no
  // reliable companyId in the Estimator context and the backend returns 400 when companyId
  // is null. Subcontractors and notaries are excluded by the isInternalContractor check.
  const canAccessPriceBook =
    user?.role === "company_owner" || user?.isCompanyAdmin === true || isInternalContractor;

  const { data: financialSettings } = useQuery<CompanyFinancialSettings | null>({
    queryKey: ["/api/company/financial-settings"],
    queryFn: async () => {
      const res = await fetch("/api/company/financial-settings", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: user?.role === "company_owner" || (user?.role === "contractor" && user?.isCompanyAdmin === true),
    retry: false,
  });

  const { data: company } = useQuery({
    queryKey: ["/api/company/branding"],
    queryFn: () => apiRequest("GET", "/api/company/branding").then((r) => r.json()),
    enabled: user?.role === "company_owner" || user?.isCompanyAdmin === true || isInternalContractor,
  });

  const {
    data: pbCategories = [],
    isLoading: pbCategoriesLoading,
    isError: pbCategoriesError,
  } = useQuery<BudgetCategory[]>({
    queryKey: ["/api/company/price-book/categories"],
    queryFn: () => apiRequest("GET", "/api/company/price-book/categories").then((r) => r.json()),
    enabled: canAccessPriceBook,
  });

  const {
    data: pbItems = [],
    isLoading: pbItemsLoading,
    isError: pbItemsError,
  } = useQuery<BudgetItem[]>({
    queryKey: ["/api/company/price-book/items"],
    queryFn: () => apiRequest("GET", "/api/company/price-book/items").then((r) => r.json()),
    enabled: canAccessPriceBook,
  });

  // categoryId → category name lookup map
  const categoryNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const cat of pbCategories) {
      m.set(cat.id, cat.name);
    }
    return m;
  }, [pbCategories]);

  // Filtered price book items for the picker (only active items)
  const filteredPbItems = useMemo(() => {
    let items = pbItems.filter((i) => i.isActive !== false);
    if (pbCategoryFilter && pbCategoryFilter !== "all") {
      items = items.filter((i) => i.categoryId === pbCategoryFilter);
    }
    if (pbSearch.trim()) {
      const q = pbSearch.trim().toLowerCase();
      items = items.filter((i) => i.description.toLowerCase().includes(q));
    }
    return items;
  }, [pbItems, pbSearch, pbCategoryFilter]);


  // Fetch client name whenever the selected project changes
  useEffect(() => {
    if (!selectedProjectId) {
      setProjectClientName("");
      return;
    }
    let cancelled = false;
    setIsFetchingClient(true);
    (async () => {
      try {
        const res = await apiRequest("GET", `/api/projects/${selectedProjectId}`);
        const data = await res.json();
        if (!cancelled) {
          setProjectClientName(data.client?.name || data.client?.username || data.name || "");
        }
      } catch {
        if (!cancelled) setProjectClientName("");
      } finally {
        if (!cancelled) setIsFetchingClient(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedProjectId]);

  // Prefill overhead/markup from company financial settings for all internal company users.
  // Runs once when financialSettings resolves; ref guard prevents re-run after user edits.
  // Non-company users (canAccessPriceBook=false) never trigger this query so financialSettings
  // stays undefined and the guard never fires — platform defaults remain in place.
  useEffect(() => {
    if (settingsPrefilledRef.current) return;
    if (financialSettings === undefined) return;
    settingsPrefilledRef.current = true;
    if (financialSettings?.defaultOverheadPct != null) {
      setOverheadPct(parseFloat(String(financialSettings.defaultOverheadPct)));
      setOverheadSource("company");
    } else {
      setOverheadPct(10);
      setOverheadSource("platform");
    }
    if (financialSettings?.defaultMarkupPct != null) {
      setMarkupPct(parseFloat(String(financialSettings.defaultMarkupPct)));
      setMarkupSource("company");
    } else {
      setMarkupPct(15);
      setMarkupSource("platform");
    }
  }, [financialSettings]);

  // Auto-load estimate from ?load= URL param on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const loadId = params.get("load");
    if (!loadId) return;
    (async () => {
      try {
        const res = await apiRequest("GET", `/api/estimates/${loadId}`);
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
            priceBookItemId: li.priceBookItemId ?? null,
          }))
        );
        setLineItemCounter(ctr);
        setLoadedEstimateId(loadId);
        toast({ title: "Estimate loaded", description: `Loaded ${data.customId} — save to create a new copy.` });
      } catch (err) {
        toast({
          title: "Could not load estimate",
          description: parseErrorMessage(err),
          variant: "destructive",
        });
      }
    })();
  }, []);

  const subtotal = lineItems.reduce((acc, i) => acc + i.total, 0);
  const overhead = subtotal * (overheadPct / 100);
  const profit = (subtotal + overhead) * (markupPct / 100);
  const grandTotal = subtotal + overhead + profit;

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const handleAddItem = () => {
    const qty = parseFloat(addForm.quantity) || 0;
    const rate = parseFloat(addForm.rate) || 0;
    const total = qty * rate;
    setLineItems((prev) => [
      ...prev,
      { _id: lineItemCounter, category: addForm.category || "Other", item: addForm.item, quantity: qty, unit: addForm.unit, rate, total, priceBookItemId: addForm.priceBookItemId ?? null },
    ]);
    setLineItemCounter((c) => c + 1);
    setAddForm((f) => ({ ...f, item: "", quantity: "1", rate: "0", priceBookItemId: undefined }));
  };

  // Populate the manual form from a selected price book item, then switch to Manual tab.
  //
  // Field mapping rationale:
  //   budget_items.description  → item        (the line item name shown to the client)
  //   category name lookup      → category    (matched against CATEGORIES list; falls back to "Other")
  //   budget_items.unitType     → unit        (clamped to UNITS; defaults to "EA")
  //   budget_items.retailPrice  → rate        (customer-facing sell price — the correct field for
  //                                            estimating. laborRate, materialFee, subRate, cost,
  //                                            and burdens are internal cost components and are
  //                                            intentionally not surfaced here.)
  const handleSelectPriceBookItem = (pbItem: BudgetItem) => {
    const categoryName = categoryNameMap.get(pbItem.categoryId) ?? "Other";
    const mappedCategory = CATEGORIES.includes(categoryName) ? categoryName : "Other";
    const unit = clampUnit(pbItem.unitType);
    const rateNum = pbItem.retailPrice ? parseFloat(String(pbItem.retailPrice)) : 0;

    setAddForm({
      category: mappedCategory,
      item: pbItem.description,
      quantity: "1",
      unit,
      rate: isNaN(rateNum) ? "0" : String(rateNum),
      priceBookItemId: pbItem.id,
    });
    setAddFormTab("manual");
  };

  // Close the add-item panel and fully reset picker state
  const handleCloseAddForm = () => {
    setShowAddForm(false);
    setAddFormTab("manual");
    setPbSearch("");
    setPbCategoryFilter("all");
  };

  const handleLoadEstimate = async (estimateId: string) => {
    try {
      const res = await apiRequest("GET", `/api/estimates/${estimateId}`);
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
          priceBookItemId: li.priceBookItemId ?? null,
        }))
      );
      setLineItemCounter(ctr);
      setLoadedEstimateId(estimateId);
      handleCloseAddForm();
      window.scrollTo({ top: 0, behavior: "smooth" });
      toast({ title: "Estimate loaded", description: `Loaded ${data.customId} — save to create a new copy.` });
    } catch (err) {
      toast({ title: "Could not load estimate", description: parseErrorMessage(err), variant: "destructive" });
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
        appliedOverheadPct: overheadPct,
        appliedMarkupPct: markupPct,
        appliedLaborBurdenPct: null,
        appliedMaterialMarkupPct: null,
        appliedSubcontractorMarkupPct: null,
        appliedEquipmentCostPct: null,
        lineItems: lineItems.map((li) => ({
          category: li.category,
          item: li.item,
          quantity: String(li.quantity),
          unit: li.unit,
          rate: String(li.rate),
          total: String(li.total),
          priceBookItemId: li.priceBookItemId ?? null,
        })),
      };
      await apiRequest("POST", "/api/estimates", payload);
      await queryClient.invalidateQueries({ queryKey: ["/api/estimates"] });
      toast({ title: "Estimate saved", description: "Saved as a draft estimate." });
      setLineItems([]);
      setSelectedProjectId("");
      setLoadedEstimateId(null);
      handleCloseAddForm();
    } catch (err) {
      toast({ title: "Save failed", description: parseErrorMessage(err), variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setLineItems([]);
    setSelectedProjectId("");
    setLoadedEstimateId(null);
    handleCloseAddForm();
    navigate("/company/estimates");
  };

  const addItemTotal = (parseFloat(addForm.quantity) || 0) * (parseFloat(addForm.rate) || 0);
  const pbLoading = pbCategoriesLoading || pbItemsLoading;
  const pbError = pbCategoriesError || pbItemsError;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold">Estimator Calculator</h1>
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
            disabled={isSaving || !selectedProjectId || lineItems.length === 0}
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

      {selectedProjectId && lineItems.length === 0 && (
        <p className="text-sm text-muted-foreground" data-testid="hint-no-line-items">
          Add at least one line item before saving.
        </p>
      )}

      {/* Financial Defaults reference card — owner/admin only */}
      {isOwnerOrAdmin && (
        <Card className="border-muted" data-testid="card-financial-defaults">
          <CardContent className="py-3 px-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-2">
                <Settings className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium leading-tight">Company Financial Defaults</p>
                  {(() => {
                    if (!financialSettings) return (
                      <p className="text-xs text-muted-foreground mt-0.5">No financial defaults configured.</p>
                    );
                    const entries = [
                      { label: "Overhead", value: financialSettings.defaultOverheadPct },
                      { label: "Markup", value: financialSettings.defaultMarkupPct },
                      { label: "Labor Burden", value: financialSettings.defaultLaborBurdenPct },
                      { label: "Material Markup", value: financialSettings.defaultMaterialMarkupPct },
                      { label: "Subcontractor Markup", value: financialSettings.defaultSubcontractorMarkupPct },
                      { label: "Equipment Cost", value: financialSettings.defaultEquipmentCostPct },
                    ].filter((e) => e.value !== null && e.value !== undefined && e.value !== "");
                    if (entries.length === 0) return (
                      <p className="text-xs text-muted-foreground mt-0.5">No financial defaults configured.</p>
                    );
                    return (
                      <p className="text-xs text-muted-foreground mt-0.5" data-testid="text-financial-defaults-values">
                        {entries.map((e) => `${e.label}: ${e.value}%`).join("  ·  ")}
                      </p>
                    );
                  })()}
                </div>
              </div>
              <Link href="/company/financial-settings">
                <Button variant="ghost" size="sm" className="text-xs h-7 px-2 shrink-0" data-testid="link-configure-financial-settings">
                  Configure in Financial Settings →
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
      {!isOwnerOrAdmin && isInternalContractor && (
        <p className="text-xs text-muted-foreground" data-testid="text-financial-defaults-restricted">
          Financial defaults are managed by your company admin.
        </p>
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
                  onClick={() => {
                    if (showAddForm) {
                      handleCloseAddForm();
                    } else {
                      setShowAddForm(true);
                      setAddFormTab("manual");
                    }
                  }}
                  data-testid="button-add-item"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {showAddForm && (
                <div className="border-b bg-muted/30">
                  {/* Tab switcher — only show "From Price Book" tab when user has access */}
                  <div className="flex border-b" data-testid="add-item-tabs">
                    <button
                      className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                        addFormTab === "manual"
                          ? "border-primary text-primary"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => { setAddFormTab("manual"); setPbSearch(""); setPbCategoryFilter("all"); }}
                      data-testid="tab-manual"
                    >
                      Manual
                    </button>
                    {canAccessPriceBook && (
                      <button
                        className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
                          addFormTab === "pricebook"
                            ? "border-primary text-primary"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                        onClick={() => { setAddFormTab("pricebook"); setPbSearch(""); setPbCategoryFilter("all"); }}
                        data-testid="tab-pricebook"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        From Price Book
                      </button>
                    )}
                  </div>

                  {/* ── Manual tab (existing form, unchanged) ── */}
                  {addFormTab === "manual" && (
                    <div className="p-4 space-y-3">
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
                            onClick={handleCloseAddForm}
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

                  {/* ── Price Book tab ── */}
                  {addFormTab === "pricebook" && (
                    <div className="p-4 space-y-3">
                      {/* Search + category filter */}
                      <div className="flex gap-2" data-testid="pb-controls">
                        <div className="relative flex-1">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                          <Input
                            className="h-8 text-sm pl-8"
                            placeholder="Search by item name…"
                            value={pbSearch}
                            onChange={(e) => setPbSearch(e.target.value)}
                            data-testid="input-pb-search"
                          />
                        </div>
                        {pbCategories.length > 0 && (
                          <Select value={pbCategoryFilter} onValueChange={setPbCategoryFilter}>
                            <SelectTrigger className="h-8 text-sm w-44 shrink-0" data-testid="select-pb-category">
                              <SelectValue placeholder="All categories" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All categories</SelectItem>
                              {pbCategories.map((cat) => (
                                <SelectItem key={cat.id} value={cat.id} data-testid={`option-pb-category-${cat.id}`}>
                                  {cat.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>

                      {/* Item list */}
                      {pbLoading ? (
                        <div className="flex justify-center py-8" data-testid="pb-loading">
                          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : pbError ? (
                        <div
                          className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-5 text-center text-sm text-destructive"
                          data-testid="pb-error"
                        >
                          <AlertTriangle className="w-4 h-4 mx-auto mb-1.5 opacity-70" />
                          Could not load price book. Please try again.
                        </div>
                      ) : pbItems.length === 0 ? (
                        <div className="py-8 text-center text-sm text-muted-foreground" data-testid="pb-empty-no-items">
                          <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-25" />
                          <p className="font-medium">No price book items found.</p>
                          <p className="text-xs mt-1 text-muted-foreground">
                            Import or create price book items before using them in estimates.
                          </p>
                        </div>
                      ) : filteredPbItems.length === 0 ? (
                        <div className="py-8 text-center text-sm text-muted-foreground" data-testid="pb-empty-no-matches">
                          <Search className="w-6 h-6 mx-auto mb-2 opacity-25" />
                          <p>No price book items match your search.</p>
                        </div>
                      ) : (
                        <div
                          className="overflow-y-auto rounded-md border divide-y max-h-56"
                          data-testid="pb-item-list"
                        >
                          {filteredPbItems.map((pbItem) => {
                            const catName = categoryNameMap.get(pbItem.categoryId) ?? "—";
                            const unit = clampUnit(pbItem.unitType);
                            const rate = pbItem.retailPrice ? parseFloat(String(pbItem.retailPrice)) : 0;
                            return (
                              <button
                                key={pbItem.id}
                                className="w-full text-left px-3 py-2.5 hover:bg-muted/60 transition-colors flex items-center gap-3"
                                onClick={() => handleSelectPriceBookItem(pbItem)}
                                data-testid={`pb-item-${pbItem.id}`}
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{pbItem.description}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {catName}
                                    <span className="mx-1.5 opacity-40">·</span>
                                    {unit}
                                  </p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-sm font-medium tabular-nums">
                                    {formatCurrency(isNaN(rate) ? 0 : rate)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">per {unit}</p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleCloseAddForm}
                          data-testid="button-cancel-pb"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
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
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-muted-foreground">Overhead %</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                      overheadSource === "company"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                        : overheadSource === "custom"
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {overheadSource === "company" ? "Company default" : overheadSource === "custom" ? "Custom" : "Platform default"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      max="999.99"
                      step="0.01"
                      value={overheadPct}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v)) { setOverheadPct(v); setOverheadSource("custom"); }
                      }}
                      className="h-7 w-20 text-sm text-right"
                      data-testid="input-overhead-pct"
                    />
                    <span className="text-sm text-muted-foreground w-[80px] text-right" data-testid="text-overhead">
                      {formatCurrency(overhead)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-muted-foreground">Markup %</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                      markupSource === "company"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                        : markupSource === "custom"
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {markupSource === "company" ? "Company default" : markupSource === "custom" ? "Custom" : "Platform default"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      max="999.99"
                      step="0.01"
                      value={markupPct}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v)) { setMarkupPct(v); setMarkupSource("custom"); }
                      }}
                      className="h-7 w-20 text-sm text-right"
                      data-testid="input-markup-pct"
                    />
                    <span className="text-sm text-muted-foreground w-[80px] text-right" data-testid="text-profit">
                      {formatCurrency(profit)}
                    </span>
                  </div>
                </div>
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
                      <div>{formatCurrency(parseFloat(est.amount ?? "0"))}</div>
                      {est.appliedOverheadPct != null && est.appliedMarkupPct != null && (
                        <div className="text-xs text-muted-foreground mt-0.5" data-testid={`text-applied-rates-${est.id}`}>
                          Applied rates: Overhead {parseFloat(String(est.appliedOverheadPct))}%, Markup {parseFloat(String(est.appliedMarkupPct))}%
                        </div>
                      )}
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
