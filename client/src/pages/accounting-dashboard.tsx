import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Download, MoreHorizontal, RefreshCw } from "lucide-react";
import { Link } from "wouter";

export default function AccountingDashboard() {
  const invoices = [
    { id: "INV-2024-001", client: "Sarah Jenkins", project: "Jenkins Residence", amount: "$45,000", due: "Dec 15, 2025", status: "Unpaid", type: "Standard" },
    { id: "INV-2024-002", client: "West Lake Dev", project: "West Lake Build", amount: "$12,500", due: "Dec 20, 2025", status: "Paid", type: "Recurring" },
    { id: "INV-2024-003", client: "Downtown Corp", project: "Office Reno", amount: "$8,200", due: "Dec 22, 2025", status: "Overdue", type: "Standard" },
  ];

  const recurring = [
    { id: "REC-101", client: "West Lake Dev", project: "West Lake Build", amount: "$12,500", frequency: "Monthly", next: "Jan 01, 2026", status: "Active" },
    { id: "REC-102", client: "City Properties", project: "Maintenance", amount: "$2,500", frequency: "Monthly", next: "Jan 05, 2026", status: "Active" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Accounting</h1>
          <p className="text-muted-foreground mt-1">Manage invoices, payments, and recurring billing.</p>
        </div>
        <Link href="/contractor/invoice/new">
          <Button className="bg-primary text-primary-foreground">
            <Plus className="w-4 h-4 mr-2" />
            New Invoice
          </Button>
        </Link>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <Card className="bg-muted/50 border-none">
          <CardContent className="p-6">
            <p className="text-sm font-medium text-muted-foreground">Outstanding</p>
            <h3 className="text-2xl font-bold mt-2">$53,200</h3>
          </CardContent>
        </Card>
        <Card className="bg-muted/50 border-none">
          <CardContent className="p-6">
            <p className="text-sm font-medium text-muted-foreground">Overdue</p>
            <h3 className="text-2xl font-bold mt-2 text-destructive">$8,200</h3>
          </CardContent>
        </Card>
        <Card className="bg-muted/50 border-none">
          <CardContent className="p-6">
            <p className="text-sm font-medium text-muted-foreground">Paid (This Month)</p>
            <h3 className="text-2xl font-bold mt-2 text-green-600">$128,500</h3>
          </CardContent>
        </Card>
        <Card className="bg-muted/50 border-none">
          <CardContent className="p-6">
            <p className="text-sm font-medium text-muted-foreground">Recurring Monthly</p>
            <h3 className="text-2xl font-bold mt-2">$15,000</h3>
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
                    <Input placeholder="Search invoices..." className="pl-8" />
                  </div>
                  <Button variant="outline" size="icon">
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
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
                  {invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.id}</TableCell>
                      <TableCell>{inv.client}</TableCell>
                      <TableCell>{inv.project}</TableCell>
                      <TableCell>{inv.due}</TableCell>
                      <TableCell>{inv.amount}</TableCell>
                      <TableCell>
                        <Badge variant={
                          inv.status === "Paid" ? "secondary" : 
                          inv.status === "Overdue" ? "destructive" : 
                          "outline"
                        }>
                          {inv.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
                    <TableRow key={rec.id}>
                      <TableCell className="font-medium">{rec.id}</TableCell>
                      <TableCell>{rec.client}</TableCell>
                      <TableCell>{rec.project}</TableCell>
                      <TableCell>{rec.frequency}</TableCell>
                      <TableCell>{rec.next}</TableCell>
                      <TableCell>{rec.amount}</TableCell>
                      <TableCell>
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-200 border-none">
                          {rec.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}