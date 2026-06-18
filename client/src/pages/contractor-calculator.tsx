import { useState, useMemo } from "react";
import { useLocation, Link } from "wouter";
import { useConfirm } from "@/hooks/use-confirm";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Save,
  X,
  Loader2,
  Download,
  Info,
  Link2,
  FolderOpen,
  ExternalLink,
  Settings,
} from "lucide-react";
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

interface CompanyFinancialSettings {
  defaultOverheadPct: string | null;
  defaultMarkupPct: string | null;
  defaultLaborBurdenPct: string | null;
  defaultMaterialMarkupPct: string | null;
  defaultSubcontractorMarkupPct: string | null;
  defaultEquipmentCostPct: string | null;
  overheadNotes: string | null;
}

interface SavedEstimate {
  id: string;
  customId: string;
  clientName: string;
  projectName: string;
  amount: string;
  status: string;
  date: string;
  projectId?: string | null;
  companyId?: string | null;
}

interface SavedEstimateLineItem {
  id: string;
  estimateId: string;
  category: string;
  item: string;
  quantity: string;
  unit: string;
  rate: string;
  total: string;
  priceBookItemId: string | null;
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

// ── Branding PDF helpers ─────────────────────────────────────────────────────

interface CompanyBranding {
  logo: string | null;
  name: string;
  primaryColor: string | null;
  accentColor: string | null;
  quoteFooterText: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
  companyAddress: string | null;
  companyWebsite: string | null;
}

// fallback is a per-field RGB default: primary=[31,41,55]=#1f2937, accent=[217,119,6]=#d97706
function hexToRgb(
  hex: string | null | undefined,
  fallback: [number, number, number] = [31, 41, 55]
): [number, number, number] {
  if (!hex) return fallback;
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return fallback;
  return [r, g, b];
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function getImageNaturalDims(src: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 100, h: 50 });
    img.src = src;
  });
}

