import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useToast } from "@/hooks/use-toast";
import {
  Activity,
  Calendar,
  CheckSquare,
  ClipboardList,
  DollarSign,
  FileText,
  Gauge,
  ListChecks,
  Lock,
  Pencil,
  Receipt,
  ShieldAlert,
  Timer,
  TrendingUp,
  X,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

// ── Types ─────────────────────────────────────────────────────────────────────

type ProductionStatus = "planning" | "mobilizing" | "active" | "on_hold" | "punch_list" | "completed";
type InternalPriority = "low" | "normal" | "high" | "urgent";

interface ProductionSheet {
  id: string;
  projectId: string;
  productionStatus: ProductionStatus;
  internalPriority: InternalPriority | null;
  jobStartTarget: string | null;
  jobCompletionTarget: string | null;
  siteContactName: string | null;
  siteContactPhone: string | null;
  siteAccessNotes: string | null;
  parkingNotes: string | null;
  materialStagingNotes: string | null;
  dumpsterNotes: string | null;
  utilityNotes: string | null;
  safetyNotes: string | null;
  inspectionNotes: string | null;
  productionNotes: string | null;
  internalNotes: string | null;
  checklistContractConfirmed: boolean;
  checklistBudgetCreated: boolean;
  checklistPermitsReviewed: boolean;
  checklistSelectionsReviewed: boolean;
  checklistTimelineReviewed: boolean;
  checklistSiteAccessConfirmed: boolean;
  checklistMaterialsPlanConfirmed: boolean;
  checklistSafetyNotesReviewed: boolean;
  updatedAt: string;
}

interface Props {
  projectId: string;
  canWrite: boolean;
  canViewBudget: boolean;
  project: any;
}

// ── Status / priority config ──────────────────────────────────────────────────

const PRODUCTION_STATUS_CONFIG: Record<
  ProductionStatus,
  { label: string; className: string }
> = {
  planning:    { label: "Planning",    className: "bg-slate-100 text-slate-700 border-slate-200" },
  mobilizing:  { label: "Mobilizing", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  active:      { label: "Active",      className: "bg-green-100 text-green-700 border-green-200" },
  on_hold:     { label: "On Hold",     className: "bg-orange-100 text-orange-700 border-orange-200" },
  punch_list:  { label: "Punch List",  className: "bg-purple-100 text-purple-700 border-purple-200" },
  completed:   { label: "Completed",   className: "bg-blue-100 text-blue-700 border-blue-200" },
};

const PRIORITY_CONFIG: Record<InternalPriority, { label: string; className: string }> = {
  low:    { label: "Low",    className: "bg-slate-100 text-slate-600 border-slate-200" },
  normal: { label: "Normal", className: "bg-blue-100 text-blue-700 border-blue-200" },
  high:   { label: "High",   className: "bg-orange-100 text-orange-700 border-orange-200" },
  urgent: { label: "Urgent", className: "bg-red-100 text-red-700 border-red-200" },
};

function formatDate(d?: string | null) {
  if (!d) return null;
  const [y, m, day] = d.split("-");
  return `${m}/${day}/${y}`;
}

// ── Checklist definition ──────────────────────────────────────────────────────

const CHECKLIST_ITEMS: { key: keyof ProductionSheet; label: string }[] = [
  { key: "checklistContractConfirmed",       label: "Contract / estimate confirmed" },
  { key: "checklistBudgetCreated",           label: "Budget created" },
  { key: "checklistPermitsReviewed",         label: "Permits reviewed" },
  { key: "checklistSelectionsReviewed",      label: "Selections reviewed" },
  { key: "checklistTimelineReviewed",        label: "Timeline reviewed" },
  { key: "checklistSiteAccessConfirmed",     label: "Site access confirmed" },
  { key: "checklistMaterialsPlanConfirmed",  label: "Materials / staging plan confirmed" },
  { key: "checklistSafetyNotesReviewed",     label: "Safety notes reviewed" },
];

// ── Note field definitions ────────────────────────────────────────────────────

const NOTE_FIELDS: { key: keyof ProductionSheet; label: string }[] = [
  { key: "siteAccessNotes",      label: "Site Access Notes" },
  { key: "parkingNotes",         label: "Parking Notes" },
  { key: "materialStagingNotes", label: "Material Staging Notes" },
  { key: "dumpsterNotes",        label: "Dumpster Notes" },
  { key: "utilityNotes",         label: "Utility Notes" },
  { key: "safetyNotes",          label: "Safety Notes" },
  { key: "inspectionNotes",      label: "Inspection Notes" },
  { key: "productionNotes",      label: "Production Notes" },
  { key: "internalNotes",        label: "Internal Notes" },
];

// ── Main component ────────────────────────────────────────────────────────────

export default function ProjectProductionTab({ projectId, canWrite, canViewBudget, project }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [editing, setEditing] = useState(false);
  const [formDraft, setFormDraft] = useState<Partial<ProductionSheet>>({});

  const { data: sheet, isLoading } = useQuery<ProductionSheet | null>({
    queryKey: [`/api/projects/${projectId}/production-sheet`],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/production-sheet`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: timelineItems = [] } = useQuery<any[]>({
    queryKey: [`/api/projects/${projectId}/timeline-items`],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/timeline-items`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: permits = [] } = useQuery<any[]>({
    queryKey: [`/api/projects/${projectId}/permits`],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/permits`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: selections = [] } = useQuery<any[]>({
    queryKey: [`/api/projects/${projectId}/selections`],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/selections`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: budgetData } = useQuery<any>({
    queryKey: [`/api/projects/${projectId}/budget`],
    enabled: canViewBudget,
  });

  const { data: expenses = [] } = useQuery<any[]>({
    queryKey: [`/api/projects/${projectId}/expenses`],
    enabled: canViewBudget,
  });

  const upsertMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiRequest("PUT", `/api/projects/${projectId}/production-sheet`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/production-sheet`] });
    },
    onError: async (err: any) => {
      const msg = await err.response?.json().then((j: any) => j.message).catch(() => "Failed to save");
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  // Checklist toggle — fires PUT immediately
  const toggleChecklist = (key: keyof ProductionSheet, value: boolean) => {
    upsertMutation.mutate({ [key]: value });
  };

  const startEdit = () => {
    setFormDraft({
      productionStatus: sheet?.productionStatus ?? "planning",
      internalPriority: sheet?.internalPriority ?? null,
      jobStartTarget: sheet?.jobStartTarget ?? null,
      jobCompletionTarget: sheet?.jobCompletionTarget ?? null,
      siteContactName: sheet?.siteContactName ?? null,
      siteContactPhone: sheet?.siteContactPhone ?? null,
      siteAccessNotes: sheet?.siteAccessNotes ?? null,
      parkingNotes: sheet?.parkingNotes ?? null,
      materialStagingNotes: sheet?.materialStagingNotes ?? null,
      dumpsterNotes: sheet?.dumpsterNotes ?? null,
      utilityNotes: sheet?.utilityNotes ?? null,
      safetyNotes: sheet?.safetyNotes ?? null,
      inspectionNotes: sheet?.inspectionNotes ?? null,
      productionNotes: sheet?.productionNotes ?? null,
      internalNotes: sheet?.internalNotes ?? null,
    });
    setEditing(true);
  };

  const cancelEdit = () => {
    setFormDraft({});
    setEditing(false);
  };

  const saveEdit = async () => {
    const payload: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(formDraft)) {
      payload[k] = v === "" ? null : v;
    }
    try {
      await upsertMutation.mutateAsync(payload);
      toast({ title: "Production sheet saved" });
      setEditing(false);
      setFormDraft({});
    } catch {
      // error handled in onError
    }
  };

  const setField = (k: string, v: unknown) => setFormDraft(prev => ({ ...prev, [k]: v }));

  // ── Summary counts ──────────────────────────────────────────────────────────
  const tlOpen = timelineItems.filter((t: any) => t.status === "open" || t.status === "in_progress" || !t.completedDate).length;
  const tlBlocked = timelineItems.filter((t: any) => t.status === "blocked").length;
  const tlCompleted = timelineItems.filter((t: any) => t.status === "completed" || !!t.completedDate).length;
  const permitsBlocking = permits.filter((p: any) => p.blockingWork).length;
  const permitsUnderReview = permits.filter((p: any) => p.status === "under_review" || p.status === "submitted").length;
  const permitsApproved = permits.filter((p: any) => p.status === "approved" || p.status === "issued").length;
  const selectionsPending = selections.filter((s: any) => s.status === "needed" || s.status === "options_sent").length;
  const selectionsApproved = selections.filter((s: any) => s.status === "approved" || s.status === "selected").length;

  const totalEstimated = budgetData?.totalEstimated ?? 0;
  const totalActual = budgetData?.totalActual ?? 0;
  const budgetDelta = totalActual - totalEstimated;
  const totalExpenses = Array.isArray(expenses)
    ? expenses.reduce((sum: number, e: any) => sum + parseFloat(e.amount ?? "0"), 0)
    : 0;

  const checklist = sheet ?? ({} as Partial<ProductionSheet>);
  const checklistComplete = CHECKLIST_ITEMS.filter(i => !!checklist[i.key]).length;

  const statusCfg = PRODUCTION_STATUS_CONFIG[(sheet?.productionStatus ?? "planning") as ProductionStatus];
  const priorityCfg = sheet?.internalPriority
    ? PRIORITY_CONFIG[sheet.internalPriority as InternalPriority]
    : null;

  if (isLoading) {
    return <div className="py-10 text-center text-sm text-muted-foreground">Loading production sheet…</div>;
  }

  const basePath = `/contractor/project/${projectId}`;

  return (
    <div className="space-y-6" data-testid="production-tab">

      {/* ── A. Summary Cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {/* 1. Project Status */}
        <Card className="col-span-1" data-testid="prod-card-status">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Gauge className="h-3.5 w-3.5" /> Project Status
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-1">
            <p className="text-sm font-semibold capitalize">{project?.status ?? "—"}</p>
            {project?.phase && <p className="text-xs text-muted-foreground">{project.phase}</p>}
            {project?.progress != null && (
              <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                <div
                  className="bg-primary h-1.5 rounded-full"
                  style={{ width: `${Math.min(100, project.progress)}%` }}
                />
              </div>
            )}
            {project?.progress != null && (
              <p className="text-xs text-muted-foreground">{project.progress}% complete</p>
            )}
          </CardContent>
        </Card>

        {/* 2. Timeline */}
        <Card className="col-span-1" data-testid="prod-card-timeline">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Timer className="h-3.5 w-3.5" /> Timeline
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-1">
            <div className="flex gap-3 text-sm">
              <span className="text-muted-foreground">Open <span className="font-bold text-foreground">{tlOpen}</span></span>
              {tlBlocked > 0 && <span className="text-red-600 font-bold">{tlBlocked} blocked</span>}
              <span className="text-muted-foreground">Done <span className="font-bold text-foreground">{tlCompleted}</span></span>
            </div>
            <button
              className="text-xs text-primary hover:underline"
              onClick={() => setLocation(`${basePath}/timeline`)}
              data-testid="prod-nav-timeline"
            >
              → Timeline
            </button>
          </CardContent>
        </Card>

        {/* 3. Permits */}
        <Card className="col-span-1" data-testid="prod-card-permits">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <ShieldAlert className="h-3.5 w-3.5" /> Permits
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-1">
            {permitsBlocking > 0 && (
              <p className="text-sm font-bold text-red-600">{permitsBlocking} blocking work</p>
            )}
            <div className="flex gap-3 text-sm">
              <span className="text-muted-foreground">Review <span className="font-bold text-foreground">{permitsUnderReview}</span></span>
              <span className="text-muted-foreground">Approved <span className="font-bold text-foreground">{permitsApproved}</span></span>
            </div>
            <button
              className="text-xs text-primary hover:underline"
              onClick={() => setLocation(`${basePath}/permits`)}
              data-testid="prod-nav-permits"
            >
              → Permits
            </button>
          </CardContent>
        </Card>

        {/* 4. Selections */}
        <Card className="col-span-1" data-testid="prod-card-selections">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <ClipboardList className="h-3.5 w-3.5" /> Selections
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-1">
            <div className="flex gap-3 text-sm">
              <span className="text-muted-foreground">Pending <span className="font-bold text-foreground">{selectionsPending}</span></span>
              <span className="text-muted-foreground">Approved <span className="font-bold text-foreground">{selectionsApproved}</span></span>
            </div>
            <button
              className="text-xs text-primary hover:underline"
              onClick={() => setLocation(`${basePath}/selections`)}
              data-testid="prod-nav-selections"
            >
              → Selections
            </button>
          </CardContent>
        </Card>

        {/* 5 & 6. Budget / Expenses — financial-gated */}
        {canViewBudget ? (
          <>
            <Card className="col-span-1" data-testid="prod-card-budget">
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <DollarSign className="h-3.5 w-3.5" /> Budget
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-1">
                <p className="text-sm">
                  <span className="text-muted-foreground">Est. </span>
                  <span className="font-semibold">${totalEstimated.toLocaleString()}</span>
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Act. </span>
                  <span className="font-semibold">${totalActual.toLocaleString()}</span>
                </p>
                {totalEstimated > 0 && (
                  <p className={`text-xs font-medium ${budgetDelta > 0 ? "text-red-600" : "text-green-600"}`}>
                    {budgetDelta > 0 ? `+$${budgetDelta.toLocaleString()} over` : `-$${Math.abs(budgetDelta).toLocaleString()} under`}
                  </p>
                )}
                <button
                  className="text-xs text-primary hover:underline"
                  onClick={() => setLocation(`${basePath}/budget`)}
                  data-testid="prod-nav-budget"
                >
                  → Budget
                </button>
              </CardContent>
            </Card>

            <Card className="col-span-1" data-testid="prod-card-expenses">
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Receipt className="h-3.5 w-3.5" /> Expenses
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-1">
                <p className="text-lg font-bold">${totalExpenses.toLocaleString()}</p>
                <button
                  className="text-xs text-primary hover:underline"
                  onClick={() => setLocation(`${basePath}/expenses`)}
                  data-testid="prod-nav-expenses"
                >
                  → Expenses
                </button>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="col-span-2 border-dashed" data-testid="prod-card-financial-placeholder">
            <CardContent className="flex items-center gap-2 px-4 py-4 text-muted-foreground">
              <Lock className="h-4 w-4 shrink-0" />
              <p className="text-xs">Financial summary — company admin access required.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── B. Readiness Checklist ───────────────────────────────────────── */}
      <Card data-testid="prod-checklist-card">
        <CardHeader className="pb-2 pt-4 px-5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ListChecks className="h-4 w-4" /> Readiness Checklist
            </CardTitle>
            <Badge variant="outline" className="text-xs" data-testid="checklist-count">
              {checklistComplete} / {CHECKLIST_ITEMS.length} complete
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CHECKLIST_ITEMS.map(({ key, label }) => {
              const checked = !!checklist[key];
              return (
                <div key={key} className="flex items-center gap-2" data-testid={`checklist-${key}`}>
                  <Checkbox
                    id={key}
                    checked={checked}
                    disabled={!canWrite || upsertMutation.isPending}
                    onCheckedChange={(v) => toggleChecklist(key, !!v)}
                    data-testid={`checkbox-${key}`}
                  />
                  <label
                    htmlFor={key}
                    className={`text-sm select-none ${canWrite ? "cursor-pointer" : "cursor-default"} ${checked ? "line-through text-muted-foreground" : ""}`}
                  >
                    {label}
                  </label>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── C. Production Details ────────────────────────────────────────── */}
      <Card data-testid="prod-details-card">
        <CardHeader className="pb-2 pt-4 px-5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4" /> Production Details
              {sheet?.productionStatus && (
                <Badge variant="outline" className={`text-xs ${statusCfg.className}`}>
                  {statusCfg.label}
                </Badge>
              )}
              {priorityCfg && (
                <Badge variant="outline" className={`text-xs ${priorityCfg.className}`}>
                  {priorityCfg.label}
                </Badge>
              )}
            </CardTitle>
            {canWrite && !editing && (
              <Button
                size="sm"
                variant="outline"
                onClick={startEdit}
                data-testid="btn-edit-production"
              >
                <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
              </Button>
            )}
            {editing && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={cancelEdit}
                  data-testid="btn-cancel-production"
                >
                  <X className="h-3.5 w-3.5 mr-1" /> Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={saveEdit}
                  disabled={upsertMutation.isPending}
                  data-testid="btn-save-production"
                >
                  {upsertMutation.isPending ? "Saving…" : "Save Changes"}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-6">

          {/* Job Status & Scheduling */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> Job Status &amp; Scheduling
            </h4>
            {editing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="productionStatus" className="text-xs">Production Status</Label>
                  <Select
                    value={(formDraft.productionStatus as string) ?? "planning"}
                    onValueChange={(v) => setField("productionStatus", v)}
                  >
                    <SelectTrigger id="productionStatus" data-testid="select-production-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planning">Planning</SelectItem>
                      <SelectItem value="mobilizing">Mobilizing</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                      <SelectItem value="punch_list">Punch List</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="internalPriority" className="text-xs">Internal Priority</Label>
                  <Select
                    value={(formDraft.internalPriority as string) ?? "none"}
                    onValueChange={(v) => setField("internalPriority", v === "none" ? null : v)}
                  >
                    <SelectTrigger id="internalPriority" data-testid="select-priority">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="jobStartTarget" className="text-xs">Job Start Target</Label>
                  <Input
                    id="jobStartTarget"
                    type="date"
                    value={(formDraft.jobStartTarget as string) ?? ""}
                    onChange={(e) => setField("jobStartTarget", e.target.value || null)}
                    data-testid="input-job-start"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="jobCompletionTarget" className="text-xs">Job Completion Target</Label>
                  <Input
                    id="jobCompletionTarget"
                    type="date"
                    value={(formDraft.jobCompletionTarget as string) ?? ""}
                    onChange={(e) => setField("jobCompletionTarget", e.target.value || null)}
                    data-testid="input-job-completion"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Production Status</p>
                  <p className="font-medium">{statusCfg.label}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Priority</p>
                  <p className="font-medium">{priorityCfg?.label ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Start Target</p>
                  <p className="font-medium">{formatDate(sheet?.jobStartTarget) ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Completion Target</p>
                  <p className="font-medium">{formatDate(sheet?.jobCompletionTarget) ?? "—"}</p>
                </div>
              </div>
            )}
          </div>

          {/* Site Contact */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" /> Site Contact
            </h4>
            {editing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="siteContactName" className="text-xs">Contact Name</Label>
                  <Input
                    id="siteContactName"
                    value={(formDraft.siteContactName as string) ?? ""}
                    onChange={(e) => setField("siteContactName", e.target.value || null)}
                    placeholder="Site contact name"
                    data-testid="input-site-contact-name"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="siteContactPhone" className="text-xs">Contact Phone</Label>
                  <Input
                    id="siteContactPhone"
                    value={(formDraft.siteContactPhone as string) ?? ""}
                    onChange={(e) => setField("siteContactPhone", e.target.value || null)}
                    placeholder="Phone number"
                    data-testid="input-site-contact-phone"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Name</p>
                  <p className="font-medium">{sheet?.siteContactName ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Phone</p>
                  <p className="font-medium">{sheet?.siteContactPhone ?? "—"}</p>
                </div>
              </div>
            )}
          </div>

          {/* Operational Notes */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" /> Operational Notes
            </h4>
            {editing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {NOTE_FIELDS.map(({ key, label }) => (
                  <div key={key} className="space-y-1">
                    <Label htmlFor={key} className="text-xs">{label}</Label>
                    <Textarea
                      id={key}
                      rows={2}
                      value={(formDraft[key] as string) ?? ""}
                      onChange={(e) => setField(key, e.target.value || null)}
                      placeholder={`Enter ${label.toLowerCase()}…`}
                      className="resize-none text-sm"
                      data-testid={`textarea-${key}`}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                {NOTE_FIELDS.map(({ key, label }) => {
                  const val = sheet?.[key] as string | null;
                  if (!val) return null;
                  return (
                    <div key={key}>
                      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                      <p className="text-sm whitespace-pre-wrap">{val}</p>
                    </div>
                  );
                })}
                {NOTE_FIELDS.every(({ key }) => !sheet?.[key]) && (
                  <p className="text-muted-foreground text-sm col-span-2">No operational notes recorded yet.</p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── D. Quick Navigation ──────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2" data-testid="prod-quick-nav">
        <Button variant="outline" size="sm" onClick={() => setLocation(`${basePath}/timeline`)} data-testid="quick-nav-timeline">
          → Timeline
        </Button>
        <Button variant="outline" size="sm" onClick={() => setLocation(`${basePath}/selections`)} data-testid="quick-nav-selections">
          → Selections
        </Button>
        <Button variant="outline" size="sm" onClick={() => setLocation(`${basePath}/permits`)} data-testid="quick-nav-permits">
          → Permits
        </Button>
        {canViewBudget && (
          <Button variant="outline" size="sm" onClick={() => setLocation(`${basePath}/budget`)} data-testid="quick-nav-budget">
            → Budget
          </Button>
        )}
        {canViewBudget && (
          <Button variant="outline" size="sm" onClick={() => setLocation(`${basePath}/expenses`)} data-testid="quick-nav-expenses">
            → Expenses
          </Button>
        )}
      </div>

    </div>
  );
}
