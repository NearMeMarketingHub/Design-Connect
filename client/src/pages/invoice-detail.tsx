import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, parseErrorMessage } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Loader2, FileText, AlertCircle } from "lucide-react";
import type { Invoice, InvoiceLineItem, Company } from "@shared/schema";

type InvoiceWithLineItems = Invoice & { lineItems: InvoiceLineItem[] };

const BLOCKED_STATUSES = new Set(["suspended", "cancelled", "expired", "trialing", "past_due"]);

type EditableStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled";

const VALID_STATUSES: EditableStatus[] = ["draft", "sent", "paid", "overdue", "cancelled"];

function formatCurrency(value: string | number | null | undefined) {
  const num = parseFloat(String(value ?? "0"));
  if (isNaN(num)) return "$0.00";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(num);
}

function statusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  const s = status.toLowerCase();
  if (s === "paid") return "secondary";
  if (s === "overdue") return "destructive";
  return "outline";
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function InvoiceDetail() {
  const [, params] = useRoute("/company/invoices/:invoiceId");
  const invoiceId = params?.invoiceId ?? "";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: company } = useQuery<Company>({
    queryKey: ["/api/company/mine"],
    queryFn: () => apiRequest("GET", "/api/company/mine").then((r) => r.json()),
    enabled: user?.role === "company_owner" || user?.role === "contractor",
  });

  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<EditableStatus>("draft");
  const [dirty, setDirty] = useState(false);

  const { data: invoice, isLoading, error } = useQuery<InvoiceWithLineItems>({
    queryKey: [`/api/invoices/${invoiceId}`],
    queryFn: () => apiRequest("GET", `/api/invoices/${invoiceId}`).then((r) => r.json()),
    enabled: !!invoiceId,
  });

  useEffect(() => {
    if (invoice) {
      setDueDate(invoice.dueDate ?? "");
      const s = invoice.status as string;
      setStatus(VALID_STATUSES.includes(s as EditableStatus) ? (s as EditableStatus) : "draft");
      setDirty(false);
    }
  }, [invoice]);

  const companyActive = company ? !BLOCKED_STATUSES.has(company.subscriptionStatus ?? "") : true;
  const saveDisabled = !dirty || !companyActive;

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: () =>
      apiRequest("PATCH", `/api/invoices/${invoiceId}`, {
        dueDate: dueDate || undefined,
        status,
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${invoiceId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setDirty(false);
      toast({ title: "Invoice saved", description: "Changes have been saved successfully." });
    },
    onError: (err) => {
      toast({ title: "Save failed", description: parseErrorMessage(err), variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center">
        <AlertCircle className="w-10 h-10 mx-auto mb-3 text-destructive" />
        <p className="font-semibold text-lg">Invoice not found</p>
        <p className="text-muted-foreground text-sm mt-1">
          {error ? parseErrorMessage(error) : "This invoice doesn't exist or you don't have access."}
        </p>
        <Link href="/company/accounting">
          <Button variant="outline" className="mt-6" data-testid="button-back-error">
            Back to Accounting
          </Button>
        </Link>
      </div>
    );
  }

  const lineItems = invoice.lineItems ?? [];
  const lineItemTotal = lineItems.reduce(
    (sum, li) => sum + parseFloat(li.amount ?? "0"),
    0
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/company/accounting">
          <Button variant="ghost" size="icon" data-testid="button-back-to-accounting">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-heading font-bold truncate" data-testid="text-invoice-id">
              {invoice.customId}
            </h1>
            <Badge variant={statusVariant(invoice.status)} data-testid="badge-invoice-status">
              {capitalize(invoice.status)}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            {invoice.projectName} &mdash; {invoice.clientName}
          </p>
        </div>
        <Button
          onClick={() => save()}
          disabled={saveDisabled || saving}
          data-testid="button-save-invoice"
        >
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save Changes
        </Button>
      </div>

      {!companyActive && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive" data-testid="banner-company-inactive">
          Company access is not active. Changes cannot be saved until your subscription is restored.
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Invoice Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Client</p>
                  <p className="font-medium" data-testid="text-client-name">{invoice.clientName || "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Project</p>
                  <p className="font-medium" data-testid="text-project-name">{invoice.projectName || "—"}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Amount</p>
                  <p className="text-xl font-bold" data-testid="text-amount">{formatCurrency(invoice.amount)}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={dueDate}
                    onChange={(e) => { setDueDate(e.target.value); setDirty(true); }}
                    data-testid="input-due-date"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Line Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lineItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2" data-testid="empty-line-items">
                  <FileText className="w-8 h-8 opacity-30" />
                  <p className="text-sm">No line items on this invoice.</p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead className="w-[80px] text-right">Qty</TableHead>
                        <TableHead className="w-[110px] text-right">Rate</TableHead>
                        <TableHead className="w-[120px] text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lineItems.map((li) => (
                        <TableRow key={li.id} data-testid={`row-line-item-${li.id}`}>
                          <TableCell>{li.description}</TableCell>
                          <TableCell className="text-right">{li.quantity}</TableCell>
                          <TableCell className="text-right">{formatCurrency(li.rate)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(li.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <Separator className="my-3" />
                  <div className="flex justify-end">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Line Items Total</p>
                      <p className="text-xl font-bold" data-testid="text-line-items-total">
                        {formatCurrency(lineItemTotal)}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Edit Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Invoice Status</Label>
                <Select
                  value={status}
                  onValueChange={(v) => { setStatus(v as EditableStatus); setDirty(true); }}
                >
                  <SelectTrigger data-testid="select-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VALID_STATUSES.map((s) => (
                      <SelectItem key={s} value={s} data-testid={`option-status-${s}`}>
                        {capitalize(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Invoice #</span>
                <span className="font-medium" data-testid="summary-custom-id">{invoice.customId}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium capitalize" data-testid="summary-type">{invoice.type ?? "—"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Due Date</span>
                <span className="font-medium" data-testid="summary-due-date">{invoice.dueDate ?? "—"}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="font-semibold">Total</span>
                <span className="font-bold text-lg" data-testid="summary-total">{formatCurrency(invoice.amount)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
