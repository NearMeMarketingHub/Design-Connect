import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
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
  LayoutList,
  BarChart2,
  Flag,
  Layers,
  CheckSquare,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  User2,
} from "lucide-react";
import { eachMonthOfInterval, endOfMonth, format } from "date-fns";

type TimelineItemType = "phase" | "task" | "milestone";
type TimelineItemStatus = "not_started" | "in_progress" | "blocked" | "completed" | "cancelled";

interface TimelineItem {
  id: string;
  projectId: string;
  companyId: string;
  title: string;
  description: string | null;
  itemType: TimelineItemType;
  status: TimelineItemStatus;
  startDate: string | null;
  endDate: string | null;
  completedAt: string | null;
  progressPercent: number;
  displayOrder: number;
  clientVisible: boolean;
  assignedToUserId: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

interface TeamMember {
  id: string;
  userId: string;
  contractor?: { id: string; fullName: string; email: string; role: string } | null;
}

interface Props {
  projectId: string;
  canWrite: boolean;
  isClient: boolean;
}

const TYPE_ICONS: Record<TimelineItemType, React.ReactNode> = {
  phase: <Layers className="h-4 w-4" />,
  task: <CheckSquare className="h-4 w-4" />,
  milestone: <Flag className="h-4 w-4" />,
};

const TYPE_LABELS: Record<TimelineItemType, string> = {
  phase: "Phase",
  task: "Task",
  milestone: "Milestone",
};

const STATUS_LABELS: Record<TimelineItemStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  blocked: "Blocked",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<TimelineItemStatus, string> = {
  not_started: "bg-slate-100 text-slate-700 border-slate-200",
  in_progress: "bg-blue-50 text-blue-700 border-blue-200",
  blocked: "bg-red-50 text-red-700 border-red-200",
  completed: "bg-green-50 text-green-700 border-green-200",
  cancelled: "bg-gray-50 text-gray-500 border-gray-200",
};

const STATUS_DOT: Record<TimelineItemStatus, string> = {
  not_started: "bg-slate-300",
  in_progress: "bg-blue-500",
  blocked: "bg-red-500",
  completed: "bg-green-500",
  cancelled: "bg-gray-400",
};

const GANTT_BAR_COLORS: Record<TimelineItemStatus, string> = {
  not_started: "bg-slate-300",
  in_progress: "bg-blue-500",
  blocked: "bg-red-400",
  completed: "bg-green-500",
  cancelled: "bg-gray-300",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr + (dateStr.length === 10 ? "T00:00:00" : ""));
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function daysBetween(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  try {
    const s = new Date(start + "T00:00:00");
    const e = new Date(end + "T00:00:00");
    return Math.max(0, Math.ceil((e.getTime() - s.getTime()) / 86400000));
  } catch {
    return null;
  }
}

interface GanttLayout {
  minDate: Date | null;
  maxDate: Date | null;
  totalDays: number;
  months: { label: string; widthPct: number }[];
}

function computeGanttLayout(items: TimelineItem[]): GanttLayout {
  const dated = items.filter(i => i.startDate && i.endDate);
  if (dated.length === 0) return { minDate: null, maxDate: null, totalDays: 0, months: [] };
  const starts = dated.map(i => new Date(i.startDate! + "T00:00:00").getTime());
  const ends = dated.map(i => new Date(i.endDate! + "T00:00:00").getTime());
  const minTs = Math.min(...starts);
  const maxTs = Math.max(...ends);
  const totalDays = Math.max(1, Math.ceil((maxTs - minTs) / 86400000));
  const minDate = new Date(minTs);
  const maxDate = new Date(maxTs);

  // Compute month columns with date-fns
  const monthStarts = eachMonthOfInterval({ start: minDate, end: maxDate });
  const months = monthStarts.map(monthStart => {
    const clipStart = Math.max(monthStart.getTime(), minTs);
    const clipEnd = Math.min(endOfMonth(monthStart).getTime(), maxTs);
    const visibleDays = Math.max(0, (clipEnd - clipStart) / 86400000);
    return {
      label: format(monthStart, "MMM yyyy"),
      widthPct: (visibleDays / totalDays) * 100,
    };
  });

  return { minDate, maxDate, totalDays, months };
}

function GanttBar({ item, minDate, totalDays }: { item: TimelineItem; minDate: Date; totalDays: number }) {
  if (!item.startDate || !item.endDate) {
    return (
      <div className="h-full flex items-center">
        <span className="text-xs text-muted-foreground italic">No dates set</span>
      </div>
    );
  }
  const start = new Date(item.startDate + "T00:00:00");
  const end = new Date(item.endDate + "T00:00:00");
  const offsetDays = Math.max(0, (start.getTime() - minDate.getTime()) / 86400000);
  const durationDays = Math.max(1, (end.getTime() - start.getTime()) / 86400000);
  const leftPct = (offsetDays / totalDays) * 100;
  const widthPct = Math.min((durationDays / totalDays) * 100, 100 - leftPct);

  return (
    <div className="relative h-5 w-full">
      <div
        className={`absolute h-full rounded ${GANTT_BAR_COLORS[item.status]} flex items-center px-1`}
        style={{ left: `${leftPct}%`, width: `${widthPct}%`, minWidth: "4px" }}
        title={`${item.title}: ${formatDate(item.startDate)} → ${formatDate(item.endDate)}`}
      >
        {widthPct > 8 && (
          <span className="text-[10px] text-white font-medium truncate leading-none">
            {item.title}
          </span>
        )}
      </div>
    </div>
  );
}

const EMPTY_FORM = {
  title: "",
  description: "",
  itemType: "task" as TimelineItemType,
  status: "not_started" as TimelineItemStatus,
  startDate: "",
  endDate: "",
  progressPercent: 0,
  displayOrder: 0,
  clientVisible: false,
  assignedToUserId: "" as string,
};

export default function ProjectTimelineTab({ projectId, canWrite, isClient }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [viewMode, setViewMode] = useState<"list" | "gantt">("list");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TimelineItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TimelineItem | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const queryKey = [`/api/projects/${projectId}/timeline-items`];
  const API_BASE = `/api/projects/${projectId}/timeline-items`;

  const { data: items = [], isLoading } = useQuery<TimelineItem[]>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(API_BASE, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load timeline");
      return res.json();
    },
    enabled: !!projectId,
  });

  // Fetch project team members to populate assignee select
  const { data: teamMembers = [] } = useQuery<TeamMember[]>({
    queryKey: [`/api/projects/${projectId}/team`],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/team`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!projectId && canWrite,
  });

  // Build userId → name map for display
  const userNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    teamMembers.forEach(m => {
      if (m.contractor) {
        map[m.contractor.id] = m.contractor.fullName || m.contractor.email;
      }
    });
    return map;
  }, [teamMembers]);

  const createMutation = useMutation({
    mutationFn: async (data: typeof EMPTY_FORM) => {
      const res = await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...data,
          startDate: data.startDate || undefined,
          endDate: data.endDate || undefined,
          description: data.description || undefined,
          assignedToUserId: data.assignedToUserId || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || "Failed to create item");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setDialogOpen(false);
      setForm({ ...EMPTY_FORM });
      toast({ title: "Timeline item added" });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof EMPTY_FORM> }) => {
      const res = await fetch(`${API_BASE}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...data,
          startDate: data.startDate || null,
          endDate: data.endDate || null,
          description: data.description || null,
          assignedToUserId: data.assignedToUserId || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || "Failed to update item");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setDialogOpen(false);
      setEditingItem(null);
      setForm({ ...EMPTY_FORM });
      toast({ title: "Timeline item updated" });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_BASE}/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete item");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setDeleteTarget(null);
      toast({ title: "Timeline item deleted" });
    },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  const quickStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TimelineItemStatus }) => {
      const res = await fetch(`${API_BASE}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: () => toast({ title: "Failed to update status", variant: "destructive" }),
  });

  const ganttLayout = useMemo(() => computeGanttLayout(items), [items]);

  const openCreateDialog = () => {
    setEditingItem(null);
    setForm({ ...EMPTY_FORM, displayOrder: items.length });
    setDialogOpen(true);
  };

  const openEditDialog = (item: TimelineItem) => {
    setEditingItem(item);
    setForm({
      title: item.title,
      description: item.description ?? "",
      itemType: item.itemType,
      status: item.status,
      startDate: item.startDate ?? "",
      endDate: item.endDate ?? "",
      progressPercent: item.progressPercent,
      displayOrder: item.displayOrder,
      clientVisible: item.clientVisible,
      assignedToUserId: item.assignedToUserId ?? "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const summary = useMemo(() => {
    const total = items.length;
    const completed = items.filter(i => i.status === "completed").length;
    const inProgress = items.filter(i => i.status === "in_progress").length;
    const blocked = items.filter(i => i.status === "blocked").length;
    return { total, completed, inProgress, blocked };
  }, [items]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Loading timeline...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Project Timeline</h3>
          <p className="text-sm text-muted-foreground">
            {isClient ? "View project schedule and progress" : "Manage phases, tasks, and milestones"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border overflow-hidden">
            <button
              onClick={() => setViewMode("list")}
              data-testid="btn-timeline-list-view"
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${
                viewMode === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              <LayoutList className="h-3.5 w-3.5" />
              List
            </button>
            <button
              onClick={() => setViewMode("gantt")}
              data-testid="btn-timeline-gantt-view"
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors border-l ${
                viewMode === "gantt" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              <BarChart2 className="h-3.5 w-3.5" />
              Gantt
            </button>
          </div>
          {canWrite && (
            <Button size="sm" onClick={openCreateDialog} data-testid="btn-add-timeline-item">
              <Plus className="h-4 w-4 mr-1" />
              Add Item
            </Button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      {summary.total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-3">
            <p className="text-xs text-muted-foreground">Total Items</p>
            <p className="text-2xl font-bold" data-testid="stat-timeline-total">{summary.total}</p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-muted-foreground">Completed</p>
            <p className="text-2xl font-bold text-green-600" data-testid="stat-timeline-completed">{summary.completed}</p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-muted-foreground">In Progress</p>
            <p className="text-2xl font-bold text-blue-600" data-testid="stat-timeline-in-progress">{summary.inProgress}</p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-muted-foreground">Blocked</p>
            <p className="text-2xl font-bold text-red-600" data-testid="stat-timeline-blocked">{summary.blocked}</p>
          </Card>
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart2 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium text-muted-foreground">No timeline items yet</p>
            {canWrite && (
              <p className="text-sm text-muted-foreground mt-1">
                Add phases, tasks, and milestones to build your project schedule.
              </p>
            )}
            {canWrite && (
              <Button size="sm" className="mt-4" onClick={openCreateDialog} data-testid="btn-add-timeline-item-empty">
                <Plus className="h-4 w-4 mr-1" />
                Add First Item
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* LIST VIEW */}
      {viewMode === "list" && items.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {items.map((item) => {
                const isExpanded = expandedItems.has(item.id);
                const duration = daysBetween(item.startDate, item.endDate);
                const assigneeName = item.assignedToUserId ? (userNameMap[item.assignedToUserId] || null) : null;
                return (
                  <div key={item.id} className="group" data-testid={`timeline-item-${item.id}`}>
                    <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
                      {/* Expand toggle */}
                      <button
                        onClick={() => toggleExpand(item.id)}
                        className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                        data-testid={`btn-expand-timeline-${item.id}`}
                      >
                        {item.description ? (
                          isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                        ) : (
                          <div className="w-4 h-4" />
                        )}
                      </button>

                      {/* Status dot */}
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${STATUS_DOT[item.status]}`} />

                      {/* Type icon */}
                      <span className="text-muted-foreground flex-shrink-0">
                        {TYPE_ICONS[item.itemType]}
                      </span>

                      {/* Title + meta */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`font-medium text-sm ${item.status === "cancelled" ? "line-through text-muted-foreground" : ""}`}
                            data-testid={`text-timeline-title-${item.id}`}
                          >
                            {item.title}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] h-4 px-1.5 ${STATUS_COLORS[item.status]}`}
                            data-testid={`badge-timeline-status-${item.id}`}
                          >
                            {STATUS_LABELS[item.status]}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                            {TYPE_LABELS[item.itemType]}
                          </Badge>
                          {!isClient && item.clientVisible && (
                            <span title="Visible to client"><Eye className="h-3 w-3 text-muted-foreground" /></span>
                          )}
                          {!isClient && !item.clientVisible && (
                            <span title="Hidden from client"><EyeOff className="h-3 w-3 text-muted-foreground" /></span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          {(item.startDate || item.endDate) && (
                            <p className="text-xs text-muted-foreground">
                              {formatDate(item.startDate)} → {formatDate(item.endDate)}
                              {duration !== null && ` (${duration}d)`}
                            </p>
                          )}
                          {assigneeName && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1" data-testid={`text-timeline-assignee-${item.id}`}>
                              <User2 className="h-3 w-3" />
                              {assigneeName}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Progress */}
                      {item.progressPercent > 0 && (
                        <div className="hidden sm:flex items-center gap-2 w-28 flex-shrink-0">
                          <Progress value={item.progressPercent} className="h-1.5 flex-1" />
                          <span className="text-xs text-muted-foreground w-8 text-right">
                            {item.progressPercent}%
                          </span>
                        </div>
                      )}

                      {/* Actions */}
                      {canWrite && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 flex-shrink-0"
                              data-testid={`btn-timeline-menu-${item.id}`}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => openEditDialog(item)}
                              data-testid={`btn-edit-timeline-${item.id}`}
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            {item.status !== "completed" && (
                              <DropdownMenuItem
                                onClick={() => quickStatusMutation.mutate({ id: item.id, status: "completed" })}
                                data-testid={`btn-complete-timeline-${item.id}`}
                              >
                                <CheckSquare className="h-4 w-4 mr-2" />
                                Mark Complete
                              </DropdownMenuItem>
                            )}
                            {item.status === "completed" && (
                              <DropdownMenuItem
                                onClick={() => quickStatusMutation.mutate({ id: item.id, status: "not_started" })}
                              >
                                <CheckSquare className="h-4 w-4 mr-2" />
                                Reopen
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeleteTarget(item)}
                              data-testid={`btn-delete-timeline-${item.id}`}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>

                    {/* Expanded description */}
                    {isExpanded && item.description && (
                      <div className="px-4 pb-3 pl-[52px]">
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* GANTT VIEW */}
      {viewMode === "gantt" && items.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {ganttLayout.minDate && ganttLayout.maxDate
                ? `${formatDate(ganttLayout.minDate.toISOString().slice(0, 10))} — ${formatDate(ganttLayout.maxDate.toISOString().slice(0, 10))}`
                : "Gantt Chart"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {ganttLayout.minDate && ganttLayout.totalDays > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[600px]">
                  {/* Month header row */}
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="w-56 min-w-[14rem]" />
                      <th className="px-2 py-1.5">
                        <div className="flex w-full">
                          {ganttLayout.months.map((m, i) => (
                            <div
                              key={i}
                              style={{ width: `${m.widthPct}%` }}
                              className="text-[10px] font-normal text-muted-foreground border-r last:border-0 pr-1 text-center truncate"
                            >
                              {m.label}
                            </div>
                          ))}
                        </div>
                      </th>
                      <th className="w-44" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30" data-testid={`gantt-row-${item.id}`}>
                        {/* Label column */}
                        <td className="px-4 py-2 w-56 min-w-[14rem] align-middle">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[item.status]}`} />
                            <span className="text-muted-foreground flex-shrink-0">
                              {TYPE_ICONS[item.itemType]}
                            </span>
                            <span className={`truncate font-medium text-xs ${item.status === "cancelled" ? "line-through text-muted-foreground" : ""}`}>
                              {item.title}
                            </span>
                          </div>
                        </td>
                        {/* Bar column */}
                        <td className="px-2 py-2 align-middle">
                          <GanttBar item={item} minDate={ganttLayout.minDate!} totalDays={ganttLayout.totalDays} />
                        </td>
                        {/* Date range column */}
                        <td className="px-4 py-2 w-44 text-xs text-muted-foreground text-right whitespace-nowrap align-middle">
                          {item.startDate && item.endDate
                            ? `${formatDate(item.startDate)} → ${formatDate(item.endDate)}`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <BarChart2 className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">Set start and end dates on items to see the Gantt chart.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); setEditingItem(null); setForm({ ...EMPTY_FORM }); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Timeline Item" : "Add Timeline Item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="tl-title">Title <span className="text-destructive">*</span></Label>
              <Input
                id="tl-title"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Foundation Pour"
                data-testid="input-timeline-title"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tl-type">Type</Label>
                <Select value={form.itemType} onValueChange={v => setForm(f => ({ ...f, itemType: v as TimelineItemType }))}>
                  <SelectTrigger id="tl-type" data-testid="select-timeline-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phase">Phase</SelectItem>
                    <SelectItem value="task">Task</SelectItem>
                    <SelectItem value="milestone">Milestone</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tl-status">Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as TimelineItemStatus }))}>
                  <SelectTrigger id="tl-status" data-testid="select-timeline-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_started">Not Started</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tl-start">Start Date</Label>
                <Input
                  id="tl-start"
                  type="date"
                  value={form.startDate}
                  onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                  data-testid="input-timeline-start"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tl-end">End Date</Label>
                <Input
                  id="tl-end"
                  type="date"
                  value={form.endDate}
                  onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                  data-testid="input-timeline-end"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tl-progress">Progress ({form.progressPercent}%)</Label>
                <Input
                  id="tl-progress"
                  type="range"
                  min={0}
                  max={100}
                  value={form.progressPercent}
                  onChange={e => setForm(f => ({ ...f, progressPercent: Number(e.target.value) }))}
                  className="h-2 cursor-pointer"
                  data-testid="input-timeline-progress"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tl-order">Display Order</Label>
                <Input
                  id="tl-order"
                  type="number"
                  min={0}
                  value={form.displayOrder}
                  onChange={e => setForm(f => ({ ...f, displayOrder: Number(e.target.value) }))}
                  data-testid="input-timeline-order"
                />
              </div>
            </div>
            {canWrite && teamMembers.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="tl-assignee">Assignee</Label>
                <Select
                  value={form.assignedToUserId || "__none__"}
                  onValueChange={v => setForm(f => ({ ...f, assignedToUserId: v === "__none__" ? "" : v }))}
                >
                  <SelectTrigger id="tl-assignee" data-testid="select-timeline-assignee">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Unassigned</SelectItem>
                    {teamMembers.map(m => m.contractor && (
                      <SelectItem key={m.contractor.id} value={m.contractor.id}>
                        {m.contractor.fullName || m.contractor.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="tl-description">Description</Label>
              <Textarea
                id="tl-description"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Optional notes or details..."
                rows={2}
                data-testid="textarea-timeline-description"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="tl-client-visible"
                checked={form.clientVisible}
                onCheckedChange={v => setForm(f => ({ ...f, clientVisible: !!v }))}
                data-testid="checkbox-timeline-client-visible"
              />
              <Label htmlFor="tl-client-visible" className="font-normal cursor-pointer">
                Visible to client
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); setEditingItem(null); setForm({ ...EMPTY_FORM }); }}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="btn-save-timeline-item"
            >
              {editingItem ? "Save Changes" : "Add Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Timeline Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.title}</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="btn-confirm-delete-timeline"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
