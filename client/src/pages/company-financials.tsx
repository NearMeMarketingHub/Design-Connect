import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, FileText, Receipt, Plus, Activity, AlertCircle, User } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface FinancialActivityItem {
  id: string;
  action: string;
  label: string;
  actorName: string;
  entityType: string;
  entityName: string | null;
  projectId: string | null;
  projectName: string | null;
  amount: unknown;
  status: string | null;
  dueDate: string | null;
  createdAt: string;
}

const ACTION_COLORS: Record<string, string> = {
  estimate_created: "bg-emerald-100 text-emerald-700",
  invoice_created: "bg-cyan-100 text-cyan-700",
  invoice_updated: "bg-cyan-100 text-cyan-700",
};

function formatAmount(amount: unknown): string | null {
  if (amount === null || amount === undefined || amount === "") return null;
  const num = parseFloat(String(amount));
  if (isNaN(num)) return null;
  return `$${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatRelative(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function CompanyFinancials() {
  const { user } = useAuth();

  const isOwnerOrAdmin =
    user?.role === "company_owner" ||
    (user?.role === "contractor" &&
      user?.isCompanyAdmin === true &&
      user?.contractorType !== "subcontractor" &&
      user?.contractorType !== "notary");

  const {
    data: activity,
    isLoading,
    isError,
  } = useQuery<FinancialActivityItem[]>({
    queryKey: ["/api/company/financial-activity"],
    queryFn: async () => {
      const res = await fetch("/api/company/financial-activity", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    enabled: !!isOwnerOrAdmin,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-blue-600" />
        <h1 className="text-2xl font-bold text-foreground">Financial Management</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Manage your company's sales pipeline, estimates, accounting, and invoicing.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              Sales Dashboard
            </CardTitle>
            <CardDescription className="text-xs">Pipeline and revenue overview</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/company/sales">
              <Button className="w-full" variant="outline" size="sm" data-testid="button-company-sales">
                Open
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              Estimator
            </CardTitle>
            <CardDescription className="text-xs">Create and manage estimates</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/company/estimates">
              <Button className="w-full" variant="outline" size="sm" data-testid="button-company-estimates">
                Open
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Receipt className="w-4 h-4 text-purple-600" />
              Accounting
            </CardTitle>
            <CardDescription className="text-xs">Financial records and reporting</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/company/accounting">
              <Button className="w-full" variant="outline" size="sm" data-testid="button-company-accounting">
                Open
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Plus className="w-4 h-4 text-orange-600" />
              New Invoice
            </CardTitle>
            <CardDescription className="text-xs">Create a new client invoice</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/company/invoice/new">
              <Button className="w-full" variant="outline" size="sm" data-testid="button-company-new-invoice">
                Create
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {isOwnerOrAdmin && (
        <Card data-testid="card-financial-activity">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600" />
              Recent Financial Activity
            </CardTitle>
            <CardDescription className="text-xs">Latest estimate and invoice events for your company</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading && (
              <div className="space-y-3" data-testid="activity-loading">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Skeleton className="h-5 w-24 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-3 w-16" />
                  </div>
                ))}
              </div>
            )}

            {isError && (
              <div className="flex items-center gap-2 text-sm text-destructive py-4" data-testid="activity-error">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>Error loading activity. Please try again later.</span>
              </div>
            )}

            {!isLoading && !isError && activity?.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center" data-testid="activity-empty">
                No financial activity yet.
              </p>
            )}

            {!isLoading && !isError && activity && activity.length > 0 && (
              <div className="divide-y" data-testid="activity-list">
                {activity.map((item) => {
                  const amountStr = formatAmount(item.amount);
                  const displayName = item.entityName ?? item.projectName ?? null;
                  return (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0"
                      data-testid={`activity-item-${item.id}`}
                    >
                      <Badge
                        className={`text-xs whitespace-nowrap mt-0.5 font-medium ${ACTION_COLORS[item.action] ?? "bg-gray-100 text-gray-700"}`}
                        data-testid={`activity-label-${item.id}`}
                      >
                        {item.label}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground leading-tight">
                          {displayName ? (
                            <span className="font-medium">{displayName}</span>
                          ) : (
                            <span className="text-muted-foreground italic">—</span>
                          )}
                          {amountStr && (
                            <span className="ml-2 text-muted-foreground font-normal" data-testid={`activity-amount-${item.id}`}>
                              {amountStr}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <User className="w-3 h-3" />
                          <span data-testid={`activity-actor-${item.id}`}>{item.actorName}</span>
                        </p>
                      </div>
                      <span
                        className="text-xs text-muted-foreground whitespace-nowrap mt-0.5"
                        data-testid={`activity-time-${item.id}`}
                      >
                        {formatRelative(item.createdAt)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
