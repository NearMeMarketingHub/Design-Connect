import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";

export default function CreateInvoice() {
  const [items, setItems] = useState([
    { id: 1, desc: "Labor - Week 6", qty: 40, rate: 85, amount: 3400 },
    { id: 2, desc: "Materials - Lumber", qty: 1, rate: 1200, amount: 1200 },
  ]);

  const [isRecurring, setIsRecurring] = useState(false);

  const total = items.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/contractor/accounting">
          <Button variant="ghost" size="icon">
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
                  <Label>Client</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select client" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="jenkins">Sarah Jenkins</SelectItem>
                      <SelectItem value="miller">Mike Miller</SelectItem>
                      <SelectItem value="westlake">West Lake Dev</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Project</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="p1">Jenkins Residence</SelectItem>
                      <SelectItem value="p2">Miller Kitchen</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Invoice Date</Label>
                  <Input type="date" />
                </div>
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Input type="date" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Line Items</CardTitle>
              <Button size="sm" variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            </CardHeader>
            <CardContent>
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
                    <TableRow key={item.id}>
                      <TableCell>
                        <Input defaultValue={item.desc} className="border-none shadow-none focus-visible:ring-0 h-auto p-0" />
                      </TableCell>
                      <TableCell>
                        <Input defaultValue={item.qty} type="number" className="border-none shadow-none focus-visible:ring-0 h-auto p-0" />
                      </TableCell>
                      <TableCell>
                        <Input defaultValue={item.rate} type="number" className="border-none shadow-none focus-visible:ring-0 h-auto p-0" />
                      </TableCell>
                      <TableCell className="text-right font-medium">${item.amount}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex justify-end mt-4 pt-4 border-t border-border">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <h3 className="text-2xl font-bold">${total.toLocaleString()}</h3>
                </div>
              </div>
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
                <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
              </div>

              {isRecurring && (
                <div className="space-y-4 pt-4 border-t border-border animate-in fade-in slide-in-from-top-2">
                  <div className="space-y-2">
                    <Label>Frequency</Label>
                    <Select defaultValue="monthly">
                      <SelectTrigger>
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
                    <Input type="date" />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Notes for Client</Label>
                <Textarea placeholder="Thank you for your business..." className="min-h-[100px]" />
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full">
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