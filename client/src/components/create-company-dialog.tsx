import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest, parseErrorMessage } from "@/lib/queryClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface SubscriptionTier {
  id: string;
  name: string;
  price: string;
  isActive: boolean;
}

interface CreateCompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  adminTiers: SubscriptionTier[];
  prefill?: { companyName?: string; ownerName?: string; ownerEmail?: string } | null;
  leadId?: string | null;
}

const EMPTY_FORM = {
  companyName: "",
  ownerName: "",
  ownerEmail: "",
  ownerUsername: "",
  password: "",
  companyType: "",
  subscriptionStatus: "trialing",
  billingType: "manual",
  monthlyPrice: "",
  trialStartedAt: "",
};

export function CreateCompanyDialog({
  open,
  onOpenChange,
  adminTiers,
  prefill,
  leadId,
}: CreateCompanyDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (open) {
      setForm({
        ...EMPTY_FORM,
        companyName: prefill?.companyName || "",
        ownerName: prefill?.ownerName || "",
        ownerEmail: prefill?.ownerEmail || "",
      });
    }
  }, [open, prefill?.companyName, prefill?.ownerName, prefill?.ownerEmail]);

  const handleClose = () => {
    onOpenChange(false);
  };

  const createCompanyMutation = useMutation({
    mutationFn: (data: typeof form) =>
      apiRequest("POST", "/api/admin/companies", data).then((r) => r.json()),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies"] });
      handleClose();
      toast({
        title: "Company created",
        description: "The company and owner account have been created.",
      });
      if (leadId) {
        try {
          await apiRequest("PATCH", `/api/admin/demo-requests/${leadId}`, {
            status: "converted",
          });
          queryClient.invalidateQueries({ queryKey: ["/api/admin/demo-requests"] });
        } catch {
          toast({
            title: "Lead status not updated",
            description:
              "Company was created successfully, but the demo request could not be marked as converted. Please update it manually.",
            variant: "destructive",
          });
        }
      }
    },
    onError: (err: Error) =>
      toast({ title: "Error", description: parseErrorMessage(err), variant: "destructive" }),
  });

  const set = (field: keyof typeof EMPTY_FORM, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Company</DialogTitle>
          <DialogDescription>
            {leadId
              ? "Convert this lead into a company account. The owner will receive login credentials."
              : "Create a new company and its owner account."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="cc-company-name">Company Name</Label>
            <Input
              id="cc-company-name"
              value={form.companyName}
              onChange={(e) => set("companyName", e.target.value)}
              placeholder="Acme Construction"
              data-testid="input-create-company-name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cc-company-type">
              Company Type{" "}
              <span className="text-muted-foreground text-xs">(optional)</span>
            </Label>
            <Input
              id="cc-company-type"
              value={form.companyType}
              onChange={(e) => set("companyType", e.target.value)}
              placeholder="General Contractor"
              data-testid="input-create-company-type"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Access Status</Label>
              <Select
                value={form.subscriptionStatus}
                onValueChange={(v) => set("subscriptionStatus", v)}
              >
                <SelectTrigger data-testid="select-create-company-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trialing">Trialing</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="prepaid">Prepaid</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Billing Type</Label>
              <Select
                value={form.billingType}
                onValueChange={(v) => set("billingType", v)}
              >
                <SelectTrigger data-testid="select-create-company-billing-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="prepaid">Prepaid</SelectItem>
                  <SelectItem value="future_in_app">Future In-App</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cc-monthly-price">
                Monthly Price{" "}
                <span className="text-muted-foreground text-xs">(optional)</span>
              </Label>
              <Input
                id="cc-monthly-price"
                type="number"
                min="0"
                step="0.01"
                value={form.monthlyPrice}
                onChange={(e) => set("monthlyPrice", e.target.value)}
                placeholder="0.00"
                data-testid="input-create-company-monthly-price"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cc-trial-start">
                Trial Start{" "}
                <span className="text-muted-foreground text-xs">(optional)</span>
              </Label>
              <Input
                id="cc-trial-start"
                type="date"
                value={form.trialStartedAt}
                onChange={(e) => set("trialStartedAt", e.target.value)}
                data-testid="input-create-company-trial-start"
              />
            </div>
          </div>
          <div className="border-t pt-3 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Owner Account
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="cc-owner-name">Owner Name</Label>
              <Input
                id="cc-owner-name"
                value={form.ownerName}
                onChange={(e) => set("ownerName", e.target.value)}
                placeholder="Jane Smith"
                data-testid="input-create-owner-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cc-owner-email">Owner Email</Label>
              <Input
                id="cc-owner-email"
                type="email"
                value={form.ownerEmail}
                onChange={(e) => set("ownerEmail", e.target.value)}
                placeholder="jane@acme.com"
                data-testid="input-create-owner-email"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cc-owner-username">Username</Label>
              <Input
                id="cc-owner-username"
                value={form.ownerUsername}
                onChange={(e) => set("ownerUsername", e.target.value)}
                placeholder="janesmith"
                data-testid="input-create-owner-username"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cc-password">Password</Label>
              <Input
                id="cc-password"
                type="password"
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                placeholder="Temporary password"
                data-testid="input-create-owner-password"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={() => createCompanyMutation.mutate(form)}
            disabled={
              !form.companyName.trim() ||
              !form.ownerUsername.trim() ||
              !form.password.trim() ||
              createCompanyMutation.isPending
            }
            data-testid="button-confirm-create-company"
          >
            {createCompanyMutation.isPending ? "Creating…" : "Create Company"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
