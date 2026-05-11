import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiRequest, parseErrorMessage } from "@/lib/queryClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { SuperAdminLayout } from "@/components/super-admin-layout";
import { CreateCompanyDialog } from "@/components/create-company-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { CalendarCheck, Building2, Mail } from "lucide-react";

interface DemoRequest {
  id: string;
  name: string;
  company?: string;
  email: string;
  phone?: string;
  message?: string;
  status: string;
  createdAt: string;
}

const DEMO_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  new: { label: "New", color: "bg-blue-100 text-blue-700" },
  contacted: { label: "Contacted", color: "bg-amber-100 text-amber-700" },
  demo_scheduled: { label: "Demo Scheduled", color: "bg-purple-100 text-purple-700" },
  converted: { label: "Converted", color: "bg-green-100 text-green-700" },
  closed: { label: "Closed", color: "bg-gray-100 text-gray-500" },
};

function DemoStatusBadge({ status }: { status: string }) {
  const s = DEMO_STATUS_LABELS[status] ?? { label: status, color: "bg-gray-100 text-gray-500" };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>
      {s.label}
    </span>
  );
}

export default function AdminDemoRequests() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [createCompanyOpen, setCreateCompanyOpen] = useState(false);
  const [convertingLead, setConvertingLead] = useState<DemoRequest | null>(null);

  const { data: demoRequests = [] } = useQuery<DemoRequest[]>({
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
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-purple-600" />
            <h1 className="text-2xl font-bold text-foreground">Demo Requests / Leads</h1>
          </div>
          <Badge variant="secondary">{demoRequests.length} total</Badge>
        </div>

        {demoRequests.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No demo requests yet.
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
                    <TableHead>Phone</TableHead>
                    <TableHead>Message / Needs</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {demoRequests.map((lead) => (
                    <TableRow key={lead.id} data-testid={`demo-request-${lead.id}`}>
                      <TableCell className="font-medium whitespace-nowrap">{lead.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {lead.company || "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        <a
                          href={`mailto:${lead.email}`}
                          className="text-blue-600 hover:underline"
                        >
                          {lead.email}
                        </a>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {lead.phone || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px]">
                        <span className="line-clamp-2">{lead.message || "—"}</span>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={lead.status}
                          onValueChange={(val) =>
                            updateDemoStatusMutation.mutate({ id: lead.id, status: val })
                          }
                        >
                          <SelectTrigger
                            className="w-[140px] h-7 text-xs"
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
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {new Date(lead.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
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
                          <a
                            href={`mailto:${lead.email}?subject=Re: BuildVision Demo Request`}
                          >
                            <Button size="sm" variant="ghost" title="Reply by email">
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
      />
    </SuperAdminLayout>
  );
}
