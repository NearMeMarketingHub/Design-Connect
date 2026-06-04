import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save, Printer, FileText } from "lucide-react";

type LineItem = { id: number; category: string; item: string; quantity: number; unit: string; rate: number; total: number };

export default function Estimator() {
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  const totalCost = lineItems.reduce((acc, item) => acc + item.total, 0);
  const overhead = totalCost * 0.10;
  const profit = totalCost * 0.15;
  const grandTotal = totalCost + overhead + profit;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-heading font-bold">Estimator</h1>
          <p className="text-muted-foreground">Build and manage project cost estimates.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Printer className="w-4 h-4 mr-2" />
            Print Estimate
          </Button>
          <Button>
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Line Items</CardTitle>
                <Button size="sm" variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-[80px]">Qty</TableHead>
                    <TableHead className="w-[80px]">Unit</TableHead>
                    <TableHead className="w-[100px]">Rate</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-12">
                        <div className="text-center text-muted-foreground" data-testid="empty-line-items">
                          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                          <p className="font-medium">No line items yet</p>
                          <p className="text-sm mt-1">Click "Add Item" to start building this estimate.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    lineItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium text-xs text-muted-foreground">{item.category}</TableCell>
                        <TableCell>{item.item}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{item.unit}</TableCell>
                        <TableCell>${item.rate}</TableCell>
                        <TableCell className="text-right font-medium">${item.total.toLocaleString()}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive opacity-50 hover:opacity-100"
                            onClick={() => setLineItems((prev) => prev.filter((i) => i.id !== item.id))}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle>Financial Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal Material & Labor</span>
                <span className="font-medium">${totalCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Overhead (10%)</span>
                <span>${overhead.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Profit (15%)</span>
                <span>${profit.toLocaleString()}</span>
              </div>
              <div className="pt-4 border-t border-border flex justify-between items-center">
                <span className="font-heading font-bold text-lg">Grand Total</span>
                <span className="font-heading font-bold text-xl text-primary">${grandTotal.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Estimate Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Estimate Date</Label>
                <Input type="date" defaultValue="2025-05-15" />
              </div>
              <div className="space-y-2">
                <Label>Valid Until</Label>
                <Input type="date" defaultValue="2025-06-15" />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <div className="flex gap-2">
                  <Badge variant="outline" className="cursor-pointer hover:bg-muted">Draft</Badge>
                  <Badge className="cursor-pointer bg-primary">Approved</Badge>
                  <Badge variant="outline" className="cursor-pointer hover:bg-muted">Sent</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}