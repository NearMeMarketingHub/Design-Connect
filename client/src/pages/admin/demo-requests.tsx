import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { apiRequest, parseErrorMessage } from "@/lib/queryClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { SuperAdminLayout } from "@/components/super-admin-layout";
import { CreateCompanyDialog } from "@/components/create-company-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import {
  CalendarCheck,
  Building2,
  Mail,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Search,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  Minus,
} from "lucide-react";
import { format } from "date-fns";

interface DemoRequest {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  message: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  convertedCompanyId: string | null;
  internalNotes: string | null;
  followUpDate: string | null;
  hubspotSyncStatus: string;
  hubspotContactId: string | null;
  hubspotCompanyId: string | null;
  hubspotDealId: string | null;
  hubspotLastSyncedAt: string | null;
  hubspotSyncError: string | null;
}

const DEMO_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  new: { label: "New", color: "bg-blue-100 text-blue-700" },
  contacted: { label: "Contacted", color: "bg-amber-100 text-amber-700" },
  demo_scheduled: { label: "Demo Scheduled", color: "bg-purple-100 text-purple-700" },
  converted: { label: "Converted", color: "bg-green-100 text-green-700" },
  closed: { label: "Closed", color: "bg-gray-100 text-gray-500" },
};

const HUBSPOT_STATUS_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  not_configured: { label: "Not Configured", color: "bg-gray-100 text-gray-500", icon: <Minus className="w-3 h-3" /> },
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-700", icon: <Clock className="w-3 h-3" /> },
  synced: { label: "Synced", color: "bg-green-100 text-green-700", icon: <CheckCircle2 className="w-3 h-3" /> },
  failed: { label: "Failed", color: "bg-red-100 text-red-700", icon: <XCircle className="w-3 h-3" /> },
};

function DemoStatusBadge({ status }: { status: string }) {
  const s = DEMO_STATUS_LABELS[status] ?? { label: status, color: "bg-gray-100 text-gray-500" };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>
      {s.label}
    </span>
  );
}

function HubSpotBadge({ status }: { status: string }) {
  const s = HUBSPOT_STATUS_LABELS[status] ?? HUBSPOT_STATUS_LABELS.not_configured;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>
      {s.icon}
      {s.label}
    </span>
  );
}

// HubSpot deep-link helpers — use search-based URLs since portal ID is not stored client-side.
// These reliably navigate to the correct record search within the user's portal.
function hubspotContactUrl(id: string, email?: string | null) {
  if (email) return `https://app.hubspot.com/contacts/search?q=${encodeURIComponent(email)}`;
  return `https://app.hubspot.com/contacts/search?q=${encodeURIComponent(id)}`;
}
function hubspotCompanyUrl(id: string, name?: string | null) {
  if (name) return `https://app.hubspot.com/contacts/companies?q=${encodeURIComponent(name)}`;
  return `https://app.hubspot.com/contacts/companies?q=${encodeURIComponent(id)}`;
}
function hubspotDealUrl(id: string) {
  return `https://app.hubspot.com/deals/search?q=${encodeURIComponent(id)}`;
}

interface DrawerProps {
  lead: DemoRequest | null;
  onClose: () => void;
  onConvert: (lead: DemoRequest) => void;
  onRefresh: () => void;
}

