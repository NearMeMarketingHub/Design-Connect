import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Plus, Trash2, Save, FileText, AlertCircle } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, parseErrorMessage } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";

const BLOCKED_STATUSES = new Set(["suspended", "cancelled", "expired", "trialing", "past_due"]);

interface Project {
  id: string;
  name: string;
  clientId: string | null;
  clientName: string | null;
}

interface LineItem {
  id: number;
  desc: string;
  qty: number;
  rate: number;
  amount: number;
}

function generateCustomId() {
  const d = new Date();
  const yyyymmdd = d.toISOString().slice(0, 10).replace(/-/g, "");
  const hex = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, "0");
  return `INV-${yyyymmdd}-${hex}`;
}

export default function CreateInvoice() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);
  const [nextId, setNextId] = useState(1);

  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    queryFn: () => apiRequest("GET", "/api/projects").then((r) => r.json()),
  });

  const { data: company } = useQuery({
    queryKey: ["/api/company/mine"],
    queryFn: () => apiRequest("GET", "/api/company/mine").then((r) => r.json()),
    enabled: user?.role === "company_owner" || user?.isCompanyAdmin === true,
  });

  const isBlocked = company ? BLOCKED_STATUSES.has(company.subscriptionStatus ?? "") : false;

  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const clientName = selectedProject?.clientName ?? "";
  const projectName = selectedProject?.name ?? "";
  const total = items.reduce((sum, item) => sum + item.amount, 0);

  const lineItemsValid =
    items.length > 0 && items.every((i) => i.desc.trim() && i.qty > 0 && i.rate >= 0);
  const hasInvalidItems = items.length > 0 && !lineItemsValid;
  const canSubmit = !!selectedProjectId && !!dueDate && lineItemsValid && !isBlocked;

  const addItem = () => {
    setItems((prev) => [...prev, { id: nextId, desc: "", qty: 1, rate: 0, amount: 0 }]);
    setNextId((n) => n + 1);
  };

  const removeItem = (id: number) => setItems((prev) => prev.filter((i) => i.id !== id));

  const updateItem = (id: number, field: "desc" | "qty" | "rate", value: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: field === "desc" ? value : parseFloat(value) || 0 };
        updated.amount = updated.qty * updated.rate;
        return updated;
      })
    );
  };

  const createInvoiceMutation = useMutation({
    mutationFn: (payload: object) =>
      apiRequest("POST", "/api/invoices", payload).then((r) => r.json()),
    onSuccess: (invoice) => {
      toast({ title: "Invoice created" });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setLocation(`/company/invoices/${invoice.id}`);
    },
    onError: (err: Error) =>
      toast({ title: "Error", description: parseErrorMessage(err), variant: "destructive" }),
  });

  const handleCreate = () => {
    if (!canSubmit || createInvoiceMutation.isPending) return;
    createInvoiceMutation.mutate({
      customId: generateCustomId(),
      projectId: selectedProjectId,
      clientName,
      projectName,
      amount: total.toFixed(2),
      dueDate,
      status: "draft",
      type: "standard",
      lineItems: items.map((i) => ({
        description: i.desc,
        quantity: i.qty,
        rate: i.rate.toFixed(2),
        amount: i.amount.toFixed(2),
      })),
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/company/accounting">
          <Button variant="ghost" size="icon" data-testid="button-back-to-accounting">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-heading font-bold">New Invoice</h1>
          <p className="text-muted-foreground">Create a standard invoice for a project.</p>
        </div>
      </div>

      {isBlocked && (
        <Alert variant="destructive" data-testid="alert-company-blocked">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Company access is not active. Please contact support to update your Billing &amp; Access status.
          </AlertDescription>
        </Alert>
      )}

      {!projectsLoading && projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <FileText className="w-10 h-10 text-muted-foreground opacity-40" />
            <p className="text-lg font-medium text-slate-700" data-testid="text-no-projects">
              No projects yet — create a project first.
            </p>
            <p className="text-sm text-muted-foreground">
              Invoices must be linked to a project.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Invoice Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Project <span className="text-red-500">*</span></Label>
                    <Select
                      value={selectedProjectId}
                      onValueChange={setSelectedProjectId}
                      data-testid="select-invoice-project"
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={projectsLoading ? "Loading…" : "Select project"} />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id} data-testid={`option-project-${p.id}`}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!selectedProjectId && (
                      <p className="text-xs text-muted-foreground" data-testid="hint-select-project">
                        Select a project before creating an invoice.
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Client</Label>
                    <div
                      className="flex h-10 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground"
                      data-testid="display-client-name"
                    >
                      {clientName || (selectedProjectId ? "No client linked" : "—")}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Invoice Date</Label>
                    <Input type="date" data-testid="input-invoice-date" />
                  </div>
                  <div className="space-y-2">
                    <Label>Due Date <span className="text-red-500">*</span></Label>
                    <Input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      data-testid="input-invoice-due-date"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Line Items</CardTitle>
                <Button size="sm" variant="outline" onClick={addItem} data-testid="button-add-line-item">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              </CardHeader>
              <CardContent>
                {items.length === 0 ? (
                  <div
                    className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2"
                    data-testid="empty-state-line-items"
                  >
                    <FileText className="w-8 h-8 opacity-40" />
                    <p className="text-sm">No line items yet. Click "Add Item" to get started.</p>
                    <p className="text-xs text-amber-600" data-testid="hint-add-line-item">
                      Add at least one line item before creating an invoice.
                    </p>
                  </div>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Description</TableHead>
                          <TableHead className="w-[80px]">Qty</TableHead>
                          <TableHead className="w-[100px]">Rate</TableHead>
                          <TableHead className="w-[100px] text-right">Amount</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item) => (
                          <TableRow key={item.id} data-testid={`row-line-item-${item.id}`}>
                            <TableCell>
                              <Input
                                value={item.desc}
                                onChange={(e) => updateItem(item.id, "desc", e.target.value)}
                                placeholder="Description"
                                className="border-none shadow-none focus-visible:ring-0 h-auto p-0"
                                data-testid={`input-item-desc-${item.id}`}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={item.qty}
                                type="number"
                                min="0"
                                onChange={(e) => updateItem(item.id, "qty", e.target.value)}
                                className="border-none shadow-none focus-visible:ring-0 h-auto p-0"
                                data-testid={`input-item-qty-${item.id}`}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={item.rate}
                                type="number"
                                min="0"
                                step="0.01"
                                onChange={(e) => updateItem(item.id, "rate", e.target.value)}
                                className="border-none shadow-none focus-visible:ring-0 h-auto p-0"
                                data-testid={`input-item-rate-${item.id}`}
                              />
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              ${item.amount.toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => removeItem(item.id)}
                                data-testid={`button-remove-item-${item.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {hasInvalidItems && (
                      <p className="text-xs text-amber-600 mt-2" data-testid="hint-invalid-items">
                        Line items need a description and valid quantity/rate.
                      </p>
                    )}

                    <div className="flex justify-end mt-4 pt-4 border-t border-border">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Total Amount</p>
                        <h3 className="text-2xl font-bold" data-testid="text-invoice-total">
                          ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </h3>
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
                <CardTitle>Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between opacity-50">
                  <div className="space-y-0.5">
                    <Label className="cursor-not-allowed">Recurring Invoice</Label>
                    <p className="text-xs text-muted-foreground">Recurring invoices coming later.</p>
                  </div>
                  <Switch disabled data-testid="switch-recurring" />
                </div>

                <div className="space-y-2">
                  <Label>Notes for Client</Label>
                  <Textarea
                    placeholder="Thank you for your business…"
                    className="min-h-[100px]"
                    data-testid="textarea-invoice-notes"
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  onClick={handleCreate}
                  disabled={!canSubmit || createInvoiceMutation.isPending}
                  data-testid="button-create-invoice"
                >
                  {createInvoiceMutation.isPending ? (
                    "Saving…"
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Create Invoice
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
