import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, Trash2, Save, FileText } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

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

export default function CreateInvoice() {
  const [items, setItems] = useState<LineItem[]>([]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [nextId, setNextId] = useState(1);

  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    queryFn: () => apiRequest("GET", "/api/projects").then((r) => r.json()),
  });

  const total = items.reduce((sum, item) => sum + item.amount, 0);

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

  const clientOptions = projects
    .filter((p) => p.clientName)
    .reduce<{ clientId: string; clientName: string }[]>((acc, p) => {
      const id = p.clientId ?? p.id;
      if (!acc.find((c) => c.clientId === id)) {
        acc.push({ clientId: id, clientName: p.clientName! });
      }
      return acc;
    }, []);

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
          <p className="text-muted-foreground">Create a standard or recurring invoice.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Invoice Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Project</Label>
                  <Select data-testid="select-invoice-project">
                    <SelectTrigger>
                      <SelectValue placeholder={projectsLoading ? "Loading…" : "Select project"} />
                    </SelectTrigger>
                    <SelectContent>
                      {!projectsLoading && projects.length === 0 && (
                        <div className="px-3 py-2 text-sm text-muted-foreground">No projects found</div>
                      )}
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id} data-testid={`option-project-${p.id}`}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Client</Label>
                  <Select data-testid="select-invoice-client">
                    <SelectTrigger>
                      <SelectValue placeholder={projectsLoading ? "Loading…" : "Select client"} />
                    </SelectTrigger>
                    <SelectContent>
                      {!projectsLoading && clientOptions.length === 0 && (
                        <div className="px-3 py-2 text-sm text-muted-foreground">No clients found</div>
                      )}
                      {clientOptions.map((c) => (
                        <SelectItem key={c.clientId} value={c.clientId} data-testid={`option-client-${c.clientId}`}>
                          {c.clientName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Invoice Date</Label>
                  <Input type="date" data-testid="input-invoice-date" />
                </div>
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Input type="date" data-testid="input-invoice-due-date" />
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
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2" data-testid="empty-state-line-items">
                  <FileText className="w-8 h-8 opacity-40" />
                  <p className="text-sm">No line items yet. Click "Add Item" to get started.</p>
                </div>
              ) : (
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
                        <TableCell className="text-right font-medium">${item.amount.toFixed(2)}</TableCell>
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
              )}
              {items.length > 0 && (
                <div className="flex justify-end mt-4 pt-4 border-t border-border">
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Total Amount</p>
                    <h3 className="text-2xl font-bold" data-testid="text-invoice-total">
                      ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </h3>
                  </div>
                </div>
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
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Recurring Invoice</Label>
                  <p className="text-xs text-muted-foreground">Automatically bill on a schedule</p>
                </div>
                <Switch checked={isRecurring} onCheckedChange={setIsRecurring} data-testid="switch-recurring" />
              </div>

              {isRecurring && (
                <div className="space-y-4 pt-4 border-t border-border animate-in fade-in slide-in-from-top-2">
                  <div className="space-y-2">
                    <Label>Frequency</Label>
                    <Select defaultValue="monthly">
                      <SelectTrigger data-testid="select-frequency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>End Date (Optional)</Label>
                    <Input type="date" data-testid="input-recurring-end-date" />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Notes for Client</Label>
                <Textarea placeholder="Thank you for your business…" className="min-h-[100px]" data-testid="textarea-invoice-notes" />
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full" data-testid="button-create-invoice">
                <Save className="w-4 h-4 mr-2" />
                Create Invoice
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