async function loadLogoForPdf(
  b: CompanyBranding | null | undefined
): Promise<{ dataUrl: string; format: string; w: number; h: number } | null> {
  if (!b?.logo) return null;
  try {
    const res = await fetch("/api/company/branding/logo", { credentials: "include" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await blobToDataUrl(blob);
    const dims = await getImageNaturalDims(dataUrl);
    const maxW = 38, maxH = 18;
    const ratio = dims.w / Math.max(dims.h, 1);
    let w = Math.min(maxW, ratio * maxH);
    let h = w / ratio;
    if (h > maxH) { h = maxH; w = h * ratio; }
    const format = blob.type.includes("png") ? "PNG" : blob.type.includes("webp") ? "WEBP" : "JPEG";
    return { dataUrl, format, w, h };
  } catch {
    return null;
  }
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  approved: "Approved",
  declined: "Declined",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  declined: "bg-red-100 text-red-700",
};

// ── Shared PDF estimate renderer ──────────────────────────────────────────────
// Both export paths call this with a normalized options object so the layout
// is pixel-identical between the Calculator-tab and Estimates-tab exports.

interface PdfEstimateOptions {
  customId: string | null;      // null → show "DRAFT"
  date: string | null;          // ISO date string or null (uses today)
  status?: string;              // shown only for saved estimates
  clientName: string;
  projectName: string;
  lineItems: Array<{ description: string; qty: number; unit: string; rate: number; total: number }>;
  total: number;
  laborTotal?: number;          // working estimate export only
  materialTotal?: number;       // working estimate export only
}

function renderEstimatePdf(
  pdf: jsPDF,
  options: PdfEstimateOptions,
  branding: CompanyBranding | null | undefined,
  logo: { dataUrl: string; format: string; w: number; h: number } | null
): void {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  const [pr, pg, pb] = hexToRgb(branding?.primaryColor);
  const [ar, ag, ab] = hexToRgb(branding?.accentColor, [217, 119, 6]);

  // ── Header bar (36 mm) ─────────────────────────────────────────
  const headerH = 36;
  pdf.setFillColor(pr, pg, pb);
  pdf.rect(0, 0, pageWidth, headerH, "F");

  let textX = margin + 3;
  if (logo) {
    try {
      pdf.addImage(logo.dataUrl, logo.format, margin + 2, (headerH - logo.h) / 2, logo.w, logo.h);
      textX = margin + 2 + logo.w + 6;
    } catch { /* skip logo on addImage failure */ }
  }

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(15);
  pdf.setFont("helvetica", "bold");
  pdf.text(branding?.name ?? "", textX, 16);
  const c1 = [branding?.companyPhone, branding?.companyEmail].filter(Boolean).join("  •  ");
  const c2 = [branding?.companyWebsite, branding?.companyAddress].filter(Boolean).join("  •  ");
  pdf.setFontSize(7.5);
  pdf.setFont("helvetica", "normal");
  if (c1) pdf.text(c1, textX, 23);
  if (c2) pdf.text(pdf.splitTextToSize(c2, pageWidth - textX - margin), textX, 29);

  // ── Metadata block ─────────────────────────────────────────────
  let y = headerH + 9;
  pdf.setFontSize(20);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(pr, pg, pb);
  pdf.text("ESTIMATE", margin, y);

  const hasId = !!options.customId;
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(hasId ? 60 : 160, hasId ? 60 : 160, hasId ? 60 : 160);
  pdf.text(options.customId ?? "DRAFT", pageWidth - margin, y, { align: "right" });

  const dateDisplay = options.date
    ? new Date(options.date + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(100, 100, 100);
  pdf.text(dateDisplay, pageWidth - margin, y + 5, { align: "right" });
  if (options.status) {
    const statusLabel = STATUS_LABELS[options.status] ?? options.status;
    pdf.text(statusLabel, pageWidth - margin, y + 10, { align: "right" });
  }

  y += 15;
  pdf.setDrawColor(220, 220, 220);
  pdf.setLineWidth(0.3);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 7;

  // ── Client / Job info block ────────────────────────────────────
  if (options.clientName) {
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(pr, pg, pb);
    pdf.text("Prepared for:", margin, y);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(30, 30, 30);
    pdf.text(options.clientName, margin + 31, y);
    y += 6;
  }
  if (options.projectName) {
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(pr, pg, pb);
    pdf.text("Project:", margin, y);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(30, 30, 30);
    pdf.text(options.projectName, margin + 31, y);
    y += 6;
  }
  y += 4;
  pdf.setDrawColor(220, 220, 220);
  pdf.setLineWidth(0.3);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 7;

  // ── Line items table ───────────────────────────────────────────
  const tableHeaderH = 10;
  const itemRowH = 7;
  pdf.setFillColor(pr, pg, pb);
  pdf.rect(margin, y, contentWidth, tableHeaderH, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(8.5);
  pdf.setFont("helvetica", "bold");
  const hY = y + 6.5;
  pdf.text("Description", margin + 2, hY);
  pdf.text("Qty", margin + contentWidth * 0.54, hY);
  pdf.text("Unit", margin + contentWidth * 0.63, hY);
  pdf.text("Rate", margin + contentWidth * 0.76, hY, { align: "right" });
  pdf.text("Total", pageWidth - margin, hY, { align: "right" });
  y += tableHeaderH;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  options.lineItems.forEach((li, idx) => {
    if (idx % 2 === 1) {
      pdf.setFillColor(247, 248, 250);
      pdf.rect(margin, y, contentWidth, itemRowH, "F");
    }
    const tY = y + 5;
    const desc = li.description.length > 50 ? li.description.slice(0, 50) + "…" : li.description;
    pdf.setTextColor(30, 30, 30);
    pdf.text(desc, margin + 2, tY);
    pdf.text(String(li.qty), margin + contentWidth * 0.54, tY);
    pdf.text(li.unit, margin + contentWidth * 0.63, tY);
    pdf.text(formatCurrencyPdf(li.rate), margin + contentWidth * 0.76, tY, { align: "right" });
    pdf.text(formatCurrencyPdf(li.total), pageWidth - margin, tY, { align: "right" });
    y += itemRowH;
    if (y > 250) { pdf.addPage(); y = 20; }
  });

  // ── Totals block ───────────────────────────────────────────────
  y += 3;
  pdf.setDrawColor(220, 220, 220);
  pdf.setLineWidth(0.3);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 6;

  const totalsLeft = margin + contentWidth * 0.52;
  if (options.laborTotal !== undefined && options.materialTotal !== undefined) {
    pdf.setFontSize(8.5);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(80, 80, 80);
    pdf.text("Labor:", totalsLeft, y);
    pdf.text(formatCurrencyPdf(options.laborTotal), pageWidth - margin, y, { align: "right" });
    y += 5.5;
    pdf.text("Materials:", totalsLeft, y);
    pdf.text(formatCurrencyPdf(options.materialTotal), pageWidth - margin, y, { align: "right" });
    y += 4;
    pdf.setDrawColor(220, 220, 220);
    pdf.line(totalsLeft, y, pageWidth - margin, y);
    y += 5;
  }

  // Total row — full content width, accent color
  const totalRowH = 11;
  pdf.setFillColor(ar, ag, ab);
  pdf.rect(margin, y, contentWidth, totalRowH, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "bold");
  pdf.text("TOTAL", margin + 3, y + 7);
  pdf.setFontSize(12);
  pdf.text(formatCurrencyPdf(options.total), pageWidth - margin, y + 7, { align: "right" });
  y += totalRowH + 12;

  // ── Footer ─────────────────────────────────────────────────────
  pdf.setDrawColor(210, 210, 210);
  pdf.setLineWidth(0.3);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 5;

  const footerText = branding?.quoteFooterText?.trim() || "This estimate is valid for 30 days from the date above.";
  pdf.setTextColor(130, 130, 130);
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "italic");
  const footerLines = pdf.splitTextToSize(footerText, contentWidth);
  pdf.text(footerLines, margin, y);

  if (!options.customId) {
    y += footerLines.length * 4 + 3;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.text("DRAFT — not yet saved.", margin, y);
  }
}

export default function ContractorCalculator() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const isOwnerOrAdmin = user?.role === "company_owner" || user?.isCompanyAdmin === true;

  const [activeTab, setActiveTab] = useState<"calculator" | "estimates">("calculator");
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

  // Track when an estimate is loaded from the Estimates tab
  // savedCustomId stays null until user explicitly saves a new copy
  const [loadedFromId, setLoadedFromId] = useState<string | null>(null);

  // Attach-to-project dialog state
  const [attachDialogOpen, setAttachDialogOpen] = useState(false);
  const [attachingEstimateId, setAttachingEstimateId] = useState<string | null>(null);
  const [projectSearch, setProjectSearch] = useState("");

  const { confirm, ConfirmDialog } = useConfirm();

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

  const { data: savedEstimates = [], isLoading: estimatesLoading } = useQuery<SavedEstimate[]>({
    queryKey: ["/api/estimates"],
    queryFn: async () => {
      const res = await fetch("/api/estimates", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch estimates");
      return res.json();
    },
  });

  const { data: branding } = useQuery<CompanyBranding | null>({
    queryKey: ["/api/company/branding"],
    queryFn: async () => {
      const res = await fetch("/api/company/branding", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  const { data: financialSettings } = useQuery<CompanyFinancialSettings | null>({
    queryKey: ["/api/company/financial-settings"],
    queryFn: async () => {
      const res = await fetch("/api/company/financial-settings", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: isOwnerOrAdmin,
    retry: false,
  });

  const { data: projects = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isOwnerOrAdmin,
    staleTime: 1000 * 60 * 2,
  });

  const linkEstimateMutation = useMutation({
    mutationFn: async ({ estimateId, projectId }: { estimateId: string; projectId: string }) => {
      const res = await fetch(`/api/estimates/${estimateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Link failed" }));
        throw new Error(err.message || "Link failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/estimates"] });
      setAttachDialogOpen(false);
      setAttachingEstimateId(null);
      setProjectSearch("");
      toast({ title: "Estimate linked", description: "The estimate has been linked to the project." });
    },
    onError: (err: Error) => {
      toast({ title: "Link failed", description: err.message, variant: "destructive" });
    },
  });

  const handleOpenAttachDialog = (estimateId: string) => {
    setAttachingEstimateId(estimateId);
    setProjectSearch("");
    setAttachDialogOpen(true);
  };

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
    if (ok) {
      setEstimateItems([]);
      setLoadedFromId(null);
    }
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

  // Real save handler — always POSTs a new estimate (never PATCHes existing)
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
      toast({ title: "Estimate is empty", description: "Add at least one item before saving.", variant: "destructive" });
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
      setLoadedFromId(null);  // clear "loaded from" notice after successful save
      await queryClient.invalidateQueries({ queryKey: ["/api/estimates"] });
      toast({ title: "Estimate saved", description: `Saved as ${resolvedId}` });
      setSaveDialogOpen(false);
      // Do NOT clear clientName, estimateName, or cart — contractor may immediately export PDF.
    } catch (err: any) {
      toast({ title: "Save failed", description: err?.message ?? "An error occurred.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // Load a saved estimate into the calculator (view/reuse only — does not update original)
  const handleLoadEstimate = async (estimateId: string, estimateCustomId: string) => {
    try {
      const res = await fetch(`/api/estimates/${estimateId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load estimate");
      const data = await res.json();

      setClientName(data.clientName ?? "");
      setEstimateName(data.projectName ?? "");
      const loadedCustomId = data.customId ?? estimateCustomId;
      setSavedCustomId(loadedCustomId);  // show estimate number in Calculator PDF
      setLoadedFromId(loadedCustomId);   // drive the "loaded from" notice + save-as-new label

      const rebuilt: EstimateLineItem[] = (data.lineItems ?? []).map((li: SavedEstimateLineItem) => {
        // Prefer a live price-book item for full field fidelity
        const match = allItems.find(i => i.id === li.priceBookItemId);
        if (match) {
          return { item: match, quantity: parseFloat(li.quantity) || 1 };
        }
        // Safe synthetic item — never crashes on missing/deleted price book entries
        const synthetic: BudgetItem = {
          id: li.priceBookItemId ?? `synthetic-${li.id}`,
          categoryId: "",
          itemType: li.category ?? "Other",
          description: li.item ?? "",
          unitType: li.unit ?? "EA",
          cost: "0",
          burdens: "0",
          materialFee: "0",
          laborRate: "0",
          subRate: "0",
          retailPrice: String(li.rate ?? "0"),
          notes: null,
          displayOrder: 0,
          isActive: true,
        };
        return { item: synthetic, quantity: parseFloat(li.quantity) || 1 };
      });

      setEstimateItems(rebuilt);
      setActiveTab("calculator");
      toast({
        title: "Estimate loaded",
        description: `${data.customId ?? estimateCustomId} loaded into the calculator. Saving will create a new estimate.`,
      });
    } catch (err: any) {
      toast({ title: "Failed to load estimate", description: err?.message ?? "An error occurred.", variant: "destructive" });
    }
  };

  // Update estimate status from the Estimates tab
  const handleStatusUpdate = async (estimateId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/estimates/${estimateId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Update failed" }));
        throw new Error(err.message || "Update failed");
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/estimates"] });
      toast({ title: "Status updated" });
    } catch (err: any) {
      toast({ title: "Update failed", description: err?.message ?? "An error occurred.", variant: "destructive" });
    }
  };

  // Export PDF from the Estimates tab — uses saved estimate data directly, never the cart state
  const handleExportPdfFromEstimate = async (estimateId: string) => {
    try {
      const res = await fetch(`/api/estimates/${estimateId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load estimate for export");
      const data: SavedEstimate & { lineItems: SavedEstimateLineItem[] } = await res.json();
      const logo = await loadLogoForPdf(branding);
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });

      let grandTotal = 0;
      const lineItems = (data.lineItems ?? []).map((li) => {
        const qty = parseFloat(li.quantity) || 0;
        const rate = parseFloat(li.rate) || 0;
        const total = parseFloat(li.total) || rate * qty;
        grandTotal += total;
        return { description: li.item, qty, unit: li.unit || "EA", rate, total };
      });

      renderEstimatePdf(pdf, {
        customId: data.customId ?? null,
        date: data.date ?? null,
        status: data.status,
        clientName: data.clientName ?? "",
        projectName: data.projectName ?? "",
        lineItems,
        total: parseFloat(data.amount || "0") || grandTotal,
      }, branding, logo);

      const safeName = (data.clientName || "estimate").replace(/[^a-z0-9]/gi, "-").toLowerCase();
      const dateStr = data.date || new Date().toISOString().split("T")[0];
      pdf.save(`estimate-${data.customId || safeName}-${dateStr}.pdf`);
    } catch (err: any) {
      toast({ title: "Export failed", description: err?.message ?? "An error occurred.", variant: "destructive" });
    }
  };

  // Calculator-tab PDF export — uses current working estimate state
  const handleExportPdf = async () => {
    if (estimateItems.length === 0) {
      toast({ title: "Estimate is empty", description: "Add items before exporting.", variant: "destructive" });
      return;
    }
    try {
      const logo = await loadLogoForPdf(branding);
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });

      const lineItems = estimateItems.map(({ item, quantity }) => {
        const rate = parseFloat(item.retailPrice || "0");
        const total = rate * quantity;
        return { description: item.description, qty: quantity, unit: item.unitType || "EA", rate, total };
      });

      renderEstimatePdf(pdf, {
        customId: savedCustomId ?? null,
        date: null,
        clientName,
        projectName: estimateName,
        lineItems,
        total: totals.retail,
        laborTotal: totals.labor,
        materialTotal: totals.material,
      }, branding, logo);

      const safeName = (clientName || "draft").replace(/[^a-z0-9]/gi, "-").toLowerCase();
      const dateStr = new Date().toISOString().split("T")[0];
      pdf.save(`estimate-${safeName}-${dateStr}.pdf`);
    } catch (err: any) {
      toast({ title: "Export failed", description: err?.message ?? "An error occurred.", variant: "destructive" });
    }
  };

  const saveButtonLabel = loadedFromId ? "Save as New Estimate" : "Save Estimate";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-heading font-bold text-foreground flex items-center gap-3">
          <Calculator className="w-8 h-8 text-primary" />
          Estimator Calculator
        </h1>
        <p className="text-muted-foreground mt-1">Build client estimates and quotes using your company price book.</p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "calculator" | "estimates")}>
        <TabsList data-testid="tabs-estimator">
          <TabsTrigger value="calculator" data-testid="tab-calculator">
            <Calculator className="w-4 h-4 mr-2" />
            Calculator
          </TabsTrigger>
          <TabsTrigger value="estimates" data-testid="tab-estimates">
            <FileText className="w-4 h-4 mr-2" />
            Estimates
          </TabsTrigger>
        </TabsList>

        {/* ── Calculator tab ─────────────────────────────────── */}
        <TabsContent value="calculator">
          {/* Financial Defaults reference card — owner/admin only */}
          {isOwnerOrAdmin && (
            <Card className="border-muted mb-3" data-testid="card-financial-defaults">
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
          {categoriesLoading || itemsLoading ? (
            <div className="flex items-center justify-center" style={{ height: "calc(100vh - 16rem)" }}>
              <div className="text-center">
                <Calculator className="w-12 h-12 mx-auto text-muted-foreground animate-pulse" />
                <p className="mt-4 text-muted-foreground">Loading Estimator Calculator...</p>
              </div>
            </div>
          ) : (
            <div className="flex" style={{ height: "calc(100vh - 16rem)" }}>
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
                        <FileText className="w-5 h-5 text-primary" />
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

                  {/* Loaded-from notice */}
                  {loadedFromId && (
                    <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                      <Info className="w-3 h-3 flex-shrink-0" />
                      Loaded from {loadedFromId} — saving will create a new estimate
                    </div>
                  )}

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
                        <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
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
                        {saveButtonLabel}
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
          )}
        </TabsContent>

        {/* ── Estimates tab ──────────────────────────────────── */}
        <TabsContent value="estimates">
          <div className="space-y-4">
            {estimatesLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : savedEstimates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
                <FileText className="w-12 h-12 mb-4 opacity-40" />
                <p className="font-medium">No estimates yet.</p>
                <p className="text-sm mt-1">Use the Calculator tab to build and save your first estimate.</p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-semibold">Estimate #</TableHead>
                      <TableHead className="font-semibold">Client / Prospect</TableHead>
                      <TableHead className="font-semibold">Job Description</TableHead>
                      <TableHead className="font-semibold">Date</TableHead>
                      <TableHead className="font-semibold text-right">Amount</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="font-semibold text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {savedEstimates.map((est) => (
                      <TableRow key={est.id} data-testid={`row-estimate-${est.id}`}>
                        <TableCell className="font-mono text-sm font-medium">{est.customId}</TableCell>
                        <TableCell>{est.clientName}</TableCell>
                        <TableCell className="text-muted-foreground">{est.projectName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {est.date
                            ? new Date(est.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(parseFloat(est.amount || "0"))}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={est.status}
                            onValueChange={(val) => handleStatusUpdate(est.id, val)}
                          >
                            <SelectTrigger
                              className="h-7 w-32 text-xs"
                              data-testid={`select-status-${est.id}`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="draft">Draft</SelectItem>
                              <SelectItem value="sent">Sent</SelectItem>
                              <SelectItem value="approved">Approved</SelectItem>
                              <SelectItem value="declined">Declined</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end gap-1">
                            {/* Project action area (approved estimates only, owners/admins only) */}
                            {est.status === "approved" && isOwnerOrAdmin && (
                              est.projectId ? (() => {
                                const linkedName = projects.find(p => p.id === est.projectId)?.name;
                                return (
                                  <div className="flex items-center gap-1">
                                    <span
                                      className="inline-flex items-center gap-1 text-xs font-medium bg-green-100 text-green-700 rounded-full px-2 py-0.5 border border-green-200 max-w-[140px]"
                                      title={linkedName ? `Linked: ${linkedName}` : "Linked to project"}
                                      data-testid={`badge-linked-${est.id}`}
                                    >
                                      <Link2 className="w-3 h-3 flex-shrink-0" />
                                      <span className="truncate">
                                        {linkedName ? `Linked: ${linkedName}` : "Linked"}
                                      </span>
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      title="View linked project"
                                      onClick={() => navigate(`/projects/${est.projectId}`)}
                                      data-testid={`button-view-project-${est.id}`}
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                );
                              })() : (
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs px-2"
                                    onClick={() => navigate(`/new-project?fromEstimate=${est.id}`)}
                                    data-testid={`button-create-project-${est.id}`}
                                  >
                                    <FolderOpen className="w-3 h-3 mr-1" />
                                    Create Project
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs px-2"
                                    onClick={() => handleOpenAttachDialog(est.id)}
                                    data-testid={`button-attach-project-${est.id}`}
                                  >
                                    <Link2 className="w-3 h-3 mr-1" />
                                    Attach
                                  </Button>
                                </div>
                              )
                            )}
                            {/* Standard actions: Load + Export PDF */}
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleLoadEstimate(est.id, est.customId)}
                                data-testid={`button-load-estimate-${est.id}`}
                              >
                                Load
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleExportPdfFromEstimate(est.id)}
                                data-testid={`button-export-estimate-${est.id}`}
                                title="Export PDF"
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Save dialog — confirmation step */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{saveButtonLabel}</DialogTitle>
            <DialogDescription>
              {loadedFromId
                ? `This will save a new estimate (a copy of ${loadedFromId}). The original will not be changed.`
                : clientName && estimateName
                  ? `Save "${estimateName}" for ${clientName} to your estimates.`
                  : "Save this estimate to your records."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
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
                : saveButtonLabel
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attach-to-Project dialog */}
      <Dialog open={attachDialogOpen} onOpenChange={(open) => {
        setAttachDialogOpen(open);
        if (!open) { setAttachingEstimateId(null); setProjectSearch(""); }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Attach Estimate to Project</DialogTitle>
            <DialogDescription>
              Select an existing project to link this estimate to. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search projects…"
                value={projectSearch}
                onChange={e => setProjectSearch(e.target.value)}
                className="pl-9"
                data-testid="input-attach-search"
              />
            </div>
            <div className="border rounded-md max-h-60 overflow-y-auto">
              {projects.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No projects found.</p>
              ) : (
                projects
                  .filter(p => !projectSearch.trim() || p.name.toLowerCase().includes(projectSearch.toLowerCase()))
                  .map(p => (
                    <button
                      key={p.id}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted/50 border-b last:border-0 transition-colors"
                      onClick={() => {
                        if (!attachingEstimateId) return;
                        linkEstimateMutation.mutate({ estimateId: attachingEstimateId, projectId: p.id });
                      }}
                      data-testid={`button-select-project-${p.id}`}
                    >
                      {p.name}
                    </button>
                  ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttachDialogOpen(false)} data-testid="button-cancel-attach">
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog />
    </div>
  );
}
