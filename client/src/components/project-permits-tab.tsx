import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  AlertTriangle,
  FileCheck,
  ClipboardCheck,
  Clock,
  ShieldAlert,
  ExternalLink,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const PERMIT_STATUSES = [
  "not_started",
  "preparing",
  "submitted",
  "under_review",
  "revisions_requested",
  "approved",
  "issued",
  "inspection_scheduled",
  "inspection_passed",
  "inspection_failed",
  "expired",
  "cancelled",
] as const;

const PERMIT_TYPES = [
  "Building",
  "Electrical",
  "Plumbing",
  "Mechanical / HVAC",
  "Roofing",
  "Demolition",
  "Grading / Site Work",
  "Fire Suppression",
  "Zoning / Variance",
  "Sign",
  "Pool / Spa",
  "Other",
];

type PermitStatus = (typeof PERMIT_STATUSES)[number];

interface Permit {
  id: string;
  projectId: string;
  permitType: string;
  title: string;
  description?: string | null;
  jurisdiction?: string | null;
  permitNumber?: string | null;
  applicationNumber?: string | null;
  status: PermitStatus;
  submittedDate?: string | null;
  approvedDate?: string | null;
  issuedDate?: string | null;
  expirationDate?: string | null;
  inspectionDate?: string | null;
  finalInspectionDate?: string | null;
  nextActionDate?: string | null;
  blockingWork: boolean;
  clientVisible: boolean;
  notes?: string | null;
  internalNotes?: string | null;
  permitPortalUrl?: string | null;
  documentUrl?: string | null;
  assignedToUserId?: string | null;
  updatedAt: string;
}

const STATUS_CONFIG: Record<
  PermitStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }
> = {
  not_started:         { label: "Not Started",          variant: "secondary" },
  preparing:           { label: "Preparing",            variant: "secondary", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  submitted:           { label: "Submitted",            variant: "default",   className: "bg-blue-100 text-blue-800 border-blue-200" },
  under_review:        { label: "Under Review",         variant: "default",   className: "bg-blue-100 text-blue-800 border-blue-200" },
  revisions_requested: { label: "Revisions Requested",  variant: "destructive", className: "bg-orange-100 text-orange-800 border-orange-200" },
  approved:            { label: "Approved",             variant: "default",   className: "bg-green-100 text-green-800 border-green-200" },
  issued:              { label: "Issued",               variant: "default",   className: "bg-green-100 text-green-800 border-green-200" },
  inspection_scheduled:{ label: "Inspection Scheduled", variant: "default",   className: "bg-purple-100 text-purple-800 border-purple-200" },
  inspection_passed:   { label: "Inspection Passed",    variant: "default",   className: "bg-green-100 text-green-800 border-green-200" },
  inspection_failed:   { label: "Inspection Failed",    variant: "destructive", className: "bg-red-100 text-red-800 border-red-200" },
  expired:             { label: "Expired",              variant: "destructive" },
  cancelled:           { label: "Cancelled",            variant: "outline" },
};

function statusLabel(s: string) {
  return STATUS_CONFIG[s as PermitStatus]?.label ?? s;
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as PermitStatus];
  if (!cfg) return <Badge variant="outline">{status}</Badge>;
  return (
    <Badge variant={cfg.variant} className={cfg.className ?? ""}>
      {cfg.label}
    </Badge>
  );
}

function formatDate(d?: string | null) {
  if (!d) return null;
  const [y, m, day] = d.split("-");
  return `${m}/${day}/${y}`;
}

const NEEDS_ACTION_STATUSES: PermitStatus[] = ["not_started", "preparing"];
const IN_PROGRESS_STATUSES: PermitStatus[] = ["submitted", "under_review", "revisions_requested"];
const APPROVED_STATUSES: PermitStatus[] = ["approved", "issued"];
const INSPECTION_STATUSES: PermitStatus[] = ["inspection_scheduled", "inspection_passed", "inspection_failed"];

