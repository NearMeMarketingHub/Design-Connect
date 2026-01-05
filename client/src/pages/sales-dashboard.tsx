import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, FileText, ArrowUpRight, TrendingUp, DollarSign } from "lucide-react";
import { Link } from "wouter";

export default function SalesDashboard() {
  const quotes = [
    { id: "EST-1024", client: "Sarah Jenkins", project: "Jenkins Residence", amount: "$145,000", status: "Approved", date: "Dec 10, 2025" },
    { id: "EST-1025", client: "Mike Miller", project: "Miller Kitchen", amount: "$65,000", status: "Draft", date: "Dec 11, 2025" },
    { id: "EST-1026", client: "West Lake Dev", project: "West Lake Build", amount: "$850,000", status: "Sent", date: "Dec 09, 2025" },
    { id: "EST-1027", client: "Downtown Corp", project: "Office Reno", amount: "$120,000", status: "Draft", date: "Dec 08, 2025" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Sales Dashboard</h1>
          <p className="text-muted-foreground mt-1">Manage quotes, estimates, and pipeline.</p>
        </div>
        <Link href="/admin/estimates">
          <Button className="bg-primary text-primary-foreground">
            <Plus className="w-4 h-4 mr-2" />
            Create Quote
          </Button>
        </Link>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Pipeline Value</p>
              <h3 className="text-3xl font-bold mt-2">$2.4M</h3>
            </div>
            <div className="h-12 w-12 bg-green-500/10 rounded-full flex items-center justify-center text-green-600">
              <TrendingUp className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Open Quotes</p>
              <h3 className="text-3xl font-bold mt-2">14</h3>
            </div>
            <div className="h-12 w-12 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-600">
              <FileText className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Conversion Rate</p>
              <h3 className="text-3xl font-bold mt-2">42%</h3>
            </div>
            <div className="h-12 w-12 bg-orange-500/10 rounded-full flex items-center justify-center text-orange-600">
              <ArrowUpRight className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Quotes</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search quotes..." className="pl-8" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quote ID</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.map((quote) => (
                <TableRow key={quote.id}>
                  <TableCell className="font-medium">{quote.id}</TableCell>
                  <TableCell>{quote.client}</TableCell>
                  <TableCell>{quote.project}</TableCell>
                  <TableCell>{quote.date}</TableCell>
                  <TableCell>{quote.amount}</TableCell>
                  <TableCell>
                    <Badge variant={
                      quote.status === "Approved" ? "default" : 
                      quote.status === "Sent" ? "secondary" : 
                      "outline"
                    }>
                      {quote.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">View</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}