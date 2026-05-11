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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Receipt, Wrench, Plus, Pencil, Trash2, CheckCircle } from "lucide-react";

interface SubscriptionTier {
  id: string;
  name: string;
  price: string;
  maxProjects?: number | null;
  features?: string[];
  sortOrder?: number;
  isActive: boolean;
}

export default function AdminPricingAccess() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [tierDialogOpen, setTierDialogOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<SubscriptionTier | null>(null);
  const [tierForm, setTierForm] = useState({
    name: "",
    price: "0",
    maxProjects: "",
    features: "",
    sortOrder: "0",
    isActive: true,
  });

  const { data: adminTiers = [], refetch: refetchTiers } = useQuery<SubscriptionTier[]>({
    queryKey: ["/api/admin/subscription/tiers"],
    queryFn: () => apiRequest("GET", "/api/admin/subscription/tiers").then((r) => r.json()),
    enabled: user?.role === "admin",
  });

  const { data: platformSettingsData, refetch: refetchPlatformSettings } = useQuery({
    queryKey: ["/api/admin/platform-settings"],
    queryFn: () => apiRequest("GET", "/api/admin/platform-settings").then((r) => r.json()),
    enabled: user?.role === "admin",
  });

  const saveTierMutation = useMutation({
    mutationFn: async (data: typeof tierForm) => {
      const payload = {
        name: data.name.trim(),
        price: data.price || "0",
        maxProjects: data.maxProjects ? parseInt(data.maxProjects) : null,
        features: data.features
          .split("\n")
          .map((f) => f.trim())
          .filter(Boolean),
        sortOrder: parseInt(data.sortOrder) || 0,
        isActive: data.isActive,
      };
      const url = editingTier
        ? `/api/admin/subscription/tiers/${editingTier.id}`
        : "/api/admin/subscription/tiers";
      const method = editingTier ? "PATCH" : "POST";
      return apiRequest(method, url, payload).then((r) => r.json());
    },
    onSuccess: () => {
      refetchTiers();
      setTierDialogOpen(false);
      toast({ title: editingTier ? "Tier updated" : "Tier created" });
    },
    onError: (err: Error) =>
      toast({ title: "Error", description: parseErrorMessage(err), variant: "destructive" }),
  });

  const deleteTierMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("DELETE", `/api/admin/subscription/tiers/${id}`),
    onSuccess: () => {
      refetchTiers();
      toast({ title: "Tier deleted" });
    },
    onError: (err: Error) =>
      toast({ title: "Error", description: parseErrorMessage(err), variant: "destructive" }),
  });

  const updatePlatformSettingsMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiRequest("PATCH", "/api/admin/platform-settings", data).then((r) => r.json()),
    onSuccess: () => {
      refetchPlatformSettings();
      toast({ title: "Settings saved" });
    },
    onError: (err: Error) =>
      toast({ title: "Error", description: parseErrorMessage(err), variant: "destructive" }),
  });

  const openTierCreate = () => {
    setEditingTier(null);
    setTierForm({ name: "", price: "0", maxProjects: "", features: "", sortOrder: "0", isActive: true });
    setTierDialogOpen(true);
  };

  const openTierEdit = (tier: SubscriptionTier) => {
    setEditingTier(tier);
    setTierForm({
      name: tier.name,
      price: tier.price || "0",
      maxProjects: tier.maxProjects ? String(tier.maxProjects) : "",
      features: (tier.features || []).join("\n"),
      sortOrder: String(tier.sortOrder || 0),
      isActive: tier.isActive !== false,
    });
    setTierDialogOpen(true);
  };

  return (
    <SuperAdminLayout>
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center gap-2">
          <Receipt className="w-5 h-5 text-emerald-600" />
          <h1 className="text-2xl font-bold text-foreground">Pricing & Access Settings</h1>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Wrench className="w-4 h-4 text-muted-foreground" />
              Global Defaults
            </CardTitle>
            <CardDescription className="text-xs">
              Platform-wide defaults applied to new company signups.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="space-y-1.5">
                <Label htmlFor="setting-trial-days" className="text-xs">
                  Default Trial Length (days)
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="setting-trial-days"
                    type="number"
                    min={1}
                    max={365}
                    defaultValue={platformSettingsData?.defaultTrialDays ?? 7}
                    className="h-8 text-sm w-20"
                    onBlur={(e) =>
                      updatePlatformSettingsMutation.mutate({
                        defaultTrialDays: parseInt(e.target.value) || 7,
                      })
                    }
                    data-testid="input-setting-trial-days"
                  />
                  <span className="text-xs text-muted-foreground">days</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="setting-default-price" className="text-xs">
                  Default Monthly Price ($)
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="setting-default-price"
                    type="number"
                    min={0}
                    step="0.01"
                    defaultValue={platformSettingsData?.defaultMonthlyPrice ?? "0"}
                    className="h-8 text-sm w-24"
                    onBlur={(e) =>
                      updatePlatformSettingsMutation.mutate({
                        defaultMonthlyPrice: e.target.value || "0",
                      })
                    }
                    data-testid="input-setting-default-price"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <Label className="text-xs">Access Options</Label>
                <div className="flex items-center gap-2">
                  <Switch
                    id="setting-free-access"
                    checked={platformSettingsData?.freeAccessEnabled ?? false}
                    onCheckedChange={(v) =>
                      updatePlatformSettingsMutation.mutate({ freeAccessEnabled: v })
                    }
                    data-testid="switch-setting-free-access"
                  />
                  <Label
                    htmlFor="setting-free-access"
                    className="text-xs font-normal cursor-pointer"
                  >
                    Free Access Enabled
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="setting-prepaid-access"
                    checked={platformSettingsData?.prepaidAccessEnabled ?? false}
                    onCheckedChange={(v) =>
                      updatePlatformSettingsMutation.mutate({ prepaidAccessEnabled: v })
                    }
                    data-testid="switch-setting-prepaid-access"
                  />
                  <Label
                    htmlFor="setting-prepaid-access"
                    className="text-xs font-normal cursor-pointer"
                  >
                    Prepaid Access Enabled
                  </Label>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <Label className="text-xs">Billing Mode</Label>
                <div className="flex items-center gap-2">
                  <Switch
                    id="setting-manual-billing"
                    checked={platformSettingsData?.manualBillingEnabled ?? true}
                    onCheckedChange={(v) =>
                      updatePlatformSettingsMutation.mutate({ manualBillingEnabled: v })
                    }
                    data-testid="switch-setting-manual-billing"
                  />
                  <Label
                    htmlFor="setting-manual-billing"
                    className="text-xs font-normal cursor-pointer"
                  >
                    Manual Billing
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  When on, billing is managed by admins. Turn off to enable self-serve.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-base font-semibold text-foreground">Plan Tiers</p>
            <Button size="sm" onClick={openTierCreate} data-testid="button-add-tier">
              <Plus className="w-4 h-4 mr-1" /> Add Tier
            </Button>
          </div>

          {adminTiers.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                No plan tiers defined. Add tiers to show plans to company users.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {adminTiers.map((tier) => {
                const price = parseFloat(tier.price);
                return (
                  <Card
                    key={tier.id}
                    className={!tier.isActive ? "opacity-60" : ""}
                    data-testid={`tier-card-${tier.id}`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{tier.name}</CardTitle>
                        <div className="flex items-center gap-1">
                          {!tier.isActive && (
                            <Badge variant="secondary" className="text-xs">
                              Inactive
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-7 h-7"
                            onClick={() => openTierEdit(tier)}
                            data-testid={`button-edit-tier-${tier.id}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-7 h-7 text-destructive hover:text-destructive"
                            onClick={() => deleteTierMutation.mutate(tier.id)}
                            disabled={deleteTierMutation.isPending}
                            data-testid={`button-delete-tier-${tier.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-2xl font-bold">
                        {price === 0
                          ? "Free"
                          : `$${price % 1 === 0 ? price.toFixed(0) : price.toFixed(2)}/mo`}
                      </p>
                    </CardHeader>
                    <CardContent>
                      {tier.maxProjects && (
                        <p className="text-xs text-muted-foreground mb-2">
                          Up to {tier.maxProjects} projects
                        </p>
                      )}
                      <ul className="space-y-1">
                        {(tier.features || []).map((f: string) => (
                          <li
                            key={f}
                            className="flex items-center gap-1.5 text-sm text-muted-foreground"
                          >
                            <CheckCircle className="w-3 h-3 text-green-500 shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Dialog open={tierDialogOpen} onOpenChange={setTierDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingTier ? "Edit Subscription Tier" : "Create Subscription Tier"}
            </DialogTitle>
            <DialogDescription>
              Define a subscription plan with pricing and features.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="tier-name">Plan Name</Label>
              <Input
                id="tier-name"
                value={tierForm.name}
                onChange={(e) => setTierForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Starter"
                data-testid="input-tier-name"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tier-price">Monthly Price ($)</Label>
                <Input
                  id="tier-price"
                  type="number"
                  min="0"
                  value={tierForm.price}
                  onChange={(e) => setTierForm((f) => ({ ...f, price: e.target.value }))}
                  placeholder="49"
                  data-testid="input-tier-price"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tier-maxprojects">Max Projects</Label>
                <Input
                  id="tier-maxprojects"
                  type="number"
                  min="1"
                  value={tierForm.maxProjects}
                  onChange={(e) => setTierForm((f) => ({ ...f, maxProjects: e.target.value }))}
                  placeholder="Unlimited"
                  data-testid="input-tier-maxprojects"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tier-features">Features (one per line)</Label>
              <textarea
                id="tier-features"
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                value={tierForm.features}
                onChange={(e) => setTierForm((f) => ({ ...f, features: e.target.value }))}
                placeholder={"Unlimited projects\nPriority support\nTeam members"}
                data-testid="input-tier-features"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="tier-active">Active (visible to companies)</Label>
              <Switch
                id="tier-active"
                checked={tierForm.isActive}
                onCheckedChange={(v) => setTierForm((f) => ({ ...f, isActive: v }))}
                data-testid="switch-tier-active"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTierDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => saveTierMutation.mutate(tierForm)}
              disabled={!tierForm.name.trim() || saveTierMutation.isPending}
              data-testid="button-save-tier"
            >
              {saveTierMutation.isPending
                ? "Saving…"
                : editingTier
                ? "Save Changes"
                : "Create Tier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SuperAdminLayout>
  );
}
