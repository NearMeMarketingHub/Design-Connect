import { useState, useMemo } from "react";
import { useConfirm } from "@/hooks/use-confirm";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Calculator,
  Search,
  Plus,
  Minus,
  Trash2,
  FileText,
  DollarSign,
  Package,
  ShoppingCart,
  Save,
  X,
  ChevronRight,
  Loader2,
  Download,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";

interface BudgetCategory {
  id: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
  notes: string | null;
}

interface BudgetItem {
  id: string;
  categoryId: string;
  itemType: string;
  description: string;
  unitType: string;
  cost: string;
  burdens: string;
  materialFee: string;
  laborRate: string;
  subRate: string;
  retailPrice: string;
  notes: string | null;
  displayOrder: number;
  isActive: boolean;
}

interface EstimateLineItem {
  item: BudgetItem;
  quantity: number;
}

function generateCustomId() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rand = Math.random().toString(16).slice(2, 6).toUpperCase();
  return `EST-${y}${m}${day}-${rand}`;
}

function formatCurrencyPdf(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ContractorCalculator() {
  const { user, currentPortal } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [estimateItems, setEstimateItems] = useState<EstimateLineItem[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  // Persistent quote header — shared by Save and Export PDF
  const [clientName, setClientName] = useState("");
  const [estimateName, setEstimateName] = useState("");

  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [savedCustomId, setSavedCustomId] = useState<string | null>(null);

  const { confirm, ConfirmDialog } = useConfirm();

  const dashboardPath = currentPortal === "admin" ? "/admin/dashboard" : "/contractor/dashboard";

  const { data: categories = [], isLoading: categoriesLoading } = useQuery<BudgetCategory[]>({
    queryKey: ["/api/calculator/categories"],
    queryFn: async () => {
      const res = await fetch("/api/calculator/categories", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch categories");
      return res.json();
    },
  });

  const { data: allItems = [], isLoading: itemsLoading } = useQuery<BudgetItem[]>({
    queryKey: ["/api/calculator/items"],
    queryFn: async () => {
      const res = await fetch("/api/calculator/items", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch items");
      return res.json();
    },
  });

  const activeCategories = categories.filter(c => c.isActive).sort((a, b) => a.displayOrder - b.displayOrder);
  const activeItems = allItems.filter(i => i.isActive);

  const filteredItems = useMemo(() => {
    let items = activeItems;
    if (selectedCategory) {
      items = items.filter(i => i.categoryId === selectedCategory);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter(i =>
        i.description.toLowerCase().includes(query) ||
        i.itemType.toLowerCase().includes(query)
      );
    }
    return items.sort((a, b) => a.displayOrder - b.displayOrder);
  }, [activeItems, selectedCategory, searchQuery]);

  const categoryItems = useMemo(() => {
    const map: Record<string, BudgetItem[]> = {};
    activeItems.forEach(item => {
      if (!map[item.categoryId]) map[item.categoryId] = [];
      map[item.categoryId].push(item);
    });
    return map;
  }, [activeItems]);

  const addToEstimate = (item: BudgetItem) => {
    const existing = estimateItems.find(e => e.item.id === item.id);
    if (existing) {
      setEstimateItems(prev =>
        prev.map(e => e.item.id === item.id ? { ...e, quantity: e.quantity + 1 } : e)
      );
    } else {
      setEstimateItems(prev => [...prev, { item, quantity: 1 }]);
    }
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      setEstimateItems(prev => prev.filter(e => e.item.id !== itemId));
    } else {
      setEstimateItems(prev =>
        prev.map(e => e.item.id === itemId ? { ...e, quantity } : e)
      );
    }
  };

  const removeFromEstimate = (itemId: string) => {
    setEstimateItems(prev => prev.filter(e => e.item.id !== itemId));
  };

  const clearEstimate = async () => {
    if (estimateItems.length === 0) return;
    const ok = await confirm({
      title: "Confirm action",
      description: "Clear all items from the estimate?",
      confirmLabel: "Clear",
      destructive: true,
    });
    if (ok) setEstimateItems([]);
  };

  const totals = useMemo(() => {
    let laborTotal = 0;
    let materialTotal = 0;
    let retailTotal = 0;
    let costTotal = 0;

    estimateItems.forEach(({ item, quantity }) => {
      const labor = parseFloat(item.laborRate || "0") * quantity;
      const material = parseFloat(item.materialFee || "0") * quantity;
      const retail = parseFloat(item.retailPrice || "0") * quantity;
      const cost = parseFloat(item.cost || "0") * quantity;

      laborTotal += labor;
      materialTotal += material;
      retailTotal += retail;
      costTotal += cost;
    });

    return {
      labor: laborTotal,
      material: materialTotal,
      retail: retailTotal,
      cost: costTotal,
      profit: retailTotal - costTotal,
      margin: retailTotal > 0 ? ((retailTotal - costTotal) / retailTotal) * 100 : 0,
    };
  }, [estimateItems]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatPrice = (value: string | null) => {
    if (!value) return "-";
    const num = parseFloat(value);
    return isNaN(num) ? "-" : formatCurrency(num);
  };

  // Real save handler — posts to /api/estimates
  const handleSave = async () => {
    if (!clientName.trim()) {
      toast({ title: "Client name required", description: "Enter a client or prospect name.", variant: "destructive" });
      return;
    }
    if (!estimateName.trim()) {
      toast({ title: "Job description required", description: "Enter a job description or estimate name.", variant: "destructive" });
      return;
    }
    if (estimateItems.length === 0) {
      toast({ title: "Cart is empty", description: "Add at least one item before saving.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const customId = generateCustomId();
      const payload = {
        customId,
        clientName: clientName.trim(),
        projectName: estimateName.trim(),
        amount: String(totals.retail),
        status: "draft",
        date: new Date().toISOString().split("T")[0],
        lineItems: estimateItems.map(({ item, quantity }) => ({
          category: item.itemType || "Other",
          item: item.description,
          quantity: String(quantity),
          unit: item.unitType || "EA",
          rate: String(parseFloat(item.retailPrice || "0")),
          total: String(parseFloat(item.retailPrice || "0") * quantity),
          priceBookItemId: item.id,
        })),
      };
      const res = await fetch("/api/estimates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Save failed" }));
        throw new Error(err.message || "Save failed");
      }
      const saved = await res.json();
      const resolvedId = saved.customId ?? customId;
      setSavedCustomId(resolvedId);
      await queryClient.invalidateQueries({ queryKey: ["/api/estimates"] });
      toast({ title: "Estimate saved", description: `Saved as ${resolvedId}` });
      setSaveDialogOpen(false);
      // Do NOT clear clientName, estimateName, cart items, or savedCustomId —
      // contractor may immediately export the PDF and needs all of it.
    } catch (err: any) {
      toast({ title: "Save failed", description: err?.message ?? "An error occurred.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // PDF export — works before or after save
  const handleExportPdf = () => {
    if (estimateItems.length === 0) {
      toast({ title: "Cart is empty", description: "Add items before exporting.", variant: "destructive" });
      return;
    }

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    let y = 20;

    // Header
    pdf.setFontSize(22);
    pdf.setFont("helvetica", "bold");
    pdf.text("ESTIMATE", margin, y);

    if (savedCustomId) {
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(savedCustomId, pageWidth - margin, y, { align: "right" });
    }
    y += 8;

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.text(
      `Date: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
      margin,
      y
    );
    y += 10;

    // Divider
    pdf.setDrawColor(180);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 8;

    // Client info
    if (clientName) {
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      pdf.text("Client / Prospect:", margin, y);
      pdf.setFont("helvetica", "normal");
      pdf.text(clientName, margin + 36, y);
      y += 6;
    }
    if (estimateName) {
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      pdf.text("Job Description:", margin, y);
      pdf.setFont("helvetica", "normal");
      pdf.text(estimateName, margin + 36, y);
      y += 6;
    }
    y += 4;

    // Divider
    pdf.setDrawColor(180);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 6;

    // Line items table header
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.setFillColor(245, 245, 245);
    pdf.rect(margin, y - 4, contentWidth, 7, "F");
    pdf.text("Description", margin + 2, y);
    pdf.text("Qty", margin + contentWidth * 0.54, y);
    pdf.text("Unit", margin + contentWidth * 0.63, y);
    pdf.text("Rate", margin + contentWidth * 0.76, y, { align: "right" });
    pdf.text("Total", pageWidth - margin, y, { align: "right" });
    y += 4;
    pdf.setDrawColor(180);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 5;

    // Line items
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    estimateItems.forEach(({ item, quantity }) => {
      const rate = parseFloat(item.retailPrice || "0");
      const lineTotal = rate * quantity;
      const desc = item.description.length > 42 ? item.description.slice(0, 42) + "…" : item.description;
      pdf.text(desc, margin + 2, y);
      pdf.text(String(quantity), margin + contentWidth * 0.54, y);
      pdf.text(item.unitType || "EA", margin + contentWidth * 0.63, y);
      pdf.text(formatCurrencyPdf(rate), margin + contentWidth * 0.76, y, { align: "right" });
      pdf.text(formatCurrencyPdf(lineTotal), pageWidth - margin, y, { align: "right" });
      y += 6;
      if (y > 252) {
        pdf.addPage();
        y = 20;
      }
    });

    y += 2;
    pdf.setDrawColor(180);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 7;

    // Totals block
    const totalsLeft = margin + contentWidth * 0.55;
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.text("Labor:", totalsLeft, y);
    pdf.text(formatCurrencyPdf(totals.labor), pageWidth - margin, y, { align: "right" });
    y += 6;
    pdf.text("Materials:", totalsLeft, y);
    pdf.text(formatCurrencyPdf(totals.material), pageWidth - margin, y, { align: "right" });
    y += 2;
    pdf.setDrawColor(180);
    pdf.line(totalsLeft, y, pageWidth - margin, y);
    y += 5;
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.text("Total:", totalsLeft, y);
    pdf.text(formatCurrencyPdf(totals.retail), pageWidth - margin, y, { align: "right" });
    y += 6;
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(120);
    pdf.text(`Margin: ${totals.margin.toFixed(1)}%`, totalsLeft, y);
    y += 12;

    // Footer
    pdf.setTextColor(150);
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "italic");
    pdf.text("This estimate is valid for 30 days from the date above.", margin, y);
    if (!savedCustomId) {
      y += 5;
      pdf.text("Draft — not yet saved.", margin, y);
    }

    const safeName = (clientName || "draft").replace(/[^a-z0-9]/gi, "-").toLowerCase();
    const dateStr = new Date().toISOString().split("T")[0];
    pdf.save(`estimate-${safeName}-${dateStr}.pdf`);
  };

  if (categoriesLoading || itemsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Calculator className="w-12 h-12 mx-auto text-muted-foreground animate-pulse" />
          <p className="mt-4 text-muted-foreground">Loading Estimator Calculator...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-heading font-bold text-foreground flex items-center gap-3">
          <Calculator className="w-8 h-8 text-primary" />
          Estimator Calculator
        </h1>
        <p className="text-muted-foreground mt-1">Build client estimates and quotes using your company price book.</p>
      </div>

      <div className="flex" style={{ height: 'calc(100vh - 12rem)' }}>
        <div className="flex-1 flex flex-col md:flex-row">

          {/* Category sidebar */}
          <div className="w-full md:w-80 border-r bg-muted/30 flex flex-col">
            <div className="p-4 border-b">
              <h2 className="font-semibold mb-3">Categories</h2>
              <Button
                variant={selectedCategory === null ? "default" : "ghost"}
                className="w-full justify-start mb-2"
                onClick={() => setSelectedCategory(null)}
                data-testid="button-all-categories"
              >
                <Package className="w-4 h-4 mr-2" />
                All Items ({activeItems.length})
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2">
                {activeCategories.map(category => (
                  <Button
                    key={category.id}
                    variant={selectedCategory === category.id ? "secondary" : "ghost"}
                    className="w-full justify-between text-left mb-1"
                    onClick={() => setSelectedCategory(category.id)}
                    data-testid={`button-category-${category.id}`}
                  >
                    <span className="truncate">{category.name}</span>
                    <Badge variant="outline" className="ml-2">
                      {categoryItems[category.id]?.length || 0}
                    </Badge>
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Item table */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b bg-card">
              <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search items..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-items"
                  />
                </div>
                <Badge variant="secondary">
                  {filteredItems.length} items
                </Badge>
              </div>
            </div>

            <ScrollArea className="flex-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Description</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Labor</TableHead>
                    <TableHead className="text-right">Material</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {searchQuery ? "No items match your search" : "No items in this category"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredItems.map(item => {
                      const inEstimate = estimateItems.find(e => e.item.id === item.id);
                      return (
                        <TableRow key={item.id} className={inEstimate ? "bg-primary/5" : ""}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{item.description}</p>
                              <p className="text-xs text-muted-foreground">{item.itemType}</p>
                            </div>
                          </TableCell>
                          <TableCell>{item.unitType}</TableCell>
                          <TableCell className="text-right">{formatPrice(item.laborRate)}</TableCell>
                          <TableCell className="text-right">{formatPrice(item.materialFee)}</TableCell>
                          <TableCell className="text-right font-medium">{formatPrice(item.retailPrice)}</TableCell>
                          <TableCell>
                            {inEstimate ? (
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => updateQuantity(item.id, inEstimate.quantity - 1)}
                                  data-testid={`button-decrease-${item.id}`}
                                >
                                  <Minus className="w-3 h-3" />
                                </Button>
                                <span className="w-6 text-center text-sm font-medium">{inEstimate.quantity}</span>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => updateQuantity(item.id, inEstimate.quantity + 1)}
                                  data-testid={`button-increase-${item.id}`}
                                >
                                  <Plus className="w-3 h-3" />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => addToEstimate(item)}
                                data-testid={`button-add-${item.id}`}
                              >
                                <Plus className="w-4 h-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>

          {/* Estimate cart */}
          <div className="w-full md:w-96 border-l bg-card flex flex-col">

            {/* Cart header */}
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-primary" />
                  <h2 className="font-semibold">Estimate</h2>
                  {savedCustomId && (
                    <Badge variant="secondary" className="text-xs font-mono">{savedCustomId}</Badge>
                  )}
                </div>
                {estimateItems.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearEstimate} data-testid="button-clear-estimate">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {estimateItems.length} item{estimateItems.length !== 1 ? "s" : ""} in estimate
              </p>
            </div>

            {/* Persistent quote header fields */}
            <div className="p-4 border-b space-y-3 bg-muted/20">
              <div className="space-y-1">
                <Label htmlFor="clientName" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Client / Prospect Name
                </Label>
                <Input
                  id="clientName"
                  placeholder="e.g. Jane Smith"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  data-testid="input-client-name"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="estimateName" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Job Description
                </Label>
                <Input
                  id="estimateName"
                  placeholder="e.g. Kitchen remodel"
                  value={estimateName}
                  onChange={(e) => setEstimateName(e.target.value)}
                  data-testid="input-estimate-name"
                  className="h-8 text-sm"
                />
              </div>
            </div>

            {/* Cart items */}
            <ScrollArea className="flex-1">
              {estimateItems.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No items added yet</p>
                  <p className="text-sm mt-1">Click + to add items to your estimate</p>
                </div>
              ) : (
                <div className="p-2">
                  {estimateItems.map(({ item, quantity }) => (
                    <Card key={item.id} className="mb-2">
                      <CardContent className="p-3">
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{item.description}</p>
                            <p className="text-xs text-muted-foreground">{item.unitType}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 -mt-1 -mr-1"
                            onClick={() => removeFromEstimate(item.id)}
                            data-testid={`button-remove-${item.id}`}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => updateQuantity(item.id, quantity - 1)}
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <Input
                              type="number"
                              value={quantity}
                              onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 0)}
                              className="w-14 h-6 text-center text-sm"
                              min={1}
                              data-testid={`input-quantity-${item.id}`}
                            />
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => updateQuantity(item.id, quantity + 1)}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                          <p className="font-medium text-sm">
                            {formatCurrency(parseFloat(item.retailPrice || "0") * quantity)}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Totals + action buttons */}
            {estimateItems.length > 0 && (
              <div className="border-t p-4 space-y-3">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Labor</span>
                    <span>{formatCurrency(totals.labor)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Materials</span>
                    <span>{formatCurrency(totals.material)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-semibold text-lg">
                    <span>Total</span>
                    <span className="text-primary">{formatCurrency(totals.retail)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Profit margin</span>
                    <span>{totals.margin.toFixed(1)}%</span>
                  </div>
                </div>

                <Button
                  className="w-full"
                  onClick={() => setSaveDialogOpen(true)}
                  data-testid="button-save-estimate"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Estimate
                </Button>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleExportPdf}
                  data-testid="button-export-pdf"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export PDF
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save dialog — confirmation step */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Estimate</DialogTitle>
            <DialogDescription>
              {clientName && estimateName
                ? `Save "${estimateName}" for ${clientName} to your estimates.`
                : "Save this estimate to your records."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Summary of what will be saved */}
            <Card className="bg-muted/50">
              <CardContent className="p-4 space-y-2 text-sm">
                {clientName ? (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Client</span>
                    <span className="font-medium">{clientName}</span>
                  </div>
                ) : null}
                {estimateName ? (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Job</span>
                    <span className="font-medium">{estimateName}</span>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{estimateItems.length} item{estimateItems.length !== 1 ? "s" : ""}</span>
                  <span className="font-semibold">{formatCurrency(totals.retail)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Warn if required fields are missing */}
            {(!clientName.trim() || !estimateName.trim()) && (
              <p className="text-sm text-destructive">
                Please fill in{!clientName.trim() && !estimateName.trim()
                  ? " Client Name and Job Description"
                  : !clientName.trim()
                    ? " Client / Prospect Name"
                    : " Job Description"} in the estimate panel before saving.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSaveDialogOpen(false)}
              data-testid="button-cancel-save"
            >
              Cancel
            </Button>
            <Button
              disabled={isSaving || !clientName.trim() || !estimateName.trim()}
              onClick={handleSave}
              data-testid="button-confirm-save"
            >
              {isSaving
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</>
                : "Save Estimate"
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog />
    </div>
  );
}