interface FormState {
  permitType: string;
  title: string;
  description: string;
  jurisdiction: string;
  permitNumber: string;
  applicationNumber: string;
  status: PermitStatus;
  submittedDate: string;
  approvedDate: string;
  issuedDate: string;
  expirationDate: string;
  inspectionDate: string;
  finalInspectionDate: string;
  nextActionDate: string;
  blockingWork: boolean;
  clientVisible: boolean;
  notes: string;
  internalNotes: string;
  permitPortalUrl: string;
  documentUrl: string;
  assignedToUserId: string;
}

const emptyForm = (): FormState => ({
  permitType: "",
  title: "",
  description: "",
  jurisdiction: "",
  permitNumber: "",
  applicationNumber: "",
  status: "not_started",
  submittedDate: "",
  approvedDate: "",
  issuedDate: "",
  expirationDate: "",
  inspectionDate: "",
  finalInspectionDate: "",
  nextActionDate: "",
  blockingWork: false,
  clientVisible: false,
  notes: "",
  internalNotes: "",
  permitPortalUrl: "",
  documentUrl: "",
  assignedToUserId: "",
});

function permitToForm(p: Permit): FormState {
  return {
    permitType: p.permitType,
    title: p.title,
    description: p.description ?? "",
    jurisdiction: p.jurisdiction ?? "",
    permitNumber: p.permitNumber ?? "",
    applicationNumber: p.applicationNumber ?? "",
    status: p.status,
    submittedDate: p.submittedDate ?? "",
    approvedDate: p.approvedDate ?? "",
    issuedDate: p.issuedDate ?? "",
    expirationDate: p.expirationDate ?? "",
    inspectionDate: p.inspectionDate ?? "",
    finalInspectionDate: p.finalInspectionDate ?? "",
    nextActionDate: p.nextActionDate ?? "",
    blockingWork: p.blockingWork,
    clientVisible: p.clientVisible,
    notes: p.notes ?? "",
    internalNotes: p.internalNotes ?? "",
    permitPortalUrl: p.permitPortalUrl ?? "",
    documentUrl: p.documentUrl ?? "",
    assignedToUserId: p.assignedToUserId ?? "",
  };
}

function cleanForm(f: FormState) {
  const toNull = (v: string) => (v.trim() === "" ? null : v.trim());
  return {
    permitType: f.permitType,
    title: f.title,
    description: toNull(f.description),
    jurisdiction: toNull(f.jurisdiction),
    permitNumber: toNull(f.permitNumber),
    applicationNumber: toNull(f.applicationNumber),
    status: f.status,
    submittedDate: toNull(f.submittedDate),
    approvedDate: toNull(f.approvedDate),
    issuedDate: toNull(f.issuedDate),
    expirationDate: toNull(f.expirationDate),
    inspectionDate: toNull(f.inspectionDate),
    finalInspectionDate: toNull(f.finalInspectionDate),
    nextActionDate: toNull(f.nextActionDate),
    blockingWork: f.blockingWork,
    clientVisible: f.clientVisible,
    notes: toNull(f.notes),
    internalNotes: toNull(f.internalNotes),
    permitPortalUrl: toNull(f.permitPortalUrl),
    documentUrl: toNull(f.documentUrl),
    assignedToUserId: toNull(f.assignedToUserId),
  };
}

interface TeamMember {
  id: string;
  contractorId: string;
  name?: string;
  user?: { name?: string; username: string };
}

interface Props {
  projectId: string;
  canWrite: boolean;
  isClient: boolean;
}

