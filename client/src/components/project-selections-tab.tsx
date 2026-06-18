import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  ExternalLink,
  CheckCircle2,
  Clock,
  ShoppingCart,
  Package,
} from "lucide-react";

type SelectionStatus =
  | "needed" | "options_sent" | "client_review" | "selected"
  | "approved" | "ordered" | "received" | "installed" | "cancelled";

interface Selection {
  id: string;
  projectId: string;
  category: string;
  room?: string | null;
  title: string;
  description?: string | null;
  status: SelectionStatus;
  dueDate?: string | null;
  selectedOptionName?: string | null;
  selectedOptionDetails?: string | null;
  vendorName?: string | null;
  productUrl?: string | null;
  allowanceAmount?: string | null;
  estimatedCost?: string | null;
  actualCost?: string | null;
  clientVisible?: boolean;
  notes?: string | null;
  internalNotes?: string | null;
  displayOrder?: number;
  assignedToUserId?: string | null;
  createdById?: string;
  companyId?: string;
  updatedAt?: string | null;
}

interface TeamMember {
  id: string;
  contractorId: string;
  name?: string;
  user?: { name?: string; username: string };
}

interface ProjectSelectionsTabProps {
  projectId: string;
  canWrite: boolean;
  isClient: boolean;
}

const STATUS_LABELS: Record<SelectionStatus, string> = {
  needed: "Needed",
  options_sent: "Options Sent",
  client_review: "Client Review",
  selected: "Selected",
  approved: "Approved",
  ordered: "Ordered",
  received: "Received",
  installed: "Installed",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<SelectionStatus, string> = {
  needed: "bg-slate-100 text-slate-700 border-slate-200",
  options_sent: "bg-blue-100 text-blue-700 border-blue-200",
  client_review: "bg-yellow-100 text-yellow-700 border-yellow-200",
  selected: "bg-purple-100 text-purple-700 border-purple-200",
  approved: "bg-green-100 text-green-700 border-green-200",
  ordered: "bg-orange-100 text-orange-700 border-orange-200",
  received: "bg-teal-100 text-teal-700 border-teal-200",
  installed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  cancelled: "bg-red-100 text-red-700 border-red-200",
};

const COMMON_CATEGORIES = [
  "Flooring", "Cabinets", "Countertops", "Paint Colors", "Tile",
  "Fixtures", "Lighting", "Appliances", "Doors & Windows", "Hardware",
  "Plumbing Fixtures", "Other",
];

const EMPTY_FORM = {
  category: "",
  room: "",
  title: "",
  description: "",
  status: "needed" as SelectionStatus,
  dueDate: "",
  selectedOptionName: "",
  selectedOptionDetails: "",
  vendorName: "",
  productUrl: "",
  allowanceAmount: "",
  estimatedCost: "",
  actualCost: "",
  clientVisible: false,
  notes: "",
  internalNotes: "",
  displayOrder: 0,
  assignedToUserId: "",
};

export default function ProjectSelectionsTab({
  projectId,
  canWrite,
  isClient,
}: ProjectSelectionsTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const { data: selections = [], isLoading } = useQuery<Selection[]>({
    queryKey: ["/api/projects", projectId, "selections"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/selections`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!projectId,
  });

  const { data: teamMembers = [] } = useQuery<TeamMember[]>({
    queryKey: ["/api/projects", projectId, "team"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/team`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!projectId && canWrite,
  });

  // Group selections by category
  const grouped = useMemo(() => {
    const map = new Map<string, Selection[]>();
    for (const s of selections) {
      const list = map.get(s.category) ?? [];
      list.push(s);
      map.set(s.category, list);
    }
    return map;
  }, [selections]);

  // Summary counts
  const counts = useMemo(() => {
    const pending = selections.filter(s => ["needed", "options_sent"].includes(s.status)).length;
    const clientReview = selections.filter(s => s.status === "client_review").length;
    const approved = selections.filter(s => s.status === "approved").length;
    const orderedReceived = selections.filter(s => ["ordered", "received", "installed"].includes(s.status)).length;
    return { pending, clientReview, approved, orderedReceived };
  }, [selections]);

  const createMutation = useMutation({
    mutationFn: async (data: typeof EMPTY_FORM) => {
      const res = await fetch(`/api/projects/${projectId}/selections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...data,
          allowanceAmount: data.allowanceAmount || null,
          estimatedCost: data.estimatedCost || null,
          actualCost: data.actualCost || null,
          assignedToUserId: data.assignedToUserId || null,
          dueDate: data.dueDate || null,
          room: data.room || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to create selection");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "selections"] });
      toast({ title: "Selection created" });
      setDialogOpen(false);
      setForm({ ...EMPTY_FORM });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof EMPTY_FORM> }) => {
      const res = await fetch(`/api/projects/${projectId}/selections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...data,
          allowanceAmount: data.allowanceAmount || null,
          estimatedCost: data.estimatedCost || null,
          actualCost: data.actualCost || null,
          assignedToUserId: data.assignedToUserId || null,
          dueDate: data.dueDate || null,
          room: data.room || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to update selection");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "selections"] });
      toast({ title: "Selection updated" });
      setDialogOpen(false);
      setEditingId(null);
      setForm({ ...EMPTY_FORM });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/projects/${projectId}/selections/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete selection");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "selections"] });
      toast({ title: "Selection deleted" });
      setDeleteId(null);
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setDialogOpen(true);
  };

  const openEdit = (s: Selection) => {
    setEditingId(s.id);
    setForm({
      category: s.category ?? "",
      room: s.room ?? "",
      title: s.title ?? "",
      description: s.description ?? "",
      status: s.status ?? "needed",
      dueDate: s.dueDate ?? "",
      selectedOptionName: s.selectedOptionName ?? "",
      selectedOptionDetails: s.selectedOptionDetails ?? "",
      vendorName: s.vendorName ?? "",
      productUrl: s.productUrl ?? "",
      allowanceAmount: s.allowanceAmount ?? "",
      estimatedCost: s.estimatedCost ?? "",
      actualCost: s.actualCost ?? "",
      clientVisible: s.clientVisible ?? false,
      notes: s.notes ?? "",
      internalNotes: s.internalNotes ?? "",
      displayOrder: s.displayOrder ?? 0,
      assignedToUserId: s.assignedToUserId ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.category.trim() || !form.title.trim()) {
      toast({ title: "Category and title are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, data: form });
      } else {
        await createMutation.mutateAsync(form);
      }
    } finally {
      setSaving(false);
    }
  };

  const fmtCurrency = (v: string | null | undefined) => {
    if (!v) return null;
    const n = parseFloat(v);
    return isNaN(n) ? null : `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  const fmtDate = (d: string | null | undefined) => {
    if (!d) return null;
    try { return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
    catch { return d; }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">Loading selections…</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">
            {isClient ? "Project Selections" : "Selections / Job Book"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isClient
              ? "Material and finish choices for your project"
              : `${selections.length} selection${selections.length !== 1 ? "s" : ""} across ${grouped.size} categor${grouped.size !== 1 ? "ies" : "y"}`}
          </p>
        </div>
        {canWrite && (
          <Button onClick={openCreate} data-testid="btn-add-selection">
            <Plus className="h-4 w-4 mr-2" />
            Add Selection
          </Button>
        )}
      </div>

      {/* Summary cards (contractor/admin only) */}
      {!isClient && selections.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-slate-500" />
                <span className="text-xs text-muted-foreground font-medium">Pending</span>
              </div>
              <p className="text-2xl font-bold text-slate-700" data-testid="count-pending">{counts.pending}</p>
            </CardContent>
          </Card>
          <Card className="border-yellow-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Eye className="h-4 w-4 text-yellow-500" />
                <span className="text-xs text-muted-foreground font-medium">Client Review</span>
              </div>
              <p className="text-2xl font-bold text-yellow-700" data-testid="count-client-review">{counts.clientReview}</p>
            </CardContent>
          </Card>
          <Card className="border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-xs text-muted-foreground font-medium">Approved</span>
              </div>
              <p className="text-2xl font-bold text-green-700" data-testid="count-approved">{counts.approved}</p>
            </CardContent>
          </Card>
          <Card className="border-orange-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <ShoppingCart className="h-4 w-4 text-orange-500" />
                <span className="text-xs text-muted-foreground font-medium">Ordered / Received</span>
              </div>
              <p className="text-2xl font-bold text-orange-700" data-testid="count-ordered">{counts.orderedReceived}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty state */}
      {selections.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <Package className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-sm font-medium text-muted-foreground">
              {isClient ? "No selections have been shared yet." : "No selections yet."}
            </p>
            {canWrite && (
              <Button variant="outline" size="sm" className="mt-4" onClick={openCreate} data-testid="btn-add-selection-empty">
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add First Selection
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Grouped list */}
      {Array.from(grouped.entries()).map(([category, items]) => (
        <Card key={category}>
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold text-foreground">{category}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {items.map((sel) => (
                <div
                  key={sel.id}
                  className="px-5 py-3 hover:bg-muted/40 transition-colors group"
                  data-testid={`selection-row-${sel.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Title row */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{sel.title}</span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] h-4 px-1.5 ${STATUS_COLORS[sel.status] ?? ""}`}
                        >
                          {STATUS_LABELS[sel.status] ?? sel.status}
                        </Badge>
                        {/* Client-visible indicator (contractor view only) */}
                        {!isClient && (
                          sel.clientVisible
                            ? <span title="Visible to client"><Eye className="h-3 w-3 text-muted-foreground" /></span>
                            : <span title="Hidden from client"><EyeOff className="h-3 w-3 text-muted-foreground/40" /></span>
                        )}
                      </div>

                      {/* Meta row */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                        {sel.room && (
                          <span className="text-xs text-muted-foreground">{sel.room}</span>
                        )}
                        {sel.dueDate && (
                          <span className="text-xs text-muted-foreground">Due {fmtDate(sel.dueDate)}</span>
                        )}
                        {sel.vendorName && (
                          <span className="text-xs text-muted-foreground">{sel.vendorName}</span>
                        )}
                        {sel.selectedOptionName && (
                          <span className="text-xs text-blue-600 font-medium">{sel.selectedOptionName}</span>
                        )}
                        {sel.productUrl && (
                          <a
                            href={sel.productUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary flex items-center gap-0.5 hover:underline"
                            onClick={e => e.stopPropagation()}
                          >
                            <ExternalLink className="h-3 w-3" />
                            Link
                          </a>
                        )}
                      </div>

                      {/* Financial row — contractor/admin only */}
                      {!isClient && (sel.allowanceAmount || sel.estimatedCost || sel.actualCost) && (
                        <div className="flex flex-wrap gap-x-4 mt-1">
                          {sel.allowanceAmount && (
                            <span className="text-xs text-muted-foreground">
                              Allowance: <span className="font-medium text-foreground">{fmtCurrency(sel.allowanceAmount)}</span>
                            </span>
                          )}
                          {sel.estimatedCost && (
                            <span className="text-xs text-muted-foreground">
                              Estimated: <span className="font-medium text-foreground">{fmtCurrency(sel.estimatedCost)}</span>
                            </span>
                          )}
                          {sel.actualCost && (
                            <span className="text-xs text-muted-foreground">
                              Actual: <span className="font-medium text-foreground">{fmtCurrency(sel.actualCost)}</span>
                            </span>
                          )}
                        </div>
                      )}

                      {/* Notes */}
                      {sel.notes && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{sel.notes}</p>
                      )}
                      {/* Internal notes — contractor/admin only */}
                      {!isClient && sel.internalNotes && (
                        <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-0.5 mt-1 line-clamp-2">
                          Internal: {sel.internalNotes}
                        </p>
                      )}
                    </div>

                    {/* Actions — canWrite only */}
                    {canWrite && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                            data-testid={`btn-selection-menu-${sel.id}`}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(sel)} data-testid={`btn-edit-selection-${sel.id}`}>
                            <Pencil className="h-3.5 w-3.5 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteId(sel.id)}
                            data-testid={`btn-delete-selection-${sel.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) { setDialogOpen(false); setEditingId(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Selection" : "Add Selection"}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-2">
            {/* Category */}
            <div className="space-y-1.5">
              <Label htmlFor="sel-category">Category *</Label>
              <Select value={form.category} onValueChange={(v) => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger id="sel-category" data-testid="select-selection-category">
                  <SelectValue placeholder="Select category…" />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_CATEGORIES.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Allow custom category via text input */}
              <Input
                placeholder="Or type custom category"
                value={COMMON_CATEGORIES.includes(form.category) ? "" : form.category}
                onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))}
                data-testid="input-selection-category-custom"
              />
            </div>

            {/* Room */}
            <div className="space-y-1.5">
              <Label htmlFor="sel-room">Room / Area</Label>
              <Input
                id="sel-room"
                placeholder="e.g. Master Bath, Kitchen"
                value={form.room}
                onChange={(e) => setForm(f => ({ ...f, room: e.target.value }))}
                data-testid="input-selection-room"
              />
            </div>

            {/* Title */}
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="sel-title">Title *</Label>
              <Input
                id="sel-title"
                placeholder="e.g. LVP Flooring"
                value={form.title}
                onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                data-testid="input-selection-title"
              />
            </div>

            {/* Description */}
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="sel-description">Description</Label>
              <Textarea
                id="sel-description"
                placeholder="Specifications or details…"
                value={form.description}
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2}
                data-testid="input-selection-description"
              />
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <Label htmlFor="sel-status">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v as SelectionStatus }))}>
                <SelectTrigger id="sel-status" data-testid="select-selection-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_LABELS) as SelectionStatus[]).map(s => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Due Date */}
            <div className="space-y-1.5">
              <Label htmlFor="sel-due">Due Date</Label>
              <Input
                id="sel-due"
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm(f => ({ ...f, dueDate: e.target.value }))}
                data-testid="input-selection-due"
              />
            </div>

            {/* Selected Option Name */}
            <div className="space-y-1.5">
              <Label htmlFor="sel-option-name">Selected Option Name</Label>
              <Input
                id="sel-option-name"
                placeholder="e.g. Shaw Floorté Pro"
                value={form.selectedOptionName}
                onChange={(e) => setForm(f => ({ ...f, selectedOptionName: e.target.value }))}
                data-testid="input-selection-option-name"
              />
            </div>

            {/* Selected Option Details */}
            <div className="space-y-1.5">
              <Label htmlFor="sel-option-details">Option Details</Label>
              <Input
                id="sel-option-details"
                placeholder="SKU, color, finish…"
                value={form.selectedOptionDetails}
                onChange={(e) => setForm(f => ({ ...f, selectedOptionDetails: e.target.value }))}
                data-testid="input-selection-option-details"
              />
            </div>

            {/* Vendor */}
            <div className="space-y-1.5">
              <Label htmlFor="sel-vendor">Vendor</Label>
              <Input
                id="sel-vendor"
                placeholder="e.g. Tile World"
                value={form.vendorName}
                onChange={(e) => setForm(f => ({ ...f, vendorName: e.target.value }))}
                data-testid="input-selection-vendor"
              />
            </div>

            {/* Product URL */}
            <div className="space-y-1.5">
              <Label htmlFor="sel-url">Product URL</Label>
              <Input
                id="sel-url"
                type="url"
                placeholder="https://…"
                value={form.productUrl}
                onChange={(e) => setForm(f => ({ ...f, productUrl: e.target.value }))}
                data-testid="input-selection-url"
              />
            </div>

            {/* Allowance */}
            <div className="space-y-1.5">
              <Label htmlFor="sel-allowance">Allowance Amount ($)</Label>
              <Input
                id="sel-allowance"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.allowanceAmount}
                onChange={(e) => setForm(f => ({ ...f, allowanceAmount: e.target.value }))}
                data-testid="input-selection-allowance"
              />
            </div>

            {/* Estimated Cost */}
            <div className="space-y-1.5">
              <Label htmlFor="sel-est-cost">Estimated Cost ($)</Label>
              <Input
                id="sel-est-cost"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.estimatedCost}
                onChange={(e) => setForm(f => ({ ...f, estimatedCost: e.target.value }))}
                data-testid="input-selection-estimated-cost"
              />
            </div>

            {/* Actual Cost */}
            <div className="space-y-1.5">
              <Label htmlFor="sel-actual-cost">Actual Cost ($)</Label>
              <Input
                id="sel-actual-cost"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.actualCost}
                onChange={(e) => setForm(f => ({ ...f, actualCost: e.target.value }))}
                data-testid="input-selection-actual-cost"
              />
            </div>

            {/* Assigned To */}
            <div className="space-y-1.5">
              <Label htmlFor="sel-assigned">Assigned To</Label>
              <Select
                value={form.assignedToUserId || "__none__"}
                onValueChange={(v) => setForm(f => ({ ...f, assignedToUserId: v === "__none__" ? "" : v }))}
              >
                <SelectTrigger id="sel-assigned" data-testid="select-selection-assignee">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {teamMembers.map((m) => (
                    <SelectItem key={m.contractorId} value={m.contractorId}>
                      {m.user?.name || m.user?.username || m.contractorId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Display Order */}
            <div className="space-y-1.5">
              <Label htmlFor="sel-order">Display Order</Label>
              <Input
                id="sel-order"
                type="number"
                value={form.displayOrder}
                onChange={(e) => setForm(f => ({ ...f, displayOrder: parseInt(e.target.value) || 0 }))}
                data-testid="input-selection-order"
              />
            </div>

            {/* Client Visible */}
            <div className="col-span-2 flex items-center gap-2">
              <Checkbox
                id="sel-client-visible"
                checked={form.clientVisible}
                onCheckedChange={(v) => setForm(f => ({ ...f, clientVisible: !!v }))}
                data-testid="checkbox-selection-client-visible"
              />
              <Label htmlFor="sel-client-visible" className="cursor-pointer">
                Visible to client
              </Label>
            </div>

            {/* Public notes */}
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="sel-notes">Notes (client-visible if selection is shared)</Label>
              <Textarea
                id="sel-notes"
                placeholder="Notes visible to client…"
                value={form.notes}
                onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                data-testid="input-selection-notes"
              />
            </div>

            {/* Internal notes */}
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="sel-internal-notes">Internal Notes (never shared with client)</Label>
              <Textarea
                id="sel-internal-notes"
                placeholder="Internal notes…"
                value={form.internalNotes}
                onChange={(e) => setForm(f => ({ ...f, internalNotes: e.target.value }))}
                rows={2}
                data-testid="input-selection-internal-notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} data-testid="btn-save-selection">
              {saving ? "Saving…" : editingId ? "Save Changes" : "Add Selection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete selection?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="btn-confirm-delete-selection"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
