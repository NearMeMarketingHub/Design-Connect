import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiRequest, parseErrorMessage } from "@/lib/queryClient";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { Badge } from "@/components/ui/badge";
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
import {
  Layers,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ShieldCheck,
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

export default function AdminRoleDefinitions() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleDef | null>(null);
  const [form, setForm] = useState({
    name: "",
    type: "contractor",
    permissions: {} as Record<string, boolean>,
  });

  const { data: roleDefs = [], refetch } = useQuery<RoleDef[]>({
    queryKey: ["/api/admin/role-definitions"],
    queryFn: () =>
      apiRequest("GET", "/api/admin/role-definitions").then((r) => r.json()),
    enabled: user?.role === "admin",
  });

  const saveMutation = useMutation({
    mutationFn: (data: { name: string; type: string; permissions: Record<string, boolean> }) => {
      const url = editingRole
        ? `/api/admin/role-definitions/${editingRole.id}`
        : "/api/admin/role-definitions";
      const method = editingRole ? "PATCH" : "POST";
      return apiRequest(method, url, data).then((r) => r.json());
    },
    onSuccess: () => {
      refetch();
      setDialogOpen(false);
      toast({ title: editingRole ? "Role updated" : "Role created" });
    },
    onError: (err: Error) =>
      toast({ title: "Error", description: parseErrorMessage(err), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("DELETE", `/api/admin/role-definitions/${id}`),
    onSuccess: () => {
      refetch();
      toast({ title: "Role deleted" });
    },
    onError: (err: Error) =>
      toast({ title: "Error", description: parseErrorMessage(err), variant: "destructive" }),
  });

  const openCreate = () => {
    setEditingRole(null);
    setForm({ name: "", type: "contractor", permissions: {} });
    setDialogOpen(true);
  };

  const openEdit = (def: RoleDef) => {
    setEditingRole(def);
    setForm({ name: def.name, type: def.type, permissions: def.permissions || {} });
    setDialogOpen(true);
  };

  const contractors = roleDefs.filter((d) => d.type === "contractor");
  const subcontractors = roleDefs.filter((d) => d.type === "subcontractor");

  return (
    <SuperAdminLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            <h1 className="text-2xl font-bold text-foreground">Role Definitions</h1>
          </div>
          <Button onClick={openCreate} data-testid="button-add-role-def">
            <Plus className="w-4 h-4 mr-1.5" />
            New Role
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          Define reusable role templates with permission sets for team members and subcontractors.
          Company owners assign these roles when adding people to their team.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                Contractor Roles
              </CardTitle>
              <CardDescription>For internal team members</CardDescription>
            </CardHeader>
            <CardContent>
              {contractors.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No contractor roles yet.</p>
              ) : (
                <div className="space-y-2">
                  {contractors.map((def) => (
                    <RoleRow key={def.id} def={def} onEdit={openEdit} onDelete={(id) => deleteMutation.mutate(id)} deleting={deleteMutation.isPending} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-orange-600" />
                Subcontractor Roles
              </CardTitle>
              <CardDescription>For trade specialists and external workers</CardDescription>
            </CardHeader>
            <CardContent>
              {subcontractors.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No subcontractor roles yet.</p>
              ) : (
                <div className="space-y-2">
                  {subcontractors.map((def) => (
                    <RoleRow key={def.id} def={def} onEdit={openEdit} onDelete={(id) => deleteMutation.mutate(id)} deleting={deleteMutation.isPending} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingRole ? "Edit Role Definition" : "Create Role Definition"}
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
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Project Manager"
                data-testid="input-role-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role-type">Role Type</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}
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
                      checked={!!form.permissions[key]}
                      onCheckedChange={(v) =>
                        setForm((f) => ({
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
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => saveMutation.mutate(form)}
              disabled={!form.name.trim() || saveMutation.isPending}
              data-testid="button-save-role-def"
            >
              {saveMutation.isPending
                ? "Saving…"
                : editingRole
                ? "Save Changes"
                : "Create Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SuperAdminLayout>
  );
}

function RoleRow({
  def,
  onEdit,
  onDelete,
  deleting,
}: {
  def: RoleDef;
  onEdit: (d: RoleDef) => void;
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  const activePerms = Object.entries(def.permissions || {})
    .filter(([, v]) => v)
    .map(([k]) => k);

  return (
    <div
      className="rounded-lg border p-3 space-y-2"
      data-testid={`role-def-${def.id}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-sm">{def.name}</p>
          {def.isDefault && (
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Platform default</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7"
            onClick={() => onEdit(def)}
            data-testid={`button-edit-role-${def.id}`}
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          {!def.isDefault && (
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive w-7 h-7"
              onClick={() => onDelete(def.id)}
              disabled={deleting}
              data-testid={`button-delete-role-${def.id}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>
      {activePerms.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {activePerms.map((p) => (
            <Badge key={p} variant="secondary" className="text-[10px] px-1.5 py-0">
              {p.replace(/([A-Z])/g, " $1").trim()}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
