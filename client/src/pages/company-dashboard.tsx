import { useState, useEffect, useRef, useCallback } from "react";
import { useConfirm } from "@/hooks/use-confirm";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { 
  Building2, Users, CreditCard, Settings, Plus, Mail, Trash2,
  CheckCircle, Clock, Crown, Wrench, FileText, UserPlus, ChevronRight,
  RefreshCw, AlertCircle, ShieldCheck, AlertTriangle, Lock,
  BookOpen, Tag, Pencil, Package, DollarSign, Upload, Calculator,
  LayoutGrid, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { parseErrorMessage, apiRequest } from "@/lib/queryClient";

const SUBCONTRACTOR_SPECIALTIES = [
  "Plumber", "Electrician", "HVAC Technician", "Roofer", "Carpenter",
  "Painter", "Flooring Specialist", "Mason", "Landscaper", "General Labor"
];

interface PriceCategory {
  id: string;
  name: string;
  notes: string | null;
  displayOrder: number;
  isActive: boolean;
  companyId: string | null;
}

interface PriceItem {
  id: string;
  categoryId: string;
  description: string;
  itemType: string | null;
  unitType: string;
  cost: string | null;
  laborRate: string | null;
  materialFee: string | null;
  retailPrice: string | null;
  notes: string | null;
  displayOrder: number;
  isActive: boolean;
  companyId: string | null;
}

export default function CompanyDashboard() {
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { confirm, ConfirmDialog } = useConfirm();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", contractorType: "contractor", specialty: "", projectId: "" });
  const [activeTab, setActiveTab] = useState(() =>
    location === "/company/team" ? "team" : "overview"
  );

  // Price book state
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<PriceCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: "", notes: "", displayOrder: "0" });
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PriceItem | null>(null);
  const [itemCategoryId, setItemCategoryId] = useState<string>("");
  const [itemForm, setItemForm] = useState({
    description: "", itemType: "", unitType: "EA",
    cost: "0", laborRate: "0", materialFee: "0", retailPrice: "0",
    notes: "", displayOrder: "0",
  });

  // Bulk import state
  interface BulkRow {
    category: string;
    description: string;
    unitType: string;
    laborRate: string;
    materialFee: string;
    retailPrice: string;
    itemType: string;
    _id: number;
  }
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [bulkTab, setBulkTab] = useState<"manual" | "upload" | "mapping">("manual");
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [bulkRowCounter, setBulkRowCounter] = useState(0);
  const [bulkHeaders, setBulkHeaders] = useState<string[]>([]);
  const [bulkRawRows, setBulkRawRows] = useState<Record<string, unknown>[]>([]);
  const [bulkMapping, setBulkMapping] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAPPING_FIELDS = [
    { key: "category", label: "Category", keywords: ["category", "categor"] },
    { key: "description", label: "Description", keywords: ["description", "desc", "item name", "name", "service"] },
    { key: "unitType", label: "Unit", keywords: ["unit"] },
    { key: "laborRate", label: "Labor Rate", keywords: ["labor", "labour", "labor ($)", "labour ($)"] },
    { key: "materialFee", label: "Material Fee", keywords: ["material", "mat ($)", "material ($)"] },
    { key: "retailPrice", label: "Retail Price", keywords: ["retail", "price ($)", "total", "price", "cost"] },
    { key: "itemType", label: "Item Type", keywords: ["item type", "type"] },
  ];

  const autoDetectMapping = (headers: string[]): Record<string, string> => {
    const mapping: Record<string, string> = {};
    const used = new Set<string>();
    for (const field of MAPPING_FIELDS) {
      for (const kw of field.keywords) {
        const match = headers.find(h => !used.has(h) && h.toLowerCase().includes(kw));
        if (match) { mapping[field.key] = match; used.add(match); break; }
      }
    }
    return mapping;
  };

  const applyBulkMapping = () => {
    if (!bulkMapping["description"]) {
      toast({
        title: "Description column required",
        description: "Please map a column to Description before previewing rows.",
        variant: "destructive",
      });
      return;
    }
    const str = (v: unknown) => (v !== undefined && v !== null && v !== "") ? String(v) : "";
    let counter = bulkRowCounter;
    const parsed: typeof bulkRows = bulkRawRows
      .map(r => {
        counter++;
        const get = (field: string) => bulkMapping[field] ? str(r[bulkMapping[field]]) : "";
        const unit = get("unitType") || "EA";
        return {
          category: get("category"),
          description: get("description"),
          unitType: unit.toUpperCase(),
          laborRate: get("laborRate"),
          materialFee: get("materialFee"),
          retailPrice: get("retailPrice"),
          itemType: get("itemType"),
          _id: counter,
        };
      })
      .filter(r => r.description.trim());
    setBulkRowCounter(counter);
    setBulkRows(parsed);
    setBulkTab("manual");
    toast({ title: `${parsed.length} row${parsed.length !== 1 ? "s" : ""} ready to review.` });
  };

  const newBulkRow = useCallback((id: number): BulkRow => ({
    category: "", description: "", unitType: "SF",
    laborRate: "", materialFee: "", retailPrice: "", itemType: "", _id: id,
  }), []);

  const addBulkRow = () => {
    const id = bulkRowCounter + 1;
    setBulkRowCounter(id);
    setBulkRows(r => [...r, newBulkRow(id)]);
  };

  const openBulkImport = () => {
    const id = 1;
    setBulkRowCounter(id);
    setBulkRows([newBulkRow(id)]);
    setBulkTab("manual");
    setBulkHeaders([]);
    setBulkRawRows([]);
    setBulkMapping({});
    setBulkImportOpen(true);
  };

  const isFloorCalcItem = (item: PriceItem) => {
    const unit = (item.unitType || "").toLowerCase();
    const desc = (item.description || "").toLowerCase();
    return unit.includes("sf") || unit.includes("sq") ||
      /floor|tile|carpet|vinyl|hardwood|laminate/i.test(desc);
  };

  useEffect(() => {
    if (location === "/company/team") {
      setActiveTab("team");
    } else if (location === "/company/dashboard") {
      setActiveTab("overview");
    }
  }, [location]);

  const { data: company, isLoading: companyLoading, isError: companyError } = useQuery({
    queryKey: ["/api/company/mine"],
    queryFn: () => apiRequest("GET", "/api/company/mine").then(r => r.json()),
    enabled: user?.role === "company_owner" || user?.isCompanyAdmin === true,
  });

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ["/api/company/members", company?.id],
    queryFn: () => apiRequest("GET", `/api/company/${company.id}/members`).then(r => r.json()),
    enabled: !!company?.id,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["/api/projects"],
    queryFn: () => apiRequest("GET", "/api/projects").then(r => r.json()),
  });

  const { data: roleDefs = [] } = useQuery({
    queryKey: ["/api/role-definitions"],
    queryFn: async () => {
      const res = await fetch("/api/role-definitions", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!company?.id,
  });

  const { data: subscriptionTiers = [] } = useQuery({
    queryKey: ["/api/subscription/tiers"],
    queryFn: async () => {
      const res = await fetch("/api/subscription/tiers", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Price book queries
  const { data: priceCategories = [], refetch: refetchCategories } = useQuery({
    queryKey: ["/api/company/price-book/categories"],
    queryFn: async () => {
      const res = await fetch("/api/company/price-book/categories", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!company?.id,
  });

  const { data: priceItems = [], refetch: refetchItems } = useQuery({
    queryKey: ["/api/company/price-book/items"],
    queryFn: async () => {
      const res = await fetch("/api/company/price-book/items", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!company?.id,
  });

  // Category mutations
  const saveCategoryMutation = useMutation({
    mutationFn: async (data: typeof categoryForm) => {
      const url = editingCategory
        ? `/api/company/price-book/categories/${editingCategory.id}`
        : "/api/company/price-book/categories";
      const method = editingCategory ? "PATCH" : "POST";
      const res = await apiRequest(method, url, { ...data, displayOrder: parseInt(data.displayOrder) || 0 });
      return res.json();
    },
    onSuccess: () => {
      refetchCategories();
      setCategoryDialogOpen(false);
      toast({ title: editingCategory ? "Category updated" : "Category created" });
    },
    onError: (err: Error) => toast({ title: "Error", description: parseErrorMessage(err), variant: "destructive" }),
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/company/price-book/categories/${id}`);
    },
    onSuccess: () => { refetchCategories(); refetchItems(); toast({ title: "Category deleted" }); },
    onError: (err: Error) => toast({ title: "Error", description: parseErrorMessage(err), variant: "destructive" }),
  });

  // Item mutations
  const saveItemMutation = useMutation({
    mutationFn: async (data: typeof itemForm) => {
      const url = editingItem
        ? `/api/company/price-book/items/${editingItem.id}`
        : "/api/company/price-book/items";
      const method = editingItem ? "PATCH" : "POST";
      const payload = {
        ...data,
        categoryId: itemCategoryId,
        displayOrder: parseInt(data.displayOrder) || 0,
        cost: data.cost || "0",
        laborRate: data.laborRate || "0",
        materialFee: data.materialFee || "0",
        retailPrice: data.retailPrice || "0",
      };
      const res = await apiRequest(method, url, payload);
      return res.json();
    },
    onSuccess: () => {
      refetchItems();
      setItemDialogOpen(false);
      toast({ title: editingItem ? "Item updated" : "Item added" });
    },
    onError: (err: Error) => toast({ title: "Error", description: parseErrorMessage(err), variant: "destructive" }),
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/company/price-book/items/${id}`);
    },
    onSuccess: () => { refetchItems(); toast({ title: "Item deleted" }); },
    onError: (err: Error) => toast({ title: "Error", description: parseErrorMessage(err), variant: "destructive" }),
  });

  const bulkImportMutation = useMutation({
    mutationFn: async (items: Array<{ category: string; description: string; unitType: string; laborRate?: string; materialFee?: string; retailPrice?: string; itemType?: string }>) => {
      const res = await apiRequest("POST", "/api/company/price-book/bulk-import", { items });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Import Complete", description: data.message });
      refetchCategories();
      refetchItems();
      setBulkImportOpen(false);
    },
    onError: (err: Error) => toast({ title: "Import Failed", description: parseErrorMessage(err), variant: "destructive" }),
  });

  const openCategoryCreate = () => {
    setEditingCategory(null);
    setCategoryForm({ name: "", notes: "", displayOrder: String(priceCategories.length) });
    setCategoryDialogOpen(true);
  };

  const openCategoryEdit = (cat: PriceCategory) => {
    setEditingCategory(cat);
    setCategoryForm({ name: cat.name, notes: cat.notes || "", displayOrder: String(cat.displayOrder) });
    setCategoryDialogOpen(true);
  };

  const openItemCreate = (categoryId: string) => {
    setEditingItem(null);
    setItemCategoryId(categoryId);
    const catItems = (priceItems as PriceItem[]).filter(i => i.categoryId === categoryId);
    setItemForm({
      description: "", itemType: "", unitType: "EA",
      cost: "0", laborRate: "0", materialFee: "0", retailPrice: "0",
      notes: "", displayOrder: String(catItems.length),
    });
    setItemDialogOpen(true);
  };

  const openItemEdit = (item: PriceItem) => {
    setEditingItem(item);
    setItemCategoryId(item.categoryId);
    setItemForm({
      description: item.description,
      itemType: item.itemType ?? "",
      unitType: item.unitType,
      cost: item.cost || "0",
      laborRate: item.laborRate || "0",
      materialFee: item.materialFee || "0",
      retailPrice: item.retailPrice || "0",
      notes: item.notes || "",
      displayOrder: String(item.displayOrder),
    });
    setItemDialogOpen(true);
  };

  // Trial calculation
  const TRIAL_DAYS = 7;
  const trialStartedAt = company?.trialStartedAt ? new Date(company.trialStartedAt) : null;
  const trialEndsAt = trialStartedAt ? new Date(trialStartedAt.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000) : null;
  const now = new Date();
  const isTrialing = company?.subscriptionStatus === "trialing";
  const isExpired = company?.subscriptionStatus === "expired" || (isTrialing && trialEndsAt !== null && now > trialEndsAt);
  const trialDaysRemaining = trialEndsAt && isTrialing && !isExpired
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
    : 0;
  const isActive = company?.subscriptionStatus === "active";

  const inviteMutation = useMutation({
    mutationFn: async (data: { email: string; contractorType: string; specialty?: string; projectId?: string }) => {
      const res = await fetch("/api/contractor-invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: data.email,
          companyId: company?.id,
          contractorType: data.contractorType,
          subcontractorSpecialty: data.specialty || null,
          projectId: data.projectId || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to send invite");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Invite sent!", description: `Invitation sent to ${inviteForm.email}` });
      setInviteOpen(false);
      setInviteForm({ email: "", contractorType: "contractor", specialty: "", projectId: "" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: parseErrorMessage(err), variant: "destructive" });
    },
  });

  const assignRoleMutation = useMutation({
    mutationFn: async ({ userId, roleDefinitionId }: { userId: string; roleDefinitionId: string | null }) => {
      const res = await fetch(`/api/company/${company?.id}/members/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ roleDefinitionId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to assign role");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/members"] });
      toast({ title: "Role assigned" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: parseErrorMessage(err), variant: "destructive" });
    },
  });

  const toggleAdminMutation = useMutation({
    mutationFn: async ({ userId, isCompanyAdmin }: { userId: string; isCompanyAdmin: boolean }) => {
      const res = await fetch(`/api/company/${company?.id}/members/${userId}/admin`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isCompanyAdmin }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to update admin status");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/members"] });
      toast({ title: "Admin status updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: parseErrorMessage(err), variant: "destructive" });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("DELETE", `/api/company/${company?.id}/members/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/members"] });
      toast({ title: "Member removed" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: parseErrorMessage(err), variant: "destructive" });
    },
  });

  const activeProjects = projects.filter((p: any) => p.status !== "completed");
  const completedProjects = projects.filter((p: any) => p.status === "completed");

  if (companyLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (companyError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <AlertCircle className="w-10 h-10 text-destructive" />
        <div>
          <p className="font-semibold text-lg">Failed to load company data</p>
          <p className="text-muted-foreground text-sm mt-1">There was a problem connecting to the server. Please refresh the page.</p>
        </div>
      </div>
    );
  }

  if (!company && user?.role === "company_owner") {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="w-10 h-10 text-muted-foreground" />
        <p className="text-muted-foreground">No company found for your account.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Trial countdown banner */}
      {isTrialing && !isExpired && trialDaysRemaining <= TRIAL_DAYS && (
        <div
          className={`rounded-lg border px-4 py-3 flex items-center gap-3 ${
            trialDaysRemaining <= 2
              ? "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800"
              : "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800"
          }`}
          data-testid="trial-banner"
        >
          <AlertTriangle className={`w-5 h-5 shrink-0 ${trialDaysRemaining <= 2 ? "text-red-500" : "text-amber-500"}`} />
          <div className="flex-1">
            <p className={`font-medium text-sm ${trialDaysRemaining <= 2 ? "text-red-700 dark:text-red-300" : "text-amber-700 dark:text-amber-300"}`}>
              {trialDaysRemaining === 0
                ? "Your trial expires today!"
                : trialDaysRemaining === 1
                ? "1 day remaining in your free trial"
                : `${trialDaysRemaining} days remaining in your free trial`}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Upgrade to keep full access to all BuildVision features after your trial ends.
            </p>
          </div>
          <Button
            size="sm"
            variant={trialDaysRemaining <= 2 ? "destructive" : "default"}
            onClick={() => setActiveTab("subscription")}
            data-testid="button-upgrade-from-banner"
          >
            Upgrade Now
          </Button>
        </div>
      )}

      {/* Trial expired screen */}
      {isExpired && (
        <div className="rounded-xl border-2 border-destructive/40 bg-destructive/5 p-8 text-center space-y-4" data-testid="trial-expired-screen">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8 text-destructive" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Trial Expired</h2>
            <p className="text-muted-foreground mt-1 max-w-md mx-auto">
              Your 7-day free trial has ended. Upgrade to a paid plan to continue using BuildVision's contractor features.
            </p>
          </div>
          <Button
            onClick={() => setActiveTab("subscription")}
            size="lg"
            className="mt-2"
            data-testid="button-upgrade-expired"
          >
            <CreditCard className="w-4 h-4 mr-2" />
            View Plans & Upgrade
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold" data-testid="company-name">{company?.name || "My Company"}</h1>
          <p className="text-muted-foreground mt-1">Manage your company, team, and subscription</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant={isActive ? "default" : isExpired ? "destructive" : "secondary"}
            className="capitalize"
            data-testid="subscription-status"
          >
            {isExpired ? "Expired" : isTrialing ? `Trial — ${trialDaysRemaining}d left` : (company?.subscriptionPlan || "free")}
          </Badge>
        </div>
      </div>

      <Tabs value={isExpired ? "subscription" : activeTab} onValueChange={isExpired ? undefined : setActiveTab}>
        <TabsList data-testid="company-tabs">
          <TabsTrigger value="overview" disabled={isExpired} data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="team" disabled={isExpired} data-testid="tab-team">Team</TabsTrigger>
          <TabsTrigger value="price-book" disabled={isExpired} data-testid="tab-price-book">Price Book</TabsTrigger>
          <TabsTrigger value="subscription" data-testid="tab-subscription">Subscription</TabsTrigger>
          <TabsTrigger value="settings" disabled={isExpired} data-testid="tab-settings">Settings</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card data-testid="card-active-projects">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Active Projects</p>
                    <p className="text-3xl font-bold mt-1">{activeProjects.length}</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <FileText className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card data-testid="card-team-members">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Team Members</p>
                    <p className="text-3xl font-bold mt-1">{members.length + 1}</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <Users className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card data-testid="card-completed-projects">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Completed Projects</p>
                    <p className="text-3xl font-bold mt-1">{completedProjects.length}</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Projects */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Projects</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate("/contractor/projects")} data-testid="button-view-all-projects">
                  View All <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {projects.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p>No projects yet.</p>
                  <Button className="mt-3" onClick={() => navigate("/contractor/new-project")} data-testid="button-create-project">
                    Create First Project
                  </Button>
                </div>
              ) : (
                <div className="divide-y">
                  {projects.slice(0, 5).map((project: any) => (
                    <div
                      key={project.id}
                      className="py-3 flex items-center justify-between hover:bg-muted/30 cursor-pointer px-2 rounded"
                      onClick={() => navigate(`/contractor/project/${project.id}`)}
                      data-testid={`project-row-${project.id}`}
                    >
                      <div>
                        <p className="font-medium">{project.name}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={project.status === "active" ? "default" : "secondary"} className="capitalize">
                          {project.status}
                        </Badge>
                        <span className="text-sm text-muted-foreground">{project.progress || 0}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Team Members</h2>
              <p className="text-muted-foreground text-sm">Manage your company team and subcontractors</p>
            </div>
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-invite-member">
                  <UserPlus className="w-4 h-4 mr-2" /> Invite Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite Team Member</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div>
                    <Label>Email Address</Label>
                    <Input
                      type="email"
                      placeholder="team@example.com"
                      value={inviteForm.email}
                      onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
                      data-testid="input-invite-email"
                    />
                  </div>
                  <div>
                    <Label>Role Type</Label>
                    <Select
                      value={inviteForm.contractorType}
                      onValueChange={v => setInviteForm(f => ({ ...f, contractorType: v }))}
                    >
                      <SelectTrigger data-testid="select-contractor-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="contractor">Contractor (Team Member)</SelectItem>
                        <SelectItem value="notary">Notary</SelectItem>
                        <SelectItem value="subcontractor">Subcontractor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {inviteForm.contractorType === "subcontractor" && (
                    <>
                      <div>
                        <Label>Trade Specialty</Label>
                        <Select
                          value={inviteForm.specialty}
                          onValueChange={v => setInviteForm(f => ({ ...f, specialty: v }))}
                        >
                          <SelectTrigger data-testid="select-specialty">
                            <SelectValue placeholder="Select specialty..." />
                          </SelectTrigger>
                          <SelectContent>
                            {SUBCONTRACTOR_SPECIALTIES.map(s => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Assign to Project <span className="text-muted-foreground text-xs">(optional)</span></Label>
                        <Select
                          value={inviteForm.projectId}
                          onValueChange={v => setInviteForm(f => ({ ...f, projectId: v === "_none" ? "" : v }))}
                        >
                          <SelectTrigger data-testid="select-project">
                            <SelectValue placeholder="Select project..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">No specific project</SelectItem>
                            {projects.map((p: any) => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
                  <Button
                    onClick={() => inviteMutation.mutate({
                      email: inviteForm.email,
                      contractorType: inviteForm.contractorType,
                      specialty: inviteForm.specialty,
                      projectId: inviteForm.projectId || undefined,
                    })}
                    disabled={!inviteForm.email || inviteMutation.isPending}
                    data-testid="button-send-invite"
                  >
                    {inviteMutation.isPending ? "Sending..." : "Send Invite"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Owner card */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-primary/5 border border-primary/10">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
                      <Crown className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{user?.name || user?.username}</p>
                      <p className="text-xs text-muted-foreground">{user?.email}</p>
                    </div>
                  </div>
                  <Badge>Company Owner</Badge>
                </div>

                {membersLoading ? (
                  <div className="text-center py-4 text-muted-foreground text-sm">Loading members...</div>
                ) : members.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No team members yet. Invite your first member above.</p>
                  </div>
                ) : (
                  members.map((member: any) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/30"
                      data-testid={`member-row-${member.userId}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                          <Wrench className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">{member.user?.name || member.user?.username || "Unknown"}</p>
                          <p className="text-xs text-muted-foreground">
                            {member.user?.contractorType === "notary" ? "Notary" : 
                             member.user?.contractorType === "subcontractor" 
                               ? `Subcontractor · ${member.user?.subcontractorSpecialty || "General"}`
                               : "Contractor"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {roleDefs.length > 0 && (
                          <Select
                            value={member.roleDefinitionId || "_none"}
                            onValueChange={v => assignRoleMutation.mutate({ userId: member.userId, roleDefinitionId: v === "_none" ? null : v })}
                          >
                            <SelectTrigger className="h-7 w-32 text-xs" data-testid={`select-role-${member.userId}`}>
                              <SelectValue placeholder="Assign role..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_none">No role</SelectItem>
                              {roleDefs.map((rd: any) => (
                                <SelectItem key={rd.id} value={rd.id}>{rd.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        <div className="flex items-center gap-1" title={member.user?.isCompanyAdmin ? "Company Admin" : "Make Admin"}>
                          <ShieldCheck className={`w-4 h-4 ${member.user?.isCompanyAdmin ? "text-primary" : "text-muted-foreground/30"}`} />
                          <Switch
                            checked={!!member.user?.isCompanyAdmin}
                            onCheckedChange={v => toggleAdminMutation.mutate({ userId: member.userId, isCompanyAdmin: v })}
                            disabled={toggleAdminMutation.isPending}
                            data-testid={`toggle-admin-${member.userId}`}
                          />
                        </div>
                        <Badge variant="outline" className="capitalize">
                          {member.status}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => removeMemberMutation.mutate(member.userId)}
                          disabled={removeMemberMutation.isPending}
                          data-testid={`button-remove-member-${member.userId}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Price Book Tab */}
        <TabsContent value="price-book" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <BookOpen className="w-5 h-5" /> Price Book
              </h2>
              <p className="text-muted-foreground text-sm">Manage your company's pricing categories and line items</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={openBulkImport} data-testid="button-bulk-import">
                <Upload className="w-4 h-4 mr-2" /> Bulk Import
              </Button>
              <Button onClick={openCategoryCreate} data-testid="button-add-category">
                <Plus className="w-4 h-4 mr-2" /> Add Category
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md px-3 py-2">
            <Calculator className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span>Items with <strong>SF</strong> or <strong>SQ</strong> unit types (or flooring keywords in the description) automatically appear in the <strong>Floor Calculator</strong>.</span>
          </div>

          {priceCategories.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No price book categories yet</p>
                <p className="text-sm mt-1">Create a category to start building your price book.</p>
                <Button className="mt-4" onClick={openCategoryCreate} data-testid="button-create-first-category">
                  <Plus className="w-4 h-4 mr-2" /> Create First Category
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Accordion type="multiple" className="space-y-3" data-testid="price-book-accordion">
              {(priceCategories as PriceCategory[]).map((cat) => {
                const catItems = (priceItems as PriceItem[]).filter(i => i.categoryId === cat.id);
                return (
                  <AccordionItem key={cat.id} value={cat.id} className="border rounded-lg px-4" data-testid={`category-${cat.id}`}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3 flex-1 mr-4">
                        <Tag className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="font-medium">{cat.name}</span>
                        <Badge variant="secondary" className="ml-auto">{catItems.length} item{catItems.length !== 1 ? "s" : ""}</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="pt-2 pb-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => openCategoryEdit(cat)} data-testid={`button-edit-category-${cat.id}`}>
                              <Pencil className="w-3 h-3 mr-1" /> Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={async () => {
                                const ok = await confirm({
                                  title: `Delete "${cat.name}"?`,
                                  description: "This will permanently delete the category and all its items.",
                                  confirmLabel: "Delete",
                                  destructive: true,
                                });
                                if (ok) deleteCategoryMutation.mutate(cat.id);
                              }}
                              disabled={deleteCategoryMutation.isPending}
                              data-testid={`button-delete-category-${cat.id}`}
                            >
                              <Trash2 className="w-3 h-3 mr-1" /> Delete
                            </Button>
                          </div>
                          <Button size="sm" onClick={() => openItemCreate(cat.id)} data-testid={`button-add-item-${cat.id}`}>
                            <Plus className="w-3 h-3 mr-1" /> Add Item
                          </Button>
                        </div>

                        {catItems.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">No items in this category.</p>
                        ) : (
                          <div className="rounded-md border overflow-hidden">
                            <table className="w-full text-sm">
                              <thead className="bg-muted/40">
                                <tr>
                                  <th className="text-left p-2 pl-3 font-medium">Description</th>
                                  <th className="text-left p-2 font-medium">Type</th>
                                  <th className="text-left p-2 font-medium">Unit</th>
                                  <th className="text-right p-2 font-medium">Labor</th>
                                  <th className="text-right p-2 font-medium">Material</th>
                                  <th className="text-right p-2 font-medium">Price</th>
                                  <th className="w-20 p-2"></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                {catItems.map((item) => (
                                  <tr key={item.id} className="hover:bg-muted/20" data-testid={`item-row-${item.id}`}>
                                    <td className="p-2 pl-3 font-medium">
                                      <div className="flex items-center gap-2">
                                        {item.description}
                                        {isFloorCalcItem(item) && (
                                          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded px-1.5 py-0.5" title="Appears in Floor Calculator">
                                            <Calculator className="w-2.5 h-2.5" /> FC
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="p-2 text-muted-foreground">{item.itemType}</td>
                                    <td className="p-2">{item.unitType}</td>
                                    <td className="p-2 text-right">{item.laborRate ? `$${parseFloat(item.laborRate).toFixed(2)}` : "-"}</td>
                                    <td className="p-2 text-right">{item.materialFee ? `$${parseFloat(item.materialFee).toFixed(2)}` : "-"}</td>
                                    <td className="p-2 text-right font-medium text-primary">{item.retailPrice ? `$${parseFloat(item.retailPrice).toFixed(2)}` : "-"}</td>
                                    <td className="p-2">
                                      <div className="flex gap-1 justify-end">
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openItemEdit(item)} data-testid={`button-edit-item-${item.id}`}>
                                          <Pencil className="w-3 h-3" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7 text-destructive hover:text-destructive"
                                          onClick={async () => {
                                            const ok = await confirm({
                                              title: "Delete item?",
                                              description: "This item will be permanently removed from the price book.",
                                              confirmLabel: "Delete",
                                              destructive: true,
                                            });
                                            if (ok) deleteItemMutation.mutate(item.id);
                                          }}
                                          disabled={deleteItemMutation.isPending}
                                          data-testid={`button-delete-item-${item.id}`}
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}

          {/* Category Dialog */}
          <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingCategory ? "Edit Category" : "New Category"}</DialogTitle>
                <DialogDescription>Define a price book category to group related items.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label>Category Name</Label>
                  <Input
                    placeholder="e.g. Electrical, Plumbing, HVAC"
                    value={categoryForm.name}
                    onChange={e => setCategoryForm(f => ({ ...f, name: e.target.value }))}
                    data-testid="input-category-name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Textarea
                    placeholder="Internal notes about this category"
                    value={categoryForm.notes}
                    onChange={e => setCategoryForm(f => ({ ...f, notes: e.target.value }))}
                    rows={2}
                    data-testid="input-category-notes"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Sort Order</Label>
                  <Input
                    type="number"
                    min="0"
                    value={categoryForm.displayOrder}
                    onChange={e => setCategoryForm(f => ({ ...f, displayOrder: e.target.value }))}
                    data-testid="input-category-order"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => saveCategoryMutation.mutate(categoryForm)}
                  disabled={!categoryForm.name.trim() || saveCategoryMutation.isPending}
                  data-testid="button-save-category"
                >
                  {saveCategoryMutation.isPending ? "Saving…" : editingCategory ? "Save Changes" : "Create Category"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Item Dialog */}
          <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingItem ? "Edit Item" : "New Line Item"}</DialogTitle>
                <DialogDescription>Add pricing details for this line item.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5 col-span-2">
                    <Label>Description</Label>
                    <Input
                      placeholder="e.g. Install outlet"
                      value={itemForm.description}
                      onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))}
                      data-testid="input-item-description"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Item Type</Label>
                    <Input
                      placeholder="e.g. Labor, Material"
                      value={itemForm.itemType}
                      onChange={e => setItemForm(f => ({ ...f, itemType: e.target.value }))}
                      data-testid="input-item-type"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Unit</Label>
                    <Select value={itemForm.unitType} onValueChange={v => setItemForm(f => ({ ...f, unitType: v }))}>
                      <SelectTrigger data-testid="select-item-unit">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["EA", "SF", "LF", "HR", "LS", "SQ", "CY", "GAL", "TON"].map(u => (
                          <SelectItem key={u} value={u}>{u}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Labor Rate ($)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={itemForm.laborRate}
                      onChange={e => setItemForm(f => ({ ...f, laborRate: e.target.value }))}
                      data-testid="input-item-labor"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Material Fee ($)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={itemForm.materialFee}
                      onChange={e => setItemForm(f => ({ ...f, materialFee: e.target.value }))}
                      data-testid="input-item-material"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cost ($)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={itemForm.cost}
                      onChange={e => setItemForm(f => ({ ...f, cost: e.target.value }))}
                      data-testid="input-item-cost"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Retail Price ($)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={itemForm.retailPrice}
                      onChange={e => setItemForm(f => ({ ...f, retailPrice: e.target.value }))}
                      data-testid="input-item-price"
                    />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
                    <Textarea
                      placeholder="Internal notes"
                      value={itemForm.notes}
                      onChange={e => setItemForm(f => ({ ...f, notes: e.target.value }))}
                      rows={2}
                      data-testid="input-item-notes"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setItemDialogOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => saveItemMutation.mutate(itemForm)}
                  disabled={!itemForm.description.trim() || saveItemMutation.isPending}
                  data-testid="button-save-item"
                >
                  {saveItemMutation.isPending ? "Saving…" : editingItem ? "Save Changes" : "Add Item"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Bulk Import Dialog */}
          <Dialog open={bulkImportOpen} onOpenChange={setBulkImportOpen}>
            <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" /> Bulk Import Price Book Items
                </DialogTitle>
                <DialogDescription>
                  Add multiple items at once. Fill in the table manually or upload an Excel/CSV file. Review and edit before saving.
                </DialogDescription>
              </DialogHeader>

              {/* Tab selector */}
              <div className="flex gap-2 border-b pb-3">
                <Button
                  variant={bulkTab === "manual" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setBulkTab("manual")}
                  data-testid="bulk-tab-manual"
                >
                  <LayoutGrid className="w-3.5 h-3.5 mr-1.5" /> Manual Entry
                </Button>
                <Button
                  variant={bulkTab === "upload" || bulkTab === "mapping" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setBulkTab(bulkRawRows.length > 0 ? "mapping" : "upload")}
                  data-testid="bulk-tab-upload"
                >
                  <Upload className="w-3.5 h-3.5 mr-1.5" /> Upload Excel / CSV
                </Button>
              </div>

              {/* Column mapping step — shown after file is parsed */}
              {bulkTab === "mapping" && (
                <div className="flex-1 overflow-auto space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Map your columns</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {bulkRawRows.length} row{bulkRawRows.length !== 1 ? "s" : ""} detected &mdash; assign which spreadsheet column maps to each field.
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setBulkTab("upload")} data-testid="button-remap-reupload">
                      Upload different file
                    </Button>
                  </div>
                  <div className="rounded-md border divide-y text-sm">
                    {MAPPING_FIELDS.map(field => (
                      <div key={field.key} className="flex items-center gap-4 px-4 py-2.5">
                        <span className="w-32 font-medium shrink-0">
                          {field.label}
                          {field.key === "description" && <span className="text-destructive ml-0.5">*</span>}
                        </span>
                        <Select
                          value={bulkMapping[field.key] ?? "__skip__"}
                          onValueChange={v => setBulkMapping(m => ({ ...m, [field.key]: v === "__skip__" ? "" : v }))}
                        >
                          <SelectTrigger className="h-8 text-xs flex-1" data-testid={`mapping-select-${field.key}`}>
                            <SelectValue placeholder="— skip —" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__skip__">— skip —</SelectItem>
                            {bulkHeaders.map(h => (
                              <SelectItem key={h} value={h}>{h}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {bulkMapping[field.key] && bulkRawRows[0] && (
                          <span className="text-xs text-muted-foreground truncate max-w-[140px]" title={String(bulkRawRows[0][bulkMapping[field.key]] ?? "")}>
                            e.g. {String(bulkRawRows[0][bulkMapping[field.key]] ?? "")}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  {!bulkMapping["description"] && (
                    <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                      Description is required — please map a column to it before previewing.
                    </p>
                  )}
                  <div className="flex justify-end">
                    <Button onClick={applyBulkMapping} data-testid="button-apply-mapping">
                      Preview Rows →
                    </Button>
                  </div>
                </div>
              )}

              {bulkTab === "upload" && (
                <div className="space-y-3">
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center space-y-3">
                    <Upload className="w-8 h-8 mx-auto text-muted-foreground/50" />
                    <div>
                      <p className="font-medium">Upload your Excel or CSV file</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Expected columns: <code className="bg-muted rounded px-1">Category</code>, <code className="bg-muted rounded px-1">Description</code>, <code className="bg-muted rounded px-1">Unit</code>, <code className="bg-muted rounded px-1">Labor Rate</code>, <code className="bg-muted rounded px-1">Material Fee</code>, <code className="bg-muted rounded px-1">Retail Price</code>, <code className="bg-muted rounded px-1">Item Type</code>
                      </p>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      data-testid="input-bulk-file"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const formData = new FormData();
                        formData.append("file", file);
                        fetch("/api/company/price-book/parse-file", {
                          method: "POST",
                          body: formData,
                          credentials: "include",
                        })
                          .then(async r => {
                            if (!r.ok) throw new Error(await r.text());
                            return r.json() as Promise<{ rows: Record<string, unknown>[]; headers: string[] }>;
                          })
                          .then(({ rows, headers }) => {
                            setBulkHeaders(headers);
                            setBulkRawRows(rows);
                            const detected = autoDetectMapping(headers);
                            setBulkMapping(detected);
                            setBulkTab("mapping");
                          })
                          .catch(err => {
                            console.error("parse-file error:", err);
                            toast({ title: "Parse Error", description: "Could not read that file. Check the format.", variant: "destructive" });
                          })
                          .finally(() => {
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          });
                      }}
                    />
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()} data-testid="button-choose-file">
                      Choose File
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground bg-muted/50 rounded p-3">
                    <strong>Template tip:</strong> Create an Excel file with headers: Category | Description | Unit | Labor Rate | Material Fee | Retail Price | Item Type. Each row becomes one price book item. Items with the same category name are grouped together automatically.
                  </div>
                </div>
              )}

              {/* Review table — always visible on manual tab, also shown after upload parses rows */}
              {(bulkTab === "manual" || bulkRows.length > 0) && (
                <div className="flex-1 overflow-auto space-y-3">
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-sm min-w-[900px]">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-2 pl-3 font-medium w-36">Category</th>
                          <th className="text-left p-2 font-medium">Description</th>
                          <th className="text-left p-2 font-medium w-20">Unit</th>
                          <th className="text-left p-2 font-medium w-24">Labor ($)</th>
                          <th className="text-left p-2 font-medium w-24">Material ($)</th>
                          <th className="text-left p-2 font-medium w-24">Price ($)</th>
                          <th className="text-left p-2 font-medium w-28">Item Type</th>
                          <th className="w-8 p-2"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {bulkRows.map((row) => (
                          <tr key={row._id} className="hover:bg-muted/20">
                            <td className="p-1">
                              <Input
                                placeholder="Category"
                                value={row.category}
                                onChange={e => setBulkRows(rs => rs.map(r => r._id === row._id ? { ...r, category: e.target.value } : r))}
                                className="h-7 text-xs"
                                data-testid={`bulk-category-${row._id}`}
                              />
                            </td>
                            <td className="p-1">
                              <Input
                                placeholder="Description *"
                                value={row.description}
                                onChange={e => setBulkRows(rs => rs.map(r => r._id === row._id ? { ...r, description: e.target.value } : r))}
                                className="h-7 text-xs"
                                data-testid={`bulk-description-${row._id}`}
                              />
                            </td>
                            <td className="p-1">
                              <Select value={row.unitType} onValueChange={v => setBulkRows(rs => rs.map(r => r._id === row._id ? { ...r, unitType: v } : r))}>
                                <SelectTrigger className="h-7 text-xs" data-testid={`bulk-unit-${row._id}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {["EA", "SF", "LF", "HR", "LS", "SQ", "CY", "GAL", "TON"].map(u => (
                                    <SelectItem key={u} value={u}>{u}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="p-1">
                              <Input
                                placeholder="0.00"
                                type="number"
                                min="0"
                                step="0.01"
                                value={row.laborRate}
                                onChange={e => setBulkRows(rs => rs.map(r => r._id === row._id ? { ...r, laborRate: e.target.value } : r))}
                                className="h-7 text-xs"
                                data-testid={`bulk-labor-${row._id}`}
                              />
                            </td>
                            <td className="p-1">
                              <Input
                                placeholder="0.00"
                                type="number"
                                min="0"
                                step="0.01"
                                value={row.materialFee}
                                onChange={e => setBulkRows(rs => rs.map(r => r._id === row._id ? { ...r, materialFee: e.target.value } : r))}
                                className="h-7 text-xs"
                                data-testid={`bulk-material-${row._id}`}
                              />
                            </td>
                            <td className="p-1">
                              <Input
                                placeholder="0.00"
                                type="number"
                                min="0"
                                step="0.01"
                                value={row.retailPrice}
                                onChange={e => setBulkRows(rs => rs.map(r => r._id === row._id ? { ...r, retailPrice: e.target.value } : r))}
                                className="h-7 text-xs"
                                data-testid={`bulk-price-${row._id}`}
                              />
                            </td>
                            <td className="p-1">
                              <Input
                                placeholder="Labor/Material"
                                value={row.itemType}
                                onChange={e => setBulkRows(rs => rs.map(r => r._id === row._id ? { ...r, itemType: e.target.value } : r))}
                                className="h-7 text-xs"
                                data-testid={`bulk-type-${row._id}`}
                              />
                            </td>
                            <td className="p-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => setBulkRows(rs => rs.filter(r => r._id !== row._id))}
                                data-testid={`bulk-delete-${row._id}`}
                              >
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Button variant="outline" size="sm" onClick={addBulkRow} data-testid="button-bulk-add-row">
                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Row
                  </Button>
                </div>
              )}

              <DialogFooter className="mt-auto pt-3 border-t">
                <div className="flex items-center gap-2 mr-auto text-sm text-muted-foreground">
                  {bulkTab === "mapping" ? (
                    <span>{bulkRawRows.length} row{bulkRawRows.length !== 1 ? "s" : ""} detected from file</span>
                  ) : (
                    <>
                      <span>{bulkRows.filter(r => r.description.trim()).length} valid item{bulkRows.filter(r => r.description.trim()).length !== 1 ? "s" : ""} ready to import</span>
                      {bulkRawRows.length > 0 && bulkTab === "manual" && (
                        <button
                          className="text-primary underline-offset-2 hover:underline text-sm"
                          onClick={() => setBulkTab("mapping")}
                          data-testid="button-remap-columns"
                        >
                          Re-map columns
                        </button>
                      )}
                    </>
                  )}
                </div>
                <Button variant="outline" onClick={() => setBulkImportOpen(false)}>Cancel</Button>
                {bulkTab === "mapping" ? (
                  <Button onClick={applyBulkMapping} data-testid="button-mapping-preview">
                    Preview Rows →
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      const validRows = bulkRows.filter(r => r.description.trim());
                      if (validRows.length === 0) {
                        toast({ title: "No Items", description: "Add at least one item with a description.", variant: "destructive" });
                        return;
                      }
                      bulkImportMutation.mutate(validRows.map(r => ({
                        category: r.category.trim() || "Uncategorized",
                        description: r.description.trim(),
                        unitType: r.unitType,
                        laborRate: r.laborRate || undefined,
                        materialFee: r.materialFee || undefined,
                        retailPrice: r.retailPrice || undefined,
                        itemType: r.itemType || undefined,
                      })));
                    }}
                    disabled={bulkImportMutation.isPending}
                    data-testid="button-bulk-save"
                  >
                    {bulkImportMutation.isPending ? "Importing…" : "Import Items"}
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Subscription Tab */}
        <TabsContent value="subscription" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Subscription Plan
              </CardTitle>
              <CardDescription>Manage your BuildVision subscription</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Current status card */}
              <div className={`rounded-lg border p-4 ${isExpired ? "bg-destructive/5 border-destructive/30" : isTrialing ? "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800" : "bg-muted/30"}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold capitalize text-lg">
                      {isExpired ? "Trial Expired" : isTrialing ? "Free Trial" : `${company?.subscriptionPlan || "Free"} Plan`}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {isExpired
                        ? "Your trial ended. Upgrade to restore access."
                        : isTrialing
                        ? trialEndsAt
                          ? `Trial ends ${trialEndsAt.toLocaleDateString()} — ${trialDaysRemaining} day${trialDaysRemaining !== 1 ? "s" : ""} remaining`
                          : "Trial active"
                        : `Status: ${company?.subscriptionStatus || "active"}`
                      }
                    </p>
                  </div>
                  <Badge
                    variant={isActive ? "default" : isExpired ? "destructive" : "secondary"}
                    className="capitalize"
                    data-testid="subscription-status-badge"
                  >
                    {isExpired ? "Expired" : isTrialing ? "Trialing" : company?.subscriptionStatus || "active"}
                  </Badge>
                </div>
              </div>

              {/* Plan tiers from DB */}
              {subscriptionTiers.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {subscriptionTiers.map((tier: any) => {
                    const isCurrent = !isTrialing && !isExpired && company?.subscriptionPlan === tier.name.toLowerCase();
                    const price = parseFloat(tier.price);
                    const priceStr = price === 0 ? "$0/mo" : `$${price % 1 === 0 ? price.toFixed(0) : price.toFixed(2)}/mo`;
                    return (
                      <div
                        key={tier.id}
                        className={`rounded-lg border p-4 space-y-3 ${isCurrent ? "border-primary bg-primary/5" : ""}`}
                        data-testid={`plan-card-${tier.name.toLowerCase()}`}
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-semibold">{tier.name}</p>
                          {isCurrent && <Badge className="text-xs">Current</Badge>}
                        </div>
                        <p className="text-2xl font-bold">{priceStr}</p>
                        {tier.maxProjects && (
                          <p className="text-xs text-muted-foreground">Up to {tier.maxProjects} projects</p>
                        )}
                        <ul className="space-y-1">
                          {(tier.features || []).map((f: string) => (
                            <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                              <CheckCircle className="w-3 h-3 text-green-500 shrink-0" />
                              {f}
                            </li>
                          ))}
                        </ul>
                        {!isCurrent && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            data-testid={`button-upgrade-${tier.name.toLowerCase()}`}
                            onClick={() => toast({ title: "Coming soon", description: "Subscription upgrades will be available soon. Contact support to upgrade." })}
                          >
                            {price === 0 ? "Select" : "Upgrade"}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                  <p className="text-sm">No plans available yet. Contact support to upgrade your subscription.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Company Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Company Name</Label>
                <Input defaultValue={company?.name} data-testid="input-company-name" />
              </div>
              <div className="pt-2">
                <Button data-testid="button-save-company">Save Changes</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <ConfirmDialog />
    </div>
  );
}
