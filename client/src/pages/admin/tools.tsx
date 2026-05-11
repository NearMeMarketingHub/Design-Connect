import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { apiRequest, parseErrorMessage } from "@/lib/queryClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { SuperAdminLayout } from "@/components/super-admin-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link } from "wouter";
import {
  Wrench,
  Calculator,
  TrendingUp,
  TestTube,
  Layers,
  LayoutDashboard,
  RefreshCw,
  Receipt,
  FileText,
  Plus,
  Pencil,
  Trash2,
  Loader2,
} from "lucide-react";

interface RoleDef {
  id: string;
  name: string;
  type: string;
  permissions: Record<string, boolean>;
  isDefault?: boolean;
}

const PERMISSION_KEYS: { key: string; label: string }[] = [
  { key: "viewProjects", label: "View Projects" },
  { key: "editProjects", label: "Edit Projects" },
  { key: "manageDocuments", label: "Manage Documents" },
  { key: "viewFinancials", label: "View Financials" },
  { key: "manageTeam", label: "Manage Team" },
  { key: "viewMessages", label: "View & Send Messages" },
  { key: "signDocuments", label: "Sign Documents" },
];

export default function AdminTools() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [roleDefDialogOpen, setRoleDefDialogOpen] = useState(false);
  const [editingRoleDef, setEditingRoleDef] = useState<RoleDef | null>(null);
  const [roleDefForm, setRoleDefForm] = useState({
    name: "",
    type: "contractor",
    permissions: {} as Record<string, boolean>,
  });

  const { data: roleDefs = [], refetch: refetchRoleDefs } = useQuery<RoleDef[]>({
    queryKey: ["/api/admin/role-definitions"],
    queryFn: () =>
      apiRequest("GET", "/api/admin/role-definitions").then((r) => r.json()),
    enabled: user?.role === "admin",
  });

  const { data: sandboxData, isLoading: sandboxLoading } = useQuery({
    queryKey: ["/api/sandbox/data"],
    queryFn: () => api.getSandboxData(),
    enabled: user?.role === "admin",
  });

  const saveRoleDefMutation = useMutation({
    mutationFn: (data: { name: string; type: string; permissions: Record<string, boolean> }) => {
      const url = editingRoleDef
        ? `/api/admin/role-definitions/${editingRoleDef.id}`
        : "/api/admin/role-definitions";
      const method = editingRoleDef ? "PATCH" : "POST";
      return apiRequest(method, url, data).then((r) => r.json());
    },
    onSuccess: () => {
      refetchRoleDefs();
      setRoleDefDialogOpen(false);
      toast({ title: editingRoleDef ? "Role updated" : "Role created" });
    },
    onError: (err: Error) =>
      toast({ title: "Error", description: parseErrorMessage(err), variant: "destructive" }),
  });

  const deleteRoleDefMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("DELETE", `/api/admin/role-definitions/${id}`),
    onSuccess: () => {
      refetchRoleDefs();
      toast({ title: "Role deleted" });
    },
    onError: (err: Error) =>
      toast({ title: "Error", description: parseErrorMessage(err), variant: "destructive" }),
  });

  const initSandboxMutation = useMutation({
    mutationFn: () => api.initializeSandbox(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sandbox/data"] });
      toast({ title: "Sandbox Initialized" });
    },
    onError: (error: Error) =>
      toast({
        title: "Initialization Failed",
        description: parseErrorMessage(error),
        variant: "destructive",
      }),
  });

  const resetSandboxMutation = useMutation({
    mutationFn: () => api.resetSandbox(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sandbox/data"] });
      toast({ title: "Sandbox Reset" });
    },
    onError: (error: Error) =>
      toast({
        title: "Reset Failed",
        description: parseErrorMessage(error),
        variant: "destructive",
      }),
  });

  const openCreateRoleDef = () => {
    setEditingRoleDef(null);
    setRoleDefForm({ name: "", type: "contractor", permissions: {} });
    setRoleDefDialogOpen(true);
  };

  const openEditRoleDef = (def: RoleDef) => {
    setEditingRoleDef(def);
    setRoleDefForm({
      name: def.name,
      type: def.type,
      permissions: def.permissions || {},
    });
    setRoleDefDialogOpen(true);
  };

  return (
    <SuperAdminLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-2">
          <Wrench className="w-5 h-5 text-gray-500" />
          <h1 className="text-2xl font-bold text-foreground">Admin Tools</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-green-600" />
                  Budget Manager
                </CardTitle>
                <CardDescription>Manage pricing and budget templates</CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/admin/budget">
                  <Button className="w-full" data-testid="button-budget-manager">
                    <Calculator className="w-4 h-4 mr-2" />
                    Open Price Manager
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  Financial Management
                </CardTitle>
                <CardDescription>Sales, estimates, accounting, and invoicing</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link href="/admin/sales">
                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    data-testid="button-sales"
                  >
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Sales Dashboard
                  </Button>
                </Link>
                <Link href="/admin/estimates">
                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    data-testid="button-estimates"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Estimator
                  </Button>
                </Link>
                <Link href="/admin/accounting">
                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    data-testid="button-accounting"
                  >
                    <Receipt className="w-4 h-4 mr-2" />
                    Accounting
                  </Button>
                </Link>
                <Link href="/admin/invoice/new">
                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    data-testid="button-new-invoice"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    New Invoice
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TestTube className="w-4 h-4 text-purple-600" />
                Sandbox Testing
              </CardTitle>
              <CardDescription>Test features in an isolated environment</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {sandboxLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : !sandboxData?.project ? (
                <div className="text-center py-4">
                  <p className="text-muted-foreground text-sm mb-4">
                    No sandbox data. Initialize to create test accounts.
                  </p>
                  <Button
                    onClick={() => initSandboxMutation.mutate()}
                    disabled={initSandboxMutation.isPending}
                    className="w-full"
                    data-testid="button-init-sandbox"
                  >
                    {initSandboxMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Initializing…
                      </>
                    ) : (
                      <>
                        <TestTube className="w-4 h-4 mr-2" />
                        Initialize Sandbox
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <>
                  <div className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-3">
                    <p className="text-xs text-purple-700 dark:text-purple-300">
                      <strong>Test Client:</strong> {sandboxData.client?.name}
                      <br />
                      <strong>Test Contractor:</strong> {sandboxData.contractor?.name}
                      <br />
                      <strong>Test Project:</strong> {sandboxData.project.name}
                    </p>
                  </div>
                  <Link href="/sandbox/dashboard">
                    <Button
                      className="w-full justify-start"
                      variant="outline"
                      data-testid="button-sandbox-dashboard"
                    >
                      <LayoutDashboard className="w-4 h-4 mr-2" />
                      Client Dashboard
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-amber-600 border-amber-300 hover:bg-amber-50"
                    onClick={() => resetSandboxMutation.mutate()}
                    disabled={resetSandboxMutation.isPending}
                    data-testid="button-reset-sandbox"
                  >
                    {resetSandboxMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Reset Sandbox Data
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  Role Definitions
                </CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={openCreateRoleDef}
                  data-testid="button-add-role-def"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <CardDescription>Team member role templates and permissions</CardDescription>
            </CardHeader>
            <CardContent>
              {roleDefs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No role definitions yet.</p>
              ) : (
                <div className="space-y-2">
                  {roleDefs.map((def) => (
                    <div
                      key={def.id}
                      className="flex items-center justify-between py-2 px-3 rounded-lg border"
                      data-testid={`role-def-${def.id}`}
                    >
                      <div>
                        <p className="font-medium text-sm">{def.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{def.type}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-7 h-7"
                          onClick={() => openEditRoleDef(def)}
                          data-testid={`button-edit-role-${def.id}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        {!def.isDefault && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive w-7 h-7"
                            onClick={() => deleteRoleDefMutation.mutate(def.id)}
                            disabled={deleteRoleDefMutation.isPending}
                            data-testid={`button-delete-role-${def.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={roleDefDialogOpen} onOpenChange={setRoleDefDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingRoleDef ? "Edit Role Definition" : "Create Role Definition"}
            </DialogTitle>
            <DialogDescription>
              Define a role name, type, and permission set.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="role-name">Role Name</Label>
              <Input
                id="role-name"
                value={roleDefForm.name}
                onChange={(e) => setRoleDefForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Project Manager"
                data-testid="input-role-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role-type">Role Type</Label>
              <Select
                value={roleDefForm.type}
                onValueChange={(v) => setRoleDefForm((f) => ({ ...f, type: v }))}
              >
                <SelectTrigger id="role-type" data-testid="select-role-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contractor">Contractor (Team Member)</SelectItem>
                  <SelectItem value="subcontractor">Subcontractor (Trade Specialty)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="space-y-2 rounded-lg border p-3">
                {PERMISSION_KEYS.map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-sm">{label}</span>
                    <Switch
                      checked={!!roleDefForm.permissions[key]}
                      onCheckedChange={(v) =>
                        setRoleDefForm((f) => ({
                          ...f,
                          permissions: { ...f.permissions, [key]: v },
                        }))
                      }
                      data-testid={`switch-perm-${key}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRoleDefDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => saveRoleDefMutation.mutate(roleDefForm)}
              disabled={!roleDefForm.name.trim() || saveRoleDefMutation.isPending}
              data-testid="button-save-role-def"
            >
              {saveRoleDefMutation.isPending
                ? "Saving…"
                : editingRoleDef
                ? "Save Changes"
                : "Create Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SuperAdminLayout>
  );
}
