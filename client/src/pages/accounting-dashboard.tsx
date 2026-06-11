import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Download, MoreHorizontal, RefreshCw, Receipt, Loader2, ArrowLeft } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import type { Invoice, RecurringBilling } from "@shared/schema";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

function formatCurrency(value: string | number | null | undefined) {
  const num = parseFloat(String(value ?? "0"));
  if (isNaN(num)) return "$0";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(num);
}

function invoiceStatusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  const s = status.toLowerCase();
  if (s === "paid") return "secondary";
  if (s === "overdue") return "destructive";
  return "outline";
}

export default function AccountingDashboard() {
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [, setLocation] = useLocation();

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
    queryFn: () => apiRequest("GET", "/api/invoices").then((r) => r.json()),
  });

  const { data: recurring = [], isLoading: recurringLoading } = useQuery<RecurringBilling[]>({
    queryKey: ["/api/recurring-billing"],
    queryFn: () => apiRequest("GET", "/api/recurring-billing").then((r) => r.json()),
  });

  const outstanding = invoices
    .filter((inv) => inv.status.toLowerCase() === "unpaid")
    .reduce((sum, inv) => sum + parseFloat(inv.amount ?? "0"), 0);

  const overdue = invoices
    .filter((inv) => inv.status.toLowerCase() === "overdue")
    .reduce((sum, inv) => sum + parseFloat(inv.amount ?? "0"), 0);

  const paid = invoices
    .filter((inv) => inv.status.toLowerCase() === "paid")
    .reduce((sum, inv) => sum + parseFloat(inv.amount ?? "0"), 0);

  const recurringMonthly = recurring
    .filter((r) => r.status.toLowerCase() === "active")
    .reduce((sum, r) => sum + parseFloat(r.amount ?? "0"), 0);

  const filteredInvoices = invoices.filter((inv) => {
    if (!invoiceSearch) return true;
    const q = invoiceSearch.toLowerCase();
    return (
      inv.customId.toLowerCase().includes(q) ||
      inv.clientName.toLowerCase().includes(q) ||
      inv.projectName.toLowerCase().includes(q)
    );
  });

  const isLoading = invoicesLoading || recurringLoading;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/company/financials">
            <Button variant="ghost" size="sm" className="gap-1.5" data-testid="button-back-financials">
              <ArrowLeft className="w-4 h-4" />
              Back to Financials
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-heading font-bold text-foreground">Accounting</h1>
            <p className="text-muted-foreground mt-1">Manage invoices, payments, and recurring billing.</p>
          </div>
        </div>
        <Link href="/company/invoice/new">
          <Button className="bg-primary text-primary-foreground" data-testid="button-new-invoice">
            <Plus className="w-4 h-4 mr-2" />
            New Invoice
          </Button>
        </Link>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <Card className="bg-muted/50 border-none">
          <CardContent className="p-6">
            <p className="text-sm font-medium text-muted-foreground">Outstanding</p>
            <h3 className="text-2xl font-bold mt-2" data-testid="text-outstanding">
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : formatCurrency(outstanding)}
            </h3>
          </CardContent>
        </Card>
        <Card className="bg-muted/50 border-none">
          <CardContent className="p-6">
            <p className="text-sm font-medium text-muted-foreground">Overdue</p>
            <h3 className="text-2xl font-bold mt-2 text-destructive" data-testid="text-overdue">
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : formatCurrency(overdue)}
            </h3>
          </CardContent>
        </Card>
        <Card className="bg-muted/50 border-none">
          <CardContent className="p-6">
            <p className="text-sm font-medium text-muted-foreground">Total Paid</p>
            <h3 className="text-2xl font-bold mt-2 text-green-600" data-testid="text-paid">
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : formatCurrency(paid)}
            </h3>
          </CardContent>
        </Card>
        <Card className="bg-muted/50 border-none">
          <CardContent className="p-6">
            <p className="text-sm font-medium text-muted-foreground">Recurring Monthly</p>
            <h3 className="text-2xl font-bold mt-2" data-testid="text-recurring-monthly">
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : formatCurrency(recurringMonthly)}
            </h3>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="invoices" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="recurring">Recurring Invoices</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Invoice History</CardTitle>
                <div className="flex gap-2">
                  <div className="relative w-64">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search invoices..."
                      className="pl-8"
                      value={invoiceSearch}
                      onChange={(e) => setInvoiceSearch(e.target.value)}
                      data-testid="input-search-invoices"
                    />
                  </div>
                  <Button variant="outline" size="icon">
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {invoicesLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredInvoices.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground" data-testid="empty-invoices">
                  <Receipt className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No invoices yet</p>
                  <p className="text-sm mt-1">Create your first invoice to see it here.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map((inv) => (
                      <TableRow key={inv.id} data-testid={`row-invoice-${inv.id}`}>
                        <TableCell className="font-medium">{inv.customId}</TableCell>
                        <TableCell>{inv.clientName}</TableCell>
                        <TableCell>{inv.projectName}</TableCell>
                        <TableCell>{inv.dueDate}</TableCell>
                        <TableCell>{formatCurrency(inv.amount)}</TableCell>
                        <TableCell>
                          <Badge variant={invoiceStatusVariant(inv.status)}>
                            {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" data-testid={`button-invoice-actions-${inv.id}`}>
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => setLocation(`/company/invoices/${inv.id}`)}
                                data-testid={`menuitem-view-invoice-${inv.id}`}
                              >
                                View Invoice
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recurring">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recurring Profiles</CardTitle>
                <Button variant="outline" size="sm">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  New Recurring
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {recurringLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : recurring.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground" data-testid="empty-recurring">
                  <RefreshCw className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No recurring profiles</p>
                  <p className="text-sm mt-1">Set up recurring billing to automate repeat invoices.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Profile ID</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Frequency</TableHead>
                      <TableHead>Next Run</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recurring.map((rec) => (
                      <TableRow key={rec.id} data-testid={`row-recurring-${rec.id}`}>
                        <TableCell className="font-medium">{rec.customId}</TableCell>
                        <TableCell>{rec.clientName}</TableCell>
                        <TableCell>{rec.projectName}</TableCell>
                        <TableCell>{rec.frequency}</TableCell>
                        <TableCell>{rec.nextRunDate}</TableCell>
                        <TableCell>{formatCurrency(rec.amount)}</TableCell>
                        <TableCell>
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-200 border-none">
                            {rec.status.charAt(0).toUpperCase() + rec.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" data-testid={`button-recurring-actions-${rec.id}`}>
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
