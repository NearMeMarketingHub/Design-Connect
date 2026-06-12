import { useState, useMemo } from "react";
import { useConfirm } from "@/hooks/use-confirm";
import { useQuery } from "@tanstack/react-query";
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
import { Textarea } from "@/components/ui/textarea";
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
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";

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

export default function ContractorCalculator() {
  const { user, currentPortal } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [estimateItems, setEstimateItems] = useState<EstimateLineItem[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [estimateName, setEstimateName] = useState("");
  const [estimateNotes, setEstimateNotes] = useState("");
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
        <p className="text-muted-foreground mt-1">Create project estimates and quotes using your company price book.</p>
      </div>

      <div className="flex" style={{ height: 'calc(100vh - 12rem)' }}>
        <div className="flex-1 flex flex-col md:flex-row">
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

          <div className="w-full md:w-96 border-l bg-card flex flex-col">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-primary" />
                  <h2 className="font-semibold">Estimate</h2>
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
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Estimate</DialogTitle>
            <DialogDescription>Save this estimate for future reference or to attach to a project.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="estimate-name">Estimate Name</Label>
              <Input
                id="estimate-name"
                placeholder="e.g., Kitchen Renovation - Phase 1"
                value={estimateName}
                onChange={(e) => setEstimateName(e.target.value)}
                data-testid="input-estimate-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="estimate-notes">Notes (optional)</Label>
              <Textarea
                id="estimate-notes"
                placeholder="Additional notes about this estimate..."
                value={estimateNotes}
                onChange={(e) => setEstimateNotes(e.target.value)}
                rows={3}
                data-testid="input-estimate-notes"
              />
            </div>
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <div className="flex justify-between text-sm mb-2">
                  <span>{estimateItems.length} items</span>
                  <span className="font-semibold">{formatCurrency(totals.retail)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)} data-testid="button-cancel-save">
              Cancel
            </Button>
            <Button 
              disabled={!estimateName.trim()}
              onClick={() => {
                toast({
                  title: "Estimate Saved",
                  description: `"${estimateName}" saved successfully. Full save functionality coming soon.`,
                });
                setSaveDialogOpen(false);
                setEstimateName("");
                setEstimateNotes("");
              }}
              data-testid="button-confirm-save"
            >
              Save Estimate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog />
    </div>
  );
}
