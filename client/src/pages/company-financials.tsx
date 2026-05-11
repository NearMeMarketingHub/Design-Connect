import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, FileText, Receipt, Plus } from "lucide-react";

export default function CompanyFinancials() {
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
    </div>
  );
}