export default function ProjectPermitsTab({ projectId, canWrite, isClient }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPermit, setEditingPermit] = useState<Permit | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Permit | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [customPermitType, setCustomPermitType] = useState(false);

  const { data: permits = [], isLoading } = useQuery<Permit[]>({
    queryKey: [`/api/projects/${projectId}/permits`],
  });

  const { data: teamMembers = [] } = useQuery<TeamMember[]>({
    queryKey: ["/api/projects", projectId, "team"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/team`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: canWrite,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/permits`] });

  const createMutation = useMutation({
    mutationFn: (data: ReturnType<typeof cleanForm>) =>
      apiRequest("POST", `/api/projects/${projectId}/permits`, data),
    onSuccess: () => { invalidate(); setDialogOpen(false); toast({ title: "Permit added" }); },
    onError: async (err: any) => {
      const msg = await err.response?.json().then((j: any) => j.message).catch(() => "Failed to create permit");
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ReturnType<typeof cleanForm> }) =>
      apiRequest("PATCH", `/api/projects/${projectId}/permits/${id}`, data),
    onSuccess: () => { invalidate(); setDialogOpen(false); toast({ title: "Permit updated" }); },
    onError: async (err: any) => {
      const msg = await err.response?.json().then((j: any) => j.message).catch(() => "Failed to update permit");
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("DELETE", `/api/projects/${projectId}/permits/${id}`),
    onSuccess: () => { invalidate(); setDeleteTarget(null); toast({ title: "Permit deleted" }); },
    onError: () => toast({ title: "Error", description: "Failed to delete permit", variant: "destructive" }),
  });

  const openCreate = () => {
    setEditingPermit(null);
    setForm(emptyForm());
    setCustomPermitType(false);
    setDialogOpen(true);
  };

  const openEdit = (p: Permit) => {
    setEditingPermit(p);
    setForm(permitToForm(p));
    setCustomPermitType(!PERMIT_TYPES.includes(p.permitType));
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.permitType.trim()) {
      toast({ title: "Permit type is required", variant: "destructive" }); return;
    }
    if (!form.title.trim()) {
      toast({ title: "Title is required", variant: "destructive" }); return;
    }
    const cleaned = cleanForm(form);
    if (editingPermit) {
      updateMutation.mutate({ id: editingPermit.id, data: cleaned });
    } else {
      createMutation.mutate(cleaned);
    }
  };

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  // Summary counts
  const needsAction = permits.filter((p) => NEEDS_ACTION_STATUSES.includes(p.status as PermitStatus)).length;
  const inProgress  = permits.filter((p) => IN_PROGRESS_STATUSES.includes(p.status as PermitStatus)).length;
  const approved    = permits.filter((p) => APPROVED_STATUSES.includes(p.status as PermitStatus)).length;
  const inspections = permits.filter((p) => INSPECTION_STATUSES.includes(p.status as PermitStatus)).length;
  const blocking    = permits.filter((p) => p.blockingWork).length;

  // ── Client view ──────────────────────────────────────────────────────────
  if (isClient) {
    if (isLoading) return <div className="text-muted-foreground text-sm p-4">Loading permits…</div>;
    if (!permits.length) {
      return (
        <div className="text-center py-12 text-muted-foreground" data-testid="permits-empty-client">
          <FileCheck className="mx-auto mb-3 h-10 w-10 opacity-30" />
          <p className="font-medium">No permit information available yet</p>
          <p className="text-sm mt-1">Your contractor will share permit updates here.</p>
        </div>
      );
    }
    return (
      <div className="space-y-3" data-testid="permits-client-list">
        {permits.map((p) => (
          <Card key={p.id} data-testid={`permit-card-${p.id}`} className={p.blockingWork ? "border-l-4 border-l-amber-500" : ""}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-medium text-sm">{p.title}</span>
                    <StatusBadge status={p.status} />
                    {p.blockingWork && (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 text-xs">
                        <AlertTriangle className="h-3 w-3 mr-1" /> Blocking Work
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <span className="font-medium text-foreground/70">{p.permitType}</span>
                    {p.jurisdiction && <span> · {p.jurisdiction}</span>}
                    {p.permitNumber && <span> · #{p.permitNumber}</span>}
                  </div>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                    {p.submittedDate && <span>Submitted: {formatDate(p.submittedDate)}</span>}
                    {p.approvedDate  && <span>Approved: {formatDate(p.approvedDate)}</span>}
                    {p.issuedDate    && <span>Issued: {formatDate(p.issuedDate)}</span>}
                    {p.expirationDate && <span>Expires: {formatDate(p.expirationDate)}</span>}
                  </div>
                  {p.notes && <p className="mt-2 text-sm text-muted-foreground">{p.notes}</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // ── Contractor / admin view ───────────────────────────────────────────────
  return (
    <div className="space-y-6" data-testid="permits-contractor-view">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Permits</h3>
          <p className="text-sm text-muted-foreground">Track permit applications, approvals, and inspections</p>
        </div>
        {canWrite && (
          <Button size="sm" onClick={openCreate} data-testid="btn-add-permit">
            <Plus className="h-4 w-4 mr-1" /> Add Permit
          </Button>
        )}
      </div>

      {/* Summary cards */}
      {permits.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Card data-testid="summary-needs-action">
            <CardHeader className="pb-1 pt-3 px-4"><CardTitle className="text-xs font-medium text-muted-foreground">Needs Action</CardTitle></CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-500" />
                <span className="text-2xl font-bold">{needsAction}</span>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="summary-in-progress">
            <CardHeader className="pb-1 pt-3 px-4"><CardTitle className="text-xs font-medium text-muted-foreground">In Progress</CardTitle></CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-blue-500" />
                <span className="text-2xl font-bold">{inProgress}</span>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="summary-approved">
            <CardHeader className="pb-1 pt-3 px-4"><CardTitle className="text-xs font-medium text-muted-foreground">Approved / Issued</CardTitle></CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-green-500" />
                <span className="text-2xl font-bold">{approved}</span>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="summary-inspections">
            <CardHeader className="pb-1 pt-3 px-4"><CardTitle className="text-xs font-medium text-muted-foreground">Inspections</CardTitle></CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-purple-500" />
                <span className="text-2xl font-bold">{inspections}</span>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="summary-blocking">
            <CardHeader className="pb-1 pt-3 px-4"><CardTitle className="text-xs font-medium text-muted-foreground">Blocking Work</CardTitle></CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className={`h-4 w-4 ${blocking > 0 ? "text-red-500" : "text-muted-foreground"}`} />
                <span className={`text-2xl font-bold ${blocking > 0 ? "text-red-600" : ""}`}>{blocking}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Permit list */}
      {isLoading ? (
        <div className="text-muted-foreground text-sm">Loading permits…</div>
      ) : permits.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-lg" data-testid="permits-empty">
          <FileCheck className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="font-medium text-muted-foreground">No permits yet</p>
          {canWrite && (
            <Button size="sm" variant="outline" className="mt-3" onClick={openCreate} data-testid="btn-add-permit-empty">
              <Plus className="h-4 w-4 mr-1" /> Add First Permit
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {permits.map((p) => (
            <Card
              key={p.id}
              data-testid={`permit-card-${p.id}`}
              className={`transition-colors ${p.blockingWork ? "border-l-4 border-l-red-500" : ""}`}
            >
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-semibold text-sm">{p.title}</span>
                      <StatusBadge status={p.status} />
                      {p.blockingWork && (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300 text-xs">
                          <AlertTriangle className="h-3 w-3 mr-1" /> Blocking
                        </Badge>
                      )}
                      {!p.clientVisible && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">Internal</Badge>
                      )}
                      {p.assignedToUserId && (() => {
                        const m = teamMembers.find((tm) => tm.contractorId === p.assignedToUserId);
                        const name = m?.user?.name || m?.user?.username || null;
                        return name ? (
                          <span className="text-xs text-muted-foreground">Assigned: <span className="font-medium text-foreground/80">{name}</span></span>
                        ) : null;
                      })()}
                    </div>
                    <div className="text-xs text-muted-foreground mb-1">
                      <span className="font-medium text-foreground/70">{p.permitType}</span>
                      {p.jurisdiction && <span> · {p.jurisdiction}</span>}
                      {p.permitNumber && <span> · Permit #{p.permitNumber}</span>}
                      {p.applicationNumber && <span> · App #{p.applicationNumber}</span>}
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {p.nextActionDate  && <span>Next Action: <span className="font-medium text-foreground">{formatDate(p.nextActionDate)}</span></span>}
                      {p.submittedDate   && <span>Submitted: {formatDate(p.submittedDate)}</span>}
                      {p.approvedDate    && <span>Approved: {formatDate(p.approvedDate)}</span>}
                      {p.issuedDate      && <span>Issued: {formatDate(p.issuedDate)}</span>}
                      {p.expirationDate  && <span>Expires: <span className="font-medium">{formatDate(p.expirationDate)}</span></span>}
                      {p.inspectionDate  && <span>Inspection: {formatDate(p.inspectionDate)}</span>}
                    </div>
                    {p.notes && <p className="mt-1.5 text-xs text-muted-foreground">{p.notes}</p>}
                    {p.internalNotes && (
                      <p className="mt-1 text-xs italic text-muted-foreground border-l-2 border-muted pl-2">{p.internalNotes}</p>
                    )}
                    <div className="flex gap-2 mt-1.5">
                      {p.permitPortalUrl && (
                        <a href={p.permitPortalUrl} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline" data-testid={`link-portal-${p.id}`}>
                          <ExternalLink className="h-3 w-3" /> Portal
                        </a>
                      )}
                      {p.documentUrl && (
                        <a href={p.documentUrl} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline" data-testid={`link-doc-${p.id}`}>
                          <ExternalLink className="h-3 w-3" /> Document
                        </a>
                      )}
                    </div>
                  </div>
                  {canWrite && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" data-testid={`btn-permit-menu-${p.id}`}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(p)} data-testid={`btn-edit-permit-${p.id}`}>
                          <Pencil className="h-4 w-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteTarget(p)}
                          data-testid={`btn-delete-permit-${p.id}`}
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPermit ? "Edit Permit" : "Add Permit"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Type + Title */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="permitType">Permit Type <span className="text-destructive">*</span></Label>
                {customPermitType ? (
                  <div className="flex gap-2">
                    <Input
                      id="permitType"
                      value={form.permitType}
                      onChange={(e) => setField("permitType", e.target.value)}
                      placeholder="Enter permit type"
                      data-testid="input-permit-type-custom"
                    />
                    <Button variant="ghost" size="sm" onClick={() => { setCustomPermitType(false); setField("permitType", ""); }}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Select
                    value={form.permitType}
                    onValueChange={(v) => {
                      if (v === "__custom__") { setCustomPermitType(true); setField("permitType", ""); }
                      else setField("permitType", v);
                    }}
                  >
                    <SelectTrigger data-testid="select-permit-type">
                      <SelectValue placeholder="Select type…" />
                    </SelectTrigger>
                    <SelectContent>
                      {PERMIT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                      <SelectItem value="__custom__">Other / Custom…</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => setField("title", e.target.value)}
                  placeholder="e.g. Main Building Permit"
                  data-testid="input-permit-title"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                rows={2}
                placeholder="Brief description of this permit"
                data-testid="input-permit-description"
              />
            </div>

            {/* Jurisdiction + Status */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="jurisdiction">Jurisdiction</Label>
                <Input
                  id="jurisdiction"
                  value={form.jurisdiction}
                  onChange={(e) => setField("jurisdiction", e.target.value)}
                  placeholder="City, county, or authority"
                  data-testid="input-permit-jurisdiction"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="status">Status</Label>
                <Select value={form.status} onValueChange={(v) => setField("status", v as PermitStatus)}>
                  <SelectTrigger data-testid="select-permit-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERMIT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Permit # + App # */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="permitNumber">Permit Number</Label>
                <Input
                  id="permitNumber"
                  value={form.permitNumber}
                  onChange={(e) => setField("permitNumber", e.target.value)}
                  placeholder="Official permit #"
                  data-testid="input-permit-number"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="applicationNumber">Application Number</Label>
                <Input
                  id="applicationNumber"
                  value={form.applicationNumber}
                  onChange={(e) => setField("applicationNumber", e.target.value)}
                  placeholder="App # before issuance"
                  data-testid="input-application-number"
                />
              </div>
            </div>

            {/* Dates row 1 */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="submittedDate">Submitted Date</Label>
                <Input id="submittedDate" type="date" value={form.submittedDate} onChange={(e) => setField("submittedDate", e.target.value)} data-testid="input-submitted-date" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="approvedDate">Approved Date</Label>
                <Input id="approvedDate" type="date" value={form.approvedDate} onChange={(e) => setField("approvedDate", e.target.value)} data-testid="input-approved-date" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="issuedDate">Issued Date</Label>
                <Input id="issuedDate" type="date" value={form.issuedDate} onChange={(e) => setField("issuedDate", e.target.value)} data-testid="input-issued-date" />
              </div>
            </div>

            {/* Dates row 2 */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="expirationDate">Expiration Date</Label>
                <Input id="expirationDate" type="date" value={form.expirationDate} onChange={(e) => setField("expirationDate", e.target.value)} data-testid="input-expiration-date" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inspectionDate">Inspection Date</Label>
                <Input id="inspectionDate" type="date" value={form.inspectionDate} onChange={(e) => setField("inspectionDate", e.target.value)} data-testid="input-inspection-date" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="finalInspectionDate">Final Inspection</Label>
                <Input id="finalInspectionDate" type="date" value={form.finalInspectionDate} onChange={(e) => setField("finalInspectionDate", e.target.value)} data-testid="input-final-inspection-date" />
              </div>
            </div>

            {/* Next action date */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="nextActionDate">Next Action Date</Label>
                <Input id="nextActionDate" type="date" value={form.nextActionDate} onChange={(e) => setField("nextActionDate", e.target.value)} data-testid="input-next-action-date" />
              </div>
            </div>

            {/* URLs */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="permitPortalUrl">Permit Portal URL</Label>
                <Input
                  id="permitPortalUrl"
                  value={form.permitPortalUrl}
                  onChange={(e) => setField("permitPortalUrl", e.target.value)}
                  placeholder="https://…"
                  data-testid="input-portal-url"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="documentUrl">Document URL</Label>
                <Input
                  id="documentUrl"
                  value={form.documentUrl}
                  onChange={(e) => setField("documentUrl", e.target.value)}
                  placeholder="https://…"
                  data-testid="input-document-url"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes (visible to client when shared)</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
                rows={2}
                data-testid="input-permit-notes"
              />
            </div>

            {/* Internal notes */}
            <div className="space-y-1.5">
              <Label htmlFor="internalNotes">Internal Notes (never shown to client)</Label>
              <Textarea
                id="internalNotes"
                value={form.internalNotes}
                onChange={(e) => setField("internalNotes", e.target.value)}
                rows={2}
                data-testid="input-permit-internal-notes"
              />
            </div>

            {/* Flags */}
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer" data-testid="check-blocking-work">
                <Checkbox
                  checked={form.blockingWork}
                  onCheckedChange={(v) => setField("blockingWork", !!v)}
                />
                <span className="text-sm font-medium">Blocking Work</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer" data-testid="check-client-visible">
                <Checkbox
                  checked={form.clientVisible}
                  onCheckedChange={(v) => setField("clientVisible", !!v)}
                />
                <span className="text-sm font-medium">Visible to Client</span>
              </label>
            </div>

            {/* Assigned To */}
            <div className="space-y-1.5">
              <Label htmlFor="permit-assigned">Assigned To</Label>
              <Select
                value={form.assignedToUserId || "__none__"}
                onValueChange={(v) => setField("assignedToUserId", v === "__none__" ? "" : v)}
              >
                <SelectTrigger id="permit-assigned" data-testid="select-permit-assignee">
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="btn-cancel-permit">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="btn-save-permit"
            >
              {editingPermit ? "Save Changes" : "Add Permit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete permit?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.title}" will be permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="btn-cancel-delete-permit">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              data-testid="btn-confirm-delete-permit"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
