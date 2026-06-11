import { useState, useEffect } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ArrowLeft,
  DollarSign,
  Edit,
  Loader2,
  Package,
  Plus,
  Save,
  Search,
  Trash2,
  Calculator,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { parseErrorMessage, apiRequest } from "@/lib/queryClient";
import type { BudgetCategory, BudgetItem } from "@shared/schema";

interface CategoryWithItems extends BudgetCategory {
  items?: BudgetItem[];
}

export default function BudgetAdmin() {
  const [_, setLocation] = useLocation();
  const { user, loading: authLoading, currentPortal } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [addCategoryDialogOpen, setAddCategoryDialogOpen] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: "", notes: "" });
  const [newItem, setNewItem] = useState({
    itemType: "",
    description: "",
    unitType: "ea",
    cost: "0",
    burdens: "0",
    materialFee: "0",
    laborRate: "0",
    subRate: "0",
    retailPrice: "0",
    notes: "",
  });

  const isAdmin = user?.role === "admin";
  const isCompanyUser = user?.role === "company_owner" || !!user?.isCompanyAdmin;
  const canAccess = !!(isAdmin || isCompanyUser);

  const categoryApiBase = isAdmin ? "/api/budget" : "/api/company/price-book";
  const itemApiBase = isAdmin ? "/api/budget" : "/api/company/price-book";

  useEffect(() => {
    if (!authLoading && !canAccess) {
      setLocation(isAdmin === false && user?.role === "client" ? "/" : "/admin-login");
    }
  }, [user, authLoading, canAccess]);

  const { data: categories = [], isLoading } = useQuery<BudgetCategory[]>({
    queryKey: [`${categoryApiBase}/categories`],
    queryFn: () => apiRequest("GET", `${categoryApiBase}/categories`).then(r => r.json()),
    enabled: canAccess && !authLoading,
  });

  const { data: allItems = [] } = useQuery<BudgetItem[]>({
    queryKey: [`${itemApiBase}/items`],
    queryFn: () => apiRequest("GET", `${itemApiBase}/items`).then(r => r.json()),
    enabled: canAccess && !authLoading,
  });

  const updateItemMutation = useMutation({
    mutationFn: (item: Partial<BudgetItem> & { id: string }) =>
      apiRequest("PATCH", `${itemApiBase}/items/${item.id}`, item).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`${itemApiBase}/items`] });
      toast({ title: "Item Updated", description: "The pricing has been saved." });
      setEditDialogOpen(false);
      setEditingItem(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: parseErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const createItemMutation = useMutation({
    mutationFn: (item: Omit<BudgetItem, "id">) =>
      apiRequest("POST", `${itemApiBase}/items`, item).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`${itemApiBase}/items`] });
      toast({ title: "Item Created", description: "New line item has been added." });
      setAddItemDialogOpen(false);
      setNewItem({
        itemType: "",
        description: "",
        unitType: "ea",
        cost: "0",
        burdens: "0",
        materialFee: "0",
        laborRate: "0",
        subRate: "0",
        retailPrice: "0",
        notes: "",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Create Failed",
        description: parseErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: (data: { name: string; notes: string }) =>
      apiRequest("POST", `${categoryApiBase}/categories`, { ...data, displayOrder: categories.length, isActive: true }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`${categoryApiBase}/categories`] });
      toast({ title: "Category Created", description: "New category has been added." });
      setAddCategoryDialogOpen(false);
      setNewCategory({ name: "", notes: "" });
    },
    onError: (error: Error) => {
      toast({ title: "Create Failed", description: parseErrorMessage(error), variant: "destructive" });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `${itemApiBase}/items/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`${itemApiBase}/items`] });
      toast({ title: "Item Deleted", description: "The line item has been removed." });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete Failed",
        description: parseErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!canAccess) {
    return null;
  }

  const categoriesWithItems: CategoryWithItems[] = categories.map((cat) => ({
    ...cat,
    items: allItems.filter((item) => item.categoryId === cat.id),
  }));

  const laborCategories = categoriesWithItems.filter((c) => !c.notes?.includes("Floor Calculator"));
  const floorCategories = categoriesWithItems.filter((c) => c.notes?.includes("Floor Calculator"));

  const filteredLabor = laborCategories.filter(
    (cat) =>
      cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cat.items?.some(
        (item) =>
          item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.itemType.toLowerCase().includes(searchQuery.toLowerCase())
      )
  );

  const filteredFloor = floorCategories.filter((cat) =>
    cat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEditItem = (item: BudgetItem) => {
    setEditingItem(item);
    setEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingItem) return;
    updateItemMutation.mutate(editingItem);
  };

  const handleAddItem = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    const category = categories.find((c) => c.id === categoryId);
    setNewItem((prev) => ({
      ...prev,
      itemType: category?.name || "",
    }));
    setAddItemDialogOpen(true);
  };

  const handleCreateItem = () => {
    if (!selectedCategoryId) return;
    createItemMutation.mutate({
      ...newItem,
      categoryId: selectedCategoryId,
      displayOrder: 999,
      isActive: true,
    } as any);
  };

  const formatCurrency = (value: string | null | undefined) => {
    const num = parseFloat(value || "0");
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(num);
  };

  const totalItems = allItems.length;
  const totalCategories = categories.length;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/dashboard">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Calculator className="w-6 h-6 text-primary" />
              <h1 className="text-xl font-semibold">Budget Price Manager</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search categories or items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-80"
                data-testid="input-search"
              />
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="p-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Categories</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-categories">
                {totalCategories}
              </div>
              <p className="text-xs text-muted-foreground">
                {laborCategories.length} Labor + {floorCategories.length} Floor types
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Line Items</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-items">
                {totalItems}
              </div>
              <p className="text-xs text-muted-foreground">Across all categories</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-2">
              {(isAdmin || isCompanyUser) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setNewCategory({ name: "", notes: "" });
                    setAddCategoryDialogOpen(true);
                  }}
                  data-testid="button-add-category"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Category
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Labor Budget Categories</CardTitle>
            <CardDescription>
              Manage pricing for all labor and material line items. Click on a category to expand and edit prices.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full">
              {filteredLabor.map((category) => (
                <AccordionItem key={category.id} value={category.id}>
                  <AccordionTrigger className="hover:no-underline" data-testid={`accordion-category-${category.id}`}>
                    <div className="flex items-center justify-between w-full pr-4">
                      <span className="font-medium">{category.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {category.items?.length || 0} items
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2">
                      <div className="flex justify-end mb-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAddItem(category.id)}
                          data-testid={`button-add-item-${category.id}`}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Add Item
                        </Button>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[200px]">Type</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="w-[80px]">Unit</TableHead>
                            <TableHead className="text-right w-[100px]">Cost</TableHead>
                            <TableHead className="text-right w-[100px]">Material</TableHead>
                            <TableHead className="text-right w-[100px]">Labor</TableHead>
                            <TableHead className="text-right w-[100px]">Retail</TableHead>
                            <TableHead className="w-[100px]">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {category.items?.map((item) => (
                            <TableRow key={item.id} data-testid={`row-item-${item.id}`}>
                              <TableCell className="font-medium text-sm">{item.itemType}</TableCell>
                              <TableCell className="text-sm">{item.description}</TableCell>
                              <TableCell className="text-sm">{item.unitType}</TableCell>
                              <TableCell className="text-right text-sm">
                                {formatCurrency(item.cost)}
                              </TableCell>
                              <TableCell className="text-right text-sm">
                                {formatCurrency(item.materialFee)}
                              </TableCell>
                              <TableCell className="text-right text-sm">
                                {formatCurrency(item.laborRate)}
                              </TableCell>
                              <TableCell className="text-right text-sm font-medium">
                                {formatCurrency(item.retailPrice)}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handleEditItem(item)}
                                    data-testid={`button-edit-${item.id}`}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="text-destructive"
                                    onClick={() => deleteItemMutation.mutate(item.id)}
                                    data-testid={`button-delete-${item.id}`}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          {(!category.items || category.items.length === 0) && (
                            <TableRow>
                              <TableCell colSpan={8} className="py-10">
                                <div className="text-center text-muted-foreground">
                                  <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                  <p className="text-sm font-medium">No items in this category</p>
                                  <p className="text-xs mt-1">Click "Add Item" to add your first line item.</p>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Floor Calculator Pricing</CardTitle>
            <CardDescription>
              Pricing for floor removal and installation types used in the floor calculator.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full">
              {filteredFloor.map((category) => (
                <AccordionItem key={category.id} value={category.id}>
                  <AccordionTrigger className="hover:no-underline" data-testid={`accordion-floor-${category.id}`}>
                    <div className="flex items-center justify-between w-full pr-4">
                      <span className="font-medium">{category.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {category.items?.length || 0} items
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Description</TableHead>
                          <TableHead className="w-[80px]">Unit</TableHead>
                          <TableHead className="text-right w-[100px]">Cost</TableHead>
                          <TableHead className="text-right w-[100px]">Material</TableHead>
                          <TableHead className="text-right w-[100px]">Labor</TableHead>
                          <TableHead className="text-right w-[100px]">Retail</TableHead>
                          <TableHead className="w-[80px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {category.items?.map((item) => (
                          <TableRow key={item.id} data-testid={`row-floor-${item.id}`}>
                            <TableCell className="font-medium">{item.description}</TableCell>
                            <TableCell>{item.unitType}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.cost)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.materialFee)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.laborRate)}</TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(item.retailPrice)}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleEditItem(item)}
                                data-testid={`button-edit-floor-${item.id}`}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </main>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Pricing</DialogTitle>
            <DialogDescription>
              Update the pricing for: {editingItem?.description}
            </DialogDescription>
          </DialogHeader>
          {editingItem && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cost">Cost ($)</Label>
                  <Input
                    id="cost"
                    type="number"
                    step="0.01"
                    value={editingItem.cost || "0"}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, cost: e.target.value })
                    }
                    data-testid="input-cost"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="burdens">Burdens ($)</Label>
                  <Input
                    id="burdens"
                    type="number"
                    step="0.01"
                    value={editingItem.burdens || "0"}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, burdens: e.target.value })
                    }
                    data-testid="input-burdens"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="materialFee">Material/Fees ($)</Label>
                  <Input
                    id="materialFee"
                    type="number"
                    step="0.01"
                    value={editingItem.materialFee || "0"}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, materialFee: e.target.value })
                    }
                    data-testid="input-material"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="laborRate">Labor Rate ($)</Label>
                  <Input
                    id="laborRate"
                    type="number"
                    step="0.01"
                    value={editingItem.laborRate || "0"}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, laborRate: e.target.value })
                    }
                    data-testid="input-labor"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="subRate">Subcontractor ($)</Label>
                  <Input
                    id="subRate"
                    type="number"
                    step="0.01"
                    value={editingItem.subRate || "0"}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, subRate: e.target.value })
                    }
                    data-testid="input-sub"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="retailPrice">Retail Price ($)</Label>
                  <Input
                    id="retailPrice"
                    type="number"
                    step="0.01"
                    value={editingItem.retailPrice || "0"}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, retailPrice: e.target.value })
                    }
                    data-testid="input-retail"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  value={editingItem.notes || ""}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, notes: e.target.value })
                  }
                  data-testid="input-notes"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={updateItemMutation.isPending}
              data-testid="button-save-edit"
            >
              {updateItemMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addCategoryDialogOpen} onOpenChange={setAddCategoryDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Category</DialogTitle>
            <DialogDescription>Create a new pricing category.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newCategoryName">Category Name</Label>
              <Input
                id="newCategoryName"
                value={newCategory.name}
                onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                placeholder="e.g. Electrical, Plumbing"
                data-testid="input-new-category-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newCategoryNotes">Notes (optional)</Label>
              <Input
                id="newCategoryNotes"
                value={newCategory.notes}
                onChange={(e) => setNewCategory({ ...newCategory, notes: e.target.value })}
                data-testid="input-new-category-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddCategoryDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createCategoryMutation.mutate(newCategory)}
              disabled={createCategoryMutation.isPending || !newCategory.name.trim()}
              data-testid="button-create-category"
            >
              {createCategoryMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Add Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addItemDialogOpen} onOpenChange={setAddItemDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Item</DialogTitle>
            <DialogDescription>Add a new line item to the category.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newItemType">Item Type</Label>
              <Input
                id="newItemType"
                value={newItem.itemType}
                onChange={(e) => setNewItem({ ...newItem, itemType: e.target.value })}
                data-testid="input-new-type"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newDescription">Description</Label>
              <Input
                id="newDescription"
                value={newItem.description}
                onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                data-testid="input-new-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="newUnit">Unit Type</Label>
                <Input
                  id="newUnit"
                  value={newItem.unitType}
                  onChange={(e) => setNewItem({ ...newItem, unitType: e.target.value })}
                  data-testid="input-new-unit"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newRetail">Retail Price ($)</Label>
                <Input
                  id="newRetail"
                  type="number"
                  step="0.01"
                  value={newItem.retailPrice}
                  onChange={(e) => setNewItem({ ...newItem, retailPrice: e.target.value })}
                  data-testid="input-new-retail"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddItemDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateItem}
              disabled={createItemMutation.isPending || !newItem.description}
              data-testid="button-create-item"
            >
              {createItemMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Add Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
