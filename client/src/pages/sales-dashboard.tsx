import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, FileText, ArrowUpRight, TrendingUp, Loader2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import type { Estimate } from "@shared/schema";

function formatCurrency(value: string | number | null | undefined) {
  const num = parseFloat(String(value ?? "0"));
  if (isNaN(num)) return "$0";
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
  return `$${num.toLocaleString()}`;
}

function statusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  const s = status.toLowerCase();
  if (s === "approved") return "default";
  if (s === "sent") return "secondary";
  if (s === "rejected") return "destructive";
  return "outline";
}

export default function SalesDashboard() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");

  const { data: estimates = [], isLoading } = useQuery<Estimate[]>({
    queryKey: ["/api/estimates"],
    queryFn: () => apiRequest("GET", "/api/estimates").then((r) => r.json()),
  });

  const filtered = estimates.filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      e.customId.toLowerCase().includes(q) ||
      e.clientName.toLowerCase().includes(q) ||
      e.projectName.toLowerCase().includes(q) ||
      e.status.toLowerCase().includes(q)
    );
  });

  const pipelineValue = estimates
    .filter((e) => e.status.toLowerCase() !== "rejected")
    .reduce((sum, e) => sum + parseFloat(e.amount ?? "0"), 0);

  const openQuotes = estimates.filter((e) => {
    const s = e.status.toLowerCase();
    return s === "draft" || s === "sent";
  }).length;

  const approved = estimates.filter((e) => e.status.toLowerCase() === "approved").length;
  const conversionRate = estimates.length > 0 ? Math.round((approved / estimates.length) * 100) : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Sales Dashboard</h1>
          <p className="text-muted-foreground mt-1">Manage quotes, estimates, and pipeline.</p>
        </div>
        <Link href="/company/estimates">
          <Button className="bg-primary text-primary-foreground" data-testid="button-create-quote">
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
              <h3 className="text-3xl font-bold mt-2" data-testid="text-pipeline-value">
                {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : formatCurrency(pipelineValue)}
              </h3>
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
              <h3 className="text-3xl font-bold mt-2" data-testid="text-open-quotes">
                {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : openQuotes}
              </h3>
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
              <h3 className="text-3xl font-bold mt-2" data-testid="text-conversion-rate">
                {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : `${conversionRate}%`}
              </h3>
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
              <Input
                placeholder="Search quotes..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-search-quotes"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground" data-testid="empty-quotes">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No quotes yet</p>
              <p className="text-sm mt-1">Create your first estimate to see it here.</p>
            </div>
          ) : (
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
                {filtered.map((quote) => (
                  <TableRow key={quote.id} data-testid={`row-quote-${quote.id}`}>
                    <TableCell className="font-medium">{quote.customId}</TableCell>
                    <TableCell>{quote.clientName}</TableCell>
                    <TableCell>{quote.projectName}</TableCell>
                    <TableCell>{quote.date}</TableCell>
                    <TableCell>{formatCurrency(quote.amount)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(quote.status)}>
                        {quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/company/estimates?load=${quote.id}`)}
                        data-testid={`button-view-quote-${quote.id}`}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
