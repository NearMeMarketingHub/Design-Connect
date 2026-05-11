import { useAuth } from "@/lib/auth-context";
import { apiRequest, parseErrorMessage } from "@/lib/queryClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { SuperAdminLayout } from "@/components/super-admin-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "wouter";
import { Link2, Eye, RefreshCw, X } from "lucide-react";

interface AdminInvite {
  id: string;
  inviteType: string;
  email: string;
  status: string;
  projectId?: string | null;
  projectName?: string | null;
  companyName?: string | null;
  sentAt: string;
  acceptedAt?: string | null;
  expiresAt?: string | null;
}

function InviteStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700",
    accepted: "bg-green-100 text-green-700",
    expired: "bg-red-100 text-red-700",
    revoked: "bg-gray-100 text-gray-500",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
        colors[status] ?? "bg-gray-100 text-gray-500"
      }`}
    >
      {status}
    </span>
  );
}

export default function AdminInvites() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: adminInvites = [] } = useQuery<AdminInvite[]>({
    queryKey: ["/api/admin/invites"],
    queryFn: () => apiRequest("GET", "/api/admin/invites").then((r) => r.json()),
    enabled: user?.role === "admin",
  });

  const revokeInviteMutation = useMutation({
    mutationFn: ({ id, type }: { id: string; type: string }) =>
      apiRequest("POST", `/api/admin/invites/${id}/revoke`, { type }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invites"] });
      toast({ title: "Invite revoked" });
    },
    onError: (err: Error) =>
      toast({ title: "Error", description: parseErrorMessage(err), variant: "destructive" }),
  });

  const resendInviteMutation = useMutation({
    mutationFn: ({ id, type }: { id: string; type: string }) =>
      apiRequest("POST", `/api/admin/invites/${id}/resend`, { type }).then((r) => r.json()),
    onSuccess: () => toast({ title: "Invite reminder sent" }),
    onError: (err: Error) =>
      toast({ title: "Error", description: parseErrorMessage(err), variant: "destructive" }),
  });

  return (
    <SuperAdminLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-teal-600" />
            <h1 className="text-2xl font-bold text-foreground">Invite Status</h1>
          </div>
          <Badge variant="secondary">{adminInvites.length} total</Badge>
        </div>

        {adminInvites.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No invites found across the platform.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invited Email</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent At</TableHead>
                    <TableHead>Accepted At</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adminInvites.map((inv, idx) => (
                    <TableRow key={`${inv.id}-${idx}`} data-testid={`invite-row-${inv.id}`}>
                      <TableCell className="text-sm font-medium">{inv.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize text-xs">
                          {inv.inviteType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {inv.companyName || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {inv.projectName || "—"}
                      </TableCell>
                      <TableCell>
                        <InviteStatusBadge status={inv.status} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {new Date(inv.sentAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {inv.acceptedAt ? new Date(inv.acceptedAt).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {inv.expiresAt ? new Date(inv.expiresAt).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {inv.projectId && (
                            <Link href={`/admin/project/${inv.projectId}`}>
                              <Button
                                size="sm"
                                variant="ghost"
                                title="View related project"
                                data-testid={`button-view-project-${inv.id}`}
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                            </Link>
                          )}
                          {inv.status === "pending" && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-blue-600 hover:text-blue-700"
                                onClick={() =>
                                  resendInviteMutation.mutate({ id: inv.id, type: inv.inviteType })
                                }
                                disabled={resendInviteMutation.isPending}
                                data-testid={`button-resend-invite-${inv.id}`}
                                title="Resend invite"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-600 hover:text-red-700"
                                onClick={() =>
                                  revokeInviteMutation.mutate({ id: inv.id, type: inv.inviteType })
                                }
                                disabled={revokeInviteMutation.isPending}
                                data-testid={`button-revoke-invite-${inv.id}`}
                                title="Revoke invite"
                              >
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
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
    </SuperAdminLayout>
  );
}
