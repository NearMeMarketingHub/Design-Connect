import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save, Printer, DollarSign } from "lucide-react";

export default function Estimator() {
  const [lineItems, setLineItems] = useState([
    { id: 1, category: "01 - General Conditions", item: "Project Management", quantity: 120, unit: "Hrs", rate: 85, total: 10200 },
    { id: 2, category: "01 - General Conditions", item: "Permits & Fees", quantity: 1, unit: "LS", rate: 2500, total: 2500 },
    { id: 3, category: "02 - Demolition", item: "Kitchen Demolition", quantity: 1, unit: "LS", rate: 3500, total: 3500 },
    { id: 4, category: "02 - Demolition", item: "Debris Removal", quantity: 2, unit: "Load", rate: 450, total: 900 },
    { id: 5, category: "06 - Wood & Plastics", item: "Rough Lumber Package", quantity: 1, unit: "LS", rate: 4500, total: 4500 },
    { id: 6, category: "06 - Wood & Plastics", item: "Framing Labor", quantity: 350, unit: "SF", rate: 12, total: 4200 },
    { id: 7, category: "15 - Mechanical", item: "HVAC Rough-in", quantity: 1, unit: "LS", rate: 6500, total: 6500 },
    { id: 8, category: "16 - Electrical", item: "Rough Wiring", quantity: 25, unit: "Opening", rate: 120, total: 3000 },
  ]);

  const totalCost = lineItems.reduce((acc, item) => acc + item.total, 0);
  const overhead = totalCost * 0.10;
  const profit = totalCost * 0.15;
  const grandTotal = totalCost + overhead + profit;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-heading font-bold">Estimator</h1>
          <p className="text-muted-foreground">Master Budget: Jenkins Residence</p>
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
                  {lineItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium text-xs text-muted-foreground">{item.category}</TableCell>
                      <TableCell>{item.item}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{item.unit}</TableCell>
                      <TableCell>${item.rate}</TableCell>
                      <TableCell className="text-right font-medium">${item.total.toLocaleString()}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-50 hover:opacity-100">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
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