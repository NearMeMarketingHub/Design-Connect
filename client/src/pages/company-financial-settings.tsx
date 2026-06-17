import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { SlidersHorizontal, ArrowLeft, Save, Loader2, ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { CompanyFinancialSettings } from "@shared/schema";

// Each percentage field config: key, label, description
const PCT_FIELDS: { key: keyof PctFormState; label: string; description: string }[] = [
  {
    key: "defaultOverheadPct",
    label: "Default Overhead",
    description: "General operating costs not directly tied to a specific job (office, insurance, equipment, etc.)",
  },
  {
    key: "defaultMarkupPct",
    label: "Default Markup",
    description: "Overall markup applied to job cost to cover profit margin",
  },
  {
    key: "defaultLaborBurdenPct",
    label: "Default Labor Burden",
    description: "Additional cost on top of base wages (payroll taxes, benefits, workers' comp, etc.)",
  },
  {
    key: "defaultMaterialMarkupPct",
    label: "Default Material Markup",
    description: "Markup applied to material costs (handling, purchasing overhead, etc.)",
  },
  {
    key: "defaultSubcontractorMarkupPct",
    label: "Default Subcontractor Markup",
    description: "Markup applied to subcontractor invoices for management and overhead",
  },
  {
    key: "defaultEquipmentCostPct",
    label: "Default Equipment Cost",
    description: "Percentage added to jobs to account for equipment usage and depreciation",
  },
];

interface PctFormState {
  defaultOverheadPct: string;
  defaultMarkupPct: string;
  defaultLaborBurdenPct: string;
  defaultMaterialMarkupPct: string;
  defaultSubcontractorMarkupPct: string;
  defaultEquipmentCostPct: string;
}

const EMPTY_PCT_STATE: PctFormState = {
  defaultOverheadPct: "",
  defaultMarkupPct: "",
  defaultLaborBurdenPct: "",
  defaultMaterialMarkupPct: "",
  defaultSubcontractorMarkupPct: "",
  defaultEquipmentCostPct: "",
};

function settingsToForm(settings: CompanyFinancialSettings | null): PctFormState {
  if (!settings) return EMPTY_PCT_STATE;
  return {
    defaultOverheadPct:            settings.defaultOverheadPct            != null ? String(parseFloat(settings.defaultOverheadPct))            : "",
    defaultMarkupPct:              settings.defaultMarkupPct              != null ? String(parseFloat(settings.defaultMarkupPct))              : "",
    defaultLaborBurdenPct:         settings.defaultLaborBurdenPct         != null ? String(parseFloat(settings.defaultLaborBurdenPct))         : "",
    defaultMaterialMarkupPct:      settings.defaultMaterialMarkupPct      != null ? String(parseFloat(settings.defaultMaterialMarkupPct))      : "",
    defaultSubcontractorMarkupPct: settings.defaultSubcontractorMarkupPct != null ? String(parseFloat(settings.defaultSubcontractorMarkupPct)) : "",
    defaultEquipmentCostPct:       settings.defaultEquipmentCostPct       != null ? String(parseFloat(settings.defaultEquipmentCostPct))       : "",
  };
}

// Convert form state to PUT body.
// Blank / whitespace → null (never sent as 0).
// Percentages stored as whole numbers: "15" → 15, not 0.15.
function formToBody(pct: PctFormState, notes: string) {
  function toNullableNum(v: string): number | null {
    const trimmed = v.trim();
    if (trimmed === "") return null;
    const n = parseFloat(trimmed);
    return isNaN(n) ? null : n;
  }
  return {
    defaultOverheadPct:            toNullableNum(pct.defaultOverheadPct),
    defaultMarkupPct:              toNullableNum(pct.defaultMarkupPct),
    defaultLaborBurdenPct:         toNullableNum(pct.defaultLaborBurdenPct),
    defaultMaterialMarkupPct:      toNullableNum(pct.defaultMaterialMarkupPct),
    defaultSubcontractorMarkupPct: toNullableNum(pct.defaultSubcontractorMarkupPct),
    defaultEquipmentCostPct:       toNullableNum(pct.defaultEquipmentCostPct),
    overheadNotes: notes.trim() === "" ? null : notes.trim(),
  };
}

export default function CompanyFinancialSettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isOwnerOrAdmin =
    user?.role === "company_owner" ||
    (user?.role === "contractor" &&
      user?.isCompanyAdmin === true &&
      user?.contractorType !== "subcontractor" &&
      user?.contractorType !== "notary");

  const [pctState, setPctState] = useState<PctFormState>(EMPTY_PCT_STATE);
  const [notes, setNotes] = useState("");
  const [dirty, setDirty] = useState(false);

  const { data: settings, isLoading } = useQuery<CompanyFinancialSettings | null>({
    queryKey: ["/api/company/financial-settings"],
    queryFn: async () => {
      const res = await fetch("/api/company/financial-settings", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load financial settings");
      return res.json();
    },
    enabled: !!isOwnerOrAdmin,
  });

  useEffect(() => {
    if (settings !== undefined) {
      setPctState(settingsToForm(settings));
      setNotes(settings?.overheadNotes ?? "");
      setDirty(false);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = formToBody(pctState, notes);
      const res = await apiRequest("PUT", "/api/company/financial-settings", body);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message ?? "Failed to save settings");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company/financial-settings"] });
      setDirty(false);
      toast({ title: "Settings saved", description: "Financial settings have been updated." });
    },
    onError: (err: Error) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  function handlePctChange(key: keyof PctFormState, value: string) {
    setPctState((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  if (!isOwnerOrAdmin) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-5 h-5 text-blue-600" />
          <h1 className="text-2xl font-bold text-foreground">Financial Settings</h1>
        </div>
        <Card data-testid="card-access-denied">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <ShieldAlert className="w-10 h-10 text-destructive" />
            <p className="text-base font-medium text-foreground">Access denied</p>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Financial settings are restricted to company owners and administrators.
            </p>
            <Link href="/company/financials">
              <Button variant="outline" size="sm" className="mt-2" data-testid="button-back-denied">
                Back to Financials
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-5 h-5 text-blue-600" />
          <h1 className="text-2xl font-bold text-foreground">Financial Settings</h1>
        </div>
        <Link href="/company/financials">
          <Button variant="ghost" size="sm" className="gap-1.5" data-testid="button-back-financials">
            <ArrowLeft className="w-4 h-4" />
            Back to Financials
          </Button>
        </Link>
      </div>

      <p className="text-sm text-muted-foreground">
        Set your company's default financial percentages. These are stored for reference and will be used as
        starting defaults in estimating and budgeting tools in a future update. All values are whole numbers
        — enter <strong>15</strong> to mean <strong>15%</strong>, not 0.15.
      </p>

      <Card data-testid="card-financial-settings">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Default Percentages</CardTitle>
          <CardDescription className="text-xs">
            Enter whole-number percentages (e.g. 15 = 15%). Leave blank if not applicable to your business.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5" data-testid="settings-loading">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-3 w-48" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5" data-testid="settings-form">
              {PCT_FIELDS.map(({ key, label, description }) => (
                <div key={key} className="space-y-1.5">
                  <Label htmlFor={`field-${key}`} className="text-sm font-medium">
                    {label}
                  </Label>
                  <div className="relative">
                    <Input
                      id={`field-${key}`}
                      data-testid={`input-${key}`}
                      type="number"
                      min={0}
                      max={999.99}
                      step={0.01}
                      placeholder="—"
                      value={pctState[key]}
                      onChange={(e) => handlePctChange(key, e.target.value)}
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                      %
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-snug">{description}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-overhead-notes">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Overhead &amp; Margin Notes</CardTitle>
          <CardDescription className="text-xs">
            Optional: document your methodology, assumptions, or any context behind these defaults.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <Textarea
              id="overhead-notes"
              data-testid="textarea-overhead-notes"
              placeholder="e.g. Overhead is calculated as 15% of direct job costs, based on our annual G&A expenses divided by billable hours..."
              value={notes}
              onChange={(e) => { setNotes(e.target.value); setDirty(true); }}
              maxLength={2000}
              rows={4}
              className="resize-none"
            />
          )}
          {!isLoading && (
            <p className="text-xs text-muted-foreground mt-1.5 text-right">
              {notes.length} / 2000
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          data-testid="button-save-settings"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || isLoading}
        >
          {saveMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Settings
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