function DemoRequestDrawer({ lead, onClose, onConvert, onRefresh }: DrawerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [localNotes, setLocalNotes] = useState("");
  const [localFollowUp, setLocalFollowUp] = useState("");
  const [localStatus, setLocalStatus] = useState("");

  useEffect(() => {
    if (lead) {
      setLocalNotes(lead.internalNotes ?? "");
      setLocalFollowUp(lead.followUpDate ? format(new Date(lead.followUpDate), "yyyy-MM-dd") : "");
      setLocalStatus(lead.status);
    }
  }, [lead?.id, lead?.internalNotes, lead?.followUpDate, lead?.status]);

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiRequest("PATCH", `/api/admin/demo-requests/${lead!.id}`, data).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/demo-requests"] });
      onRefresh();
      toast({ title: "Saved" });
    },
    onError: (err: Error) => toast({ title: "Error", description: parseErrorMessage(err), variant: "destructive" }),
  });

  const retryHubSpotMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/admin/demo-requests/${lead!.id}/retry-hubspot`).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/demo-requests"] });
      onRefresh();
      toast({ title: "HubSpot sync complete" });
    },
    onError: (err: Error) => toast({ title: "Sync error", description: parseErrorMessage(err), variant: "destructive" }),
  });

  if (!lead) return null;

  const hasHubSpotRecord = !!(lead.hubspotContactId || lead.hubspotDealId);
  const canRetrySync =
    lead.hubspotSyncStatus === "failed" ||
    lead.hubspotSyncStatus === "not_configured" ||
    lead.hubspotSyncStatus === "pending";

  return (
    <Sheet open={!!lead} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto" data-testid="drawer-demo-request">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-lg font-semibold">{lead.name}</SheetTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <DemoStatusBadge status={lead.status} />
            <HubSpotBadge status={lead.hubspotSyncStatus} />
          </div>
        </SheetHeader>

        <div className="space-y-5 pb-8">
          {/* Contact info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Company</p>
              <p>{lead.company || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Phone</p>
              <p>{lead.phone || "—"}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Email</p>
              <a href={`mailto:${lead.email}`} className="text-blue-600 hover:underline">{lead.email}</a>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Submitted</p>
              <p>{format(new Date(lead.createdAt), "MMM d, yyyy h:mm a")}</p>
            </div>
          </div>

          {lead.message && (
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">Business Needs</p>
              <p className="text-sm bg-muted/40 rounded p-2.5 whitespace-pre-wrap">{lead.message}</p>
            </div>
          )}

          <Separator />

          {/* Status */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</Label>
            <div className="flex gap-2">
              <Select value={localStatus} onValueChange={setLocalStatus}>
                <SelectTrigger className="flex-1 h-8 text-sm" data-testid="select-drawer-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DEMO_STATUS_LABELS).map(([val, { label }]) => (
                    <SelectItem key={val} value={val} className="text-sm">{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                disabled={localStatus === lead.status || updateMutation.isPending}
                onClick={() => updateMutation.mutate({ status: localStatus })}
                data-testid="button-save-status"
              >
                Save
              </Button>
            </div>
          </div>

          {/* Follow-up date */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Follow-Up Date</Label>
            <div className="flex gap-2">
              <Input
                type="date"
                className="flex-1 h-8 text-sm"
                value={localFollowUp}
                onChange={(e) => setLocalFollowUp(e.target.value)}
                data-testid="input-follow-up-date"
              />
              <Button
                size="sm"
                disabled={updateMutation.isPending}
                onClick={() => updateMutation.mutate({ followUpDate: localFollowUp || null })}
                data-testid="button-save-follow-up"
              >
                Save
              </Button>
            </div>
          </div>

          {/* Internal notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Internal Notes</Label>
            <Textarea
              value={localNotes}
              onChange={(e) => setLocalNotes(e.target.value)}
              placeholder="Add notes visible only to admins…"
              rows={3}
              className="text-sm resize-none"
              data-testid="textarea-internal-notes"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={localNotes === (lead.internalNotes ?? "") || updateMutation.isPending}
              onClick={() => updateMutation.mutate({ internalNotes: localNotes })}
              data-testid="button-save-notes"
            >
              Save Notes
            </Button>
          </div>

          <Separator />

          {/* Converted company link */}
          {lead.convertedCompanyId && (
            <div className="rounded-lg bg-green-50 border border-green-200 p-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-green-800">Converted to Company</p>
                <p className="text-xs text-green-700 mt-0.5">This lead has been converted.</p>
              </div>
              <Link href={`/admin/companies/${lead.convertedCompanyId}`}>
                <Button size="sm" variant="outline" className="text-xs gap-1" data-testid="button-view-company">
                  View Company <ChevronRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
          )}

          {/* HubSpot info */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">HubSpot</p>
            <div className="rounded-lg border p-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Sync Status</span>
                <HubSpotBadge status={lead.hubspotSyncStatus} />
              </div>
              {lead.hubspotSyncStatus === "not_configured" && (
                <p className="text-xs text-muted-foreground">
                  HubSpot is not configured. Add the required HubSpot access token to enable demo request syncing.
                </p>
              )}
              {lead.hubspotLastSyncedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Last Synced</span>
                  <span className="text-xs">{format(new Date(lead.hubspotLastSyncedAt), "MMM d, yyyy h:mm a")}</span>
                </div>
              )}
              {lead.hubspotContactId && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Contact</span>
                  <a
                    href={hubspotContactUrl(lead.hubspotContactId, lead.email)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline flex items-center gap-0.5"
                    data-testid="link-hubspot-contact"
                  >
                    {lead.hubspotContactId} <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
              {lead.hubspotCompanyId && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Company</span>
                  <a
                    href={hubspotCompanyUrl(lead.hubspotCompanyId, lead.company)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline flex items-center gap-0.5"
                    data-testid="link-hubspot-company"
                  >
                    {lead.hubspotCompanyId} <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
              {lead.hubspotDealId && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Deal</span>
                  <a
                    href={hubspotDealUrl(lead.hubspotDealId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline flex items-center gap-0.5"
                    data-testid="link-hubspot-deal"
                  >
                    {lead.hubspotDealId} <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
              {lead.hubspotSyncStatus === "failed" && lead.hubspotSyncError && (
                <div className="rounded bg-red-50 border border-red-200 p-2 flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-red-700">{lead.hubspotSyncError}</p>
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            {canRetrySync && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={retryHubSpotMutation.isPending}
                onClick={() => retryHubSpotMutation.mutate()}
                data-testid="button-retry-hubspot"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${retryHubSpotMutation.isPending ? "animate-spin" : ""}`} />
                {retryHubSpotMutation.isPending ? "Syncing…" : "Retry / Resume HubSpot Sync"}
              </Button>
            )}
            {hasHubSpotRecord && (
              <a
                href={lead.hubspotContactId ? hubspotContactUrl(lead.hubspotContactId, lead.email) : hubspotDealUrl(lead.hubspotDealId!)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm" className="w-full gap-1.5" data-testid="button-open-hubspot">
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open in HubSpot
                </Button>
              </a>
            )}
            {lead.status !== "converted" && (
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => onConvert(lead)}
                data-testid="button-drawer-convert"
              >
                <Building2 className="w-3.5 h-3.5" />
                Convert to Company
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function AdminDemoRequests() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [hubspotFilter, setHubspotFilter] = useState("all");
  const [selectedLead, setSelectedLead] = useState<DemoRequest | null>(null);
  const [createCompanyOpen, setCreateCompanyOpen] = useState(false);
  const [convertingLead, setConvertingLead] = useState<DemoRequest | null>(null);

  const { data: demoRequests = [], refetch } = useQuery<DemoRequest[]>({
    queryKey: ["/api/admin/demo-requests"],
    queryFn: () => apiRequest("GET", "/api/admin/demo-requests").then((r) => r.json()),
    enabled: user?.role === "admin",
  });

  const updateDemoStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/admin/demo-requests/${id}`, { status }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/demo-requests"] }),
    onError: (err: Error) =>
      toast({ title: "Error", description: parseErrorMessage(err), variant: "destructive" }),
  });

  // Keep drawer in sync with latest data
  useEffect(() => {
    if (selectedLead) {
      const fresh = demoRequests.find((r) => r.id === selectedLead.id);
      if (fresh) setSelectedLead(fresh);
    }
  }, [demoRequests]);

  const filtered = demoRequests.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (hubspotFilter !== "all" && r.hubspotSyncStatus !== hubspotFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (
        !r.name.toLowerCase().includes(q) &&
        !r.company.toLowerCase().includes(q) &&
        !r.email.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  const openConvertDialog = (lead: DemoRequest) => {
    setConvertingLead(lead);
    setCreateCompanyOpen(true);
  };

  const handleCreateClose = (open: boolean) => {
    setCreateCompanyOpen(open);
    if (!open) setConvertingLead(null);
  };

  return (
    <SuperAdminLayout>
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-purple-600" />
            <h1 className="text-2xl font-bold text-foreground">Demo Requests / Leads</h1>
          </div>
          <Badge variant="secondary" data-testid="badge-total-leads">{demoRequests.length} total</Badge>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-8 h-9 text-sm"
              placeholder="Search by name, company, email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-leads"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px] h-9 text-sm" data-testid="select-filter-status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(DEMO_STATUS_LABELS).map(([val, { label }]) => (
                <SelectItem key={val} value={val} className="text-sm">{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={hubspotFilter} onValueChange={setHubspotFilter}>
            <SelectTrigger className="w-[170px] h-9 text-sm" data-testid="select-filter-hubspot">
              <SelectValue placeholder="HubSpot Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All HubSpot</SelectItem>
              {Object.entries(HUBSPOT_STATUS_LABELS).map(([val, { label }]) => (
                <SelectItem key={val} value={val} className="text-sm">{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(search || statusFilter !== "all" || hubspotFilter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-sm"
              onClick={() => { setSearch(""); setStatusFilter("all"); setHubspotFilter("all"); }}
              data-testid="button-clear-filters"
            >
              Clear
            </Button>
          )}
        </div>

        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              {demoRequests.length === 0 ? "No demo requests yet." : "No results match your filters."}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>HubSpot</TableHead>
                    <TableHead>Follow-Up</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((lead) => (
                    <TableRow
                      key={lead.id}
                      data-testid={`demo-request-${lead.id}`}
                      className="cursor-pointer hover:bg-muted/30"
                      onClick={() => setSelectedLead(lead)}
                    >
                      <TableCell className="font-medium whitespace-nowrap">{lead.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {lead.company || "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        <a
                          href={`mailto:${lead.email}`}
                          className="text-blue-600 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {lead.email}
                        </a>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={lead.status}
                          onValueChange={(val) =>
                            updateDemoStatusMutation.mutate({ id: lead.id, status: val })
                          }
                        >
                          <SelectTrigger
                            className="w-[160px] h-7 text-xs"
                            data-testid={`select-demo-status-${lead.id}`}
                          >
                            <SelectValue>
                              <DemoStatusBadge status={lead.status} />
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(DEMO_STATUS_LABELS).map(([val, { label }]) => (
                              <SelectItem key={val} value={val} className="text-xs">
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <HubSpotBadge status={lead.hubspotSyncStatus} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {lead.followUpDate
                          ? format(new Date(lead.followUpDate), "MMM d, yyyy")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {format(new Date(lead.createdAt), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedLead(lead)}
                            data-testid={`button-view-lead-${lead.id}`}
                            title="View Details"
                          >
                            Details <ChevronRight className="w-3 h-3 ml-0.5" />
                          </Button>
                          {lead.status !== "converted" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openConvertDialog(lead)}
                              data-testid={`button-convert-lead-${lead.id}`}
                              title="Convert to Company"
                            >
                              <Building2 className="w-3.5 h-3.5 mr-1" />
                              Convert
                            </Button>
                          )}
                          <a
                            href={`mailto:${lead.email}?subject=Re: Near Me Construct Demo Request`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button size="sm" variant="ghost" title="Reply by email" data-testid={`button-email-lead-${lead.id}`}>
                              <Mail className="w-3.5 h-3.5" />
                            </Button>
                          </a>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Detail Drawer */}
      <DemoRequestDrawer
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        onConvert={(lead) => { openConvertDialog(lead); }}
        onRefresh={() => refetch()}
      />

      {/* Convert to Company Dialog */}
      <CreateCompanyDialog
        open={createCompanyOpen}
        onOpenChange={handleCreateClose}
        prefill={
          convertingLead
            ? {
                companyName: convertingLead.company || "",
                ownerName: convertingLead.name,
                ownerEmail: convertingLead.email,
              }
            : null
        }
        leadId={convertingLead?.id}
        onCompanyCreated={(companyId) => {
          // Re-open drawer with the same lead but updated convertedCompanyId so the link appears
          if (convertingLead) {
            setSelectedLead({ ...convertingLead, status: "converted", convertedCompanyId: companyId });
          }
        }}
      />
    </SuperAdminLayout>
  );
}
