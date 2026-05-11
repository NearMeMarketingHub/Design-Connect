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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Receipt, Wrench } from "lucide-react";

export default function AdminPricingAccess() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: platformSettingsData, refetch: refetchPlatformSettings } = useQuery({
    queryKey: ["/api/admin/platform-settings"],
    queryFn: () => apiRequest("GET", "/api/admin/platform-settings").then((r) => r.json()),
    enabled: user?.role === "admin",
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
                    defaultValue={platformSettingsData?.defaultTrialLength ?? 7}
                    className="h-8 text-sm w-20"
                    onBlur={(e) =>
                      updatePlatformSettingsMutation.mutate({
                        defaultTrialLength: parseInt(e.target.value) || 7,
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

      </div>
    </SuperAdminLayout>
  );
}
