import { useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { SuperAdminLayout } from "@/components/super-admin-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { FileText, Search, Info, Building2, User, Link2, CalendarCheck, Settings, Loader2, RefreshCw } from "lucide-react";
import { format, parseISO } from "date-fns";

interface AuditEvent {
  id: string;
  actorUserId: string;
  actorName: string;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string | null;
  entityName: string | null;
  companyId: string | null;
  companyName?: string | null;
  projectId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface AuditLogResponse {
  events: AuditEvent[];
  total: number;
}

interface AuditMeta {
  actions: string[];
  entityTypes: string[];
  companies: { id: string; name: string }[];
}

const ACTION_LABELS: Record<string, string> = {
  company_created: "Company Created",
  company_access_updated: "Access Updated",
  company_suspended: "Company Suspended",
  company_reactivated: "Company Reactivated",
  user_approved: "User Approved",
  user_disabled: "User Disabled",
  user_reactivated: "User Reactivated",
  password_reset_sent: "Password Reset Sent",
  invite_resent: "Invite Resent",
  invite_revoked: "Invite Revoked",
  demo_request_status_updated: "Lead Status Updated",
  demo_request_converted: "Lead Converted",
  hubspot_sync_retried: "HubSpot Sync Retried",
  pricing_access_updated: "Pricing & Access Updated",
};

const ACTION_COLORS: Record<string, string> = {
  company_created: "bg-blue-100 text-blue-700",
  company_access_updated: "bg-indigo-100 text-indigo-700",
  company_suspended: "bg-red-100 text-red-700",
  company_reactivated: "bg-green-100 text-green-700",
  user_approved: "bg-green-100 text-green-700",
  user_disabled: "bg-red-100 text-red-700",
  user_reactivated: "bg-green-100 text-green-700",
  password_reset_sent: "bg-orange-100 text-orange-700",
  invite_resent: "bg-yellow-100 text-yellow-700",
  invite_revoked: "bg-red-100 text-red-700",
  demo_request_status_updated: "bg-purple-100 text-purple-700",
  demo_request_converted: "bg-blue-100 text-blue-700",
  hubspot_sync_retried: "bg-teal-100 text-teal-700",
  pricing_access_updated: "bg-gray-100 text-gray-700",
};

const ENTITY_ICONS: Record<string, typeof FileText> = {
  user: User,
  company: Building2,
  invite: Link2,
  demo_request: CalendarCheck,
  platform: Settings,
};

function EntityIcon({ type }: { type: string }) {
  const Icon = ENTITY_ICONS[type] ?? FileText;
  return <Icon className="w-3.5 h-3.5 shrink-0" />;
}

function ActionBadge({ action }: { action: string }) {
  const label = ACTION_LABELS[action] ?? action.replace(/_/g, " ");
  const color = ACTION_COLORS[action] ?? "bg-gray-100 text-gray-700";
  return (
    <Badge className={`text-xs border-0 font-medium ${color}`} data-testid={`badge-action-${action}`}>
      {label}
    </Badge>
  );
}

function formatTimestamp(ts: string) {
  try {
    return format(parseISO(ts), "MMM d, yyyy HH:mm:ss");
  } catch {
    return ts;
  }
}

function MetadataView({ metadata }: { metadata: Record<string, unknown> | null }) {
  if (!metadata) return <p className="text-muted-foreground text-sm italic">No additional details</p>;
  const entries = Object.entries(metadata);
  if (entries.length === 0) return <p className="text-muted-foreground text-sm italic">No additional details</p>;
  return (
    <div className="space-y-1">
      {entries.map(([k, v]) => (
        <div key={k} className="flex gap-2 text-sm">
          <span className="text-muted-foreground w-36 shrink-0">{k.replace(/_/g, " ")}</span>
          <span className="font-medium break-all">{String(v ?? "—")}</span>
        </div>
      ))}
    </div>
  );
}

const PAGE_SIZE = 50;

export default function AdminAuditLog() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [entityTypeFilter, setEntityTypeFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [page, setPage] = useState(0);

  const params = useMemo(() => {
    const p: Record<string, string> = {
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
    };
    if (search) p.search = search;
    if (actionFilter !== "all") p.action = actionFilter;
    if (entityTypeFilter !== "all") p.entityType = entityTypeFilter;
    if (companyFilter !== "all") p.companyId = companyFilter;
    return p;
  }, [search, actionFilter, entityTypeFilter, companyFilter, page]);

  const queryString = useMemo(() => new URLSearchParams(params).toString(), [params]);

  const { data, isLoading, isFetching, refetch } = useQuery<AuditLogResponse>({
    queryKey: ["/api/admin/audit-log", queryString],
    queryFn: () =>
      apiRequest("GET", `/api/admin/audit-log?${queryString}`).then((r) => r.json()),
    enabled: user?.role === "admin",
  });

  const { data: meta } = useQuery<AuditMeta>({
    queryKey: ["/api/admin/audit-log/meta"],
    queryFn: () =>
      apiRequest("GET", "/api/admin/audit-log/meta").then((r) => r.json()),
    enabled: user?.role === "admin",
  });

  const events = data?.events ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleSearchChange = (v: string) => {
    setSearch(v);
    setPage(0);
  };
  const handleActionChange = (v: string) => { setActionFilter(v); setPage(0); };
  const handleEntityTypeChange = (v: string) => { setEntityTypeFilter(v); setPage(0); };
  const handleCompanyChange = (v: string) => { setCompanyFilter(v); setPage(0); };

  return (
    <SuperAdminLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Audit Log</h1>
            <p className="text-muted-foreground mt-0.5 text-sm">
              A full trail of admin actions across the platform.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            data-testid="button-refresh-audit-log"
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-8 h-9"
                  placeholder="Search actor, entity, action…"
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  data-testid="input-audit-search"
                />
              </div>

              <Select value={actionFilter} onValueChange={handleActionChange}>
                <SelectTrigger className="h-9 w-48" data-testid="select-action-filter">
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  {(meta?.actions ?? Object.keys(ACTION_LABELS)).map((a) => (
                    <SelectItem key={a} value={a}>
                      {ACTION_LABELS[a] ?? a.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={entityTypeFilter} onValueChange={handleEntityTypeChange}>
                <SelectTrigger className="h-9 w-44" data-testid="select-entity-type-filter">
                  <SelectValue placeholder="All entity types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All entity types</SelectItem>
                  {(meta?.entityTypes ?? ["user", "company", "invite", "demo_request", "platform"]).map((et) => (
                    <SelectItem key={et} value={et}>
                      {et.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {meta?.companies && meta.companies.length > 0 && (
                <Select value={companyFilter} onValueChange={handleCompanyChange}>
                  <SelectTrigger className="h-9 w-48" data-testid="select-company-filter">
                    <SelectValue placeholder="All companies" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All companies</SelectItem>
                    {meta.companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <div className="p-3 bg-muted rounded-full">
                  <FileText className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">No audit events found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-40">Date / Time</TableHead>
                      <TableHead className="w-44">Actor</TableHead>
                      <TableHead className="w-48">Action</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead className="w-40">Company</TableHead>
                      <TableHead className="w-14 text-right">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((event) => (
                      <TableRow key={event.id} data-testid={`row-audit-${event.id}`}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatTimestamp(event.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium truncate max-w-40">{event.actorName}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-40">{event.actorEmail}</div>
                        </TableCell>
                        <TableCell>
                          <ActionBadge action={event.action} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm">
                            <EntityIcon type={event.entityType} />
                            <span className="text-muted-foreground text-xs">{event.entityType}</span>
                            {event.entityName && (
                              <span className="font-medium truncate max-w-40">{event.entityName}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground truncate max-w-40">
                          {event.companyName ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setSelectedEvent(event)}
                            data-testid={`button-audit-details-${event.id}`}
                          >
                            <Info className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                data-testid="button-audit-prev"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                data-testid="button-audit-next"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      <Sheet open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto" data-testid="sheet-audit-detail">
          {selectedEvent && (
            <>
              <SheetHeader className="pb-4">
                <SheetTitle className="text-base">Audit Event Details</SheetTitle>
              </SheetHeader>

              <div className="space-y-5 text-sm">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">When</p>
                  <p>{formatTimestamp(selectedEvent.createdAt)}</p>
                </div>

                <Separator />

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Actor</p>
                  <p className="font-medium">{selectedEvent.actorName}</p>
                  <p className="text-muted-foreground text-xs">{selectedEvent.actorEmail}</p>
                  <p className="text-muted-foreground text-xs mt-0.5">ID: {selectedEvent.actorUserId}</p>
                </div>

                <Separator />

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Action</p>
                  <ActionBadge action={selectedEvent.action} />
                </div>

                <Separator />

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Entity</p>
                  <div className="flex items-center gap-1.5 mb-1">
                    <EntityIcon type={selectedEvent.entityType} />
                    <span className="capitalize">{selectedEvent.entityType.replace(/_/g, " ")}</span>
                  </div>
                  {selectedEvent.entityName && (
                    <p className="font-medium">{selectedEvent.entityName}</p>
                  )}
                  {selectedEvent.entityId && (
                    <p className="text-muted-foreground text-xs mt-0.5">ID: {selectedEvent.entityId}</p>
                  )}
                </div>

                {(selectedEvent.companyName || selectedEvent.companyId) && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Company</p>
                      {selectedEvent.companyName && <p className="font-medium">{selectedEvent.companyName}</p>}
                      {selectedEvent.companyId && (
                        <p className="text-muted-foreground text-xs">ID: {selectedEvent.companyId}</p>
                      )}
                    </div>
                  </>
                )}

                {selectedEvent.projectId && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Project</p>
                      <p className="text-muted-foreground text-xs">ID: {selectedEvent.projectId}</p>
                    </div>
                  </>
                )}

                <Separator />

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Details</p>
                  <MetadataView metadata={selectedEvent.metadata} />
                </div>

                {(selectedEvent.ipAddress || selectedEvent.userAgent) && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Request Info</p>
                      {selectedEvent.ipAddress && (
                        <div className="flex gap-2 text-sm mb-1">
                          <span className="text-muted-foreground w-20 shrink-0">IP</span>
                          <span className="font-medium">{selectedEvent.ipAddress}</span>
                        </div>
                      )}
                      {selectedEvent.userAgent && (
                        <div className="flex gap-2 text-sm">
                          <span className="text-muted-foreground w-20 shrink-0">User Agent</span>
                          <span className="text-xs break-all">{selectedEvent.userAgent}</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </SuperAdminLayout>
  );
}
