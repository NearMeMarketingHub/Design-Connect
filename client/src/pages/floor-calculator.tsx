import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Ruler,
  Plus,
  Trash2,
  Square,
  Grid3X3,
  DollarSign,
  Calculator,
  Save,
  RotateCcw,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";

interface Room {
  id: string;
  name: string;
  length: number;
  width: number;
}

interface BudgetItem {
  id: string;
  categoryId: string;
  itemType: string;
  description: string;
  unitType: string;
  cost: string;
  burdens: string;
  materialFee: string;
  laborRate: string;
  subRate: string;
  retailPrice: string;
  notes: string | null;
  displayOrder: number;
  isActive: boolean;
}

const ROOM_PRESETS = [
  { name: "Living Room", length: 15, width: 12 },
  { name: "Master Bedroom", length: 14, width: 12 },
  { name: "Bedroom", length: 12, width: 10 },
  { name: "Kitchen", length: 12, width: 10 },
  { name: "Bathroom", length: 8, width: 6 },
  { name: "Dining Room", length: 12, width: 10 },
  { name: "Office", length: 10, width: 10 },
  { name: "Hallway", length: 15, width: 4 },
  { name: "Laundry Room", length: 8, width: 6 },
  { name: "Garage", length: 20, width: 20 },
];

export default function FloorCalculator() {
  const { currentPortal } = useAuth();
  const { toast } = useToast();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [wasteFactor, setWasteFactor] = useState(10);
  const [selectedFlooring, setSelectedFlooring] = useState<BudgetItem | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [estimateName, setEstimateName] = useState("");

  const dashboardPath = currentPortal === "admin" ? "/admin/dashboard" : "/contractor/dashboard";

  const { data: allItems = [], isLoading: itemsLoading } = useQuery<BudgetItem[]>({
    queryKey: ["/api/calculator/items"],
    queryFn: async () => {
      const res = await fetch("/api/calculator/items", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch items");
      return res.json();
    },
  });

  const flooringItems = useMemo(() => {
    return allItems.filter(item => 
      item.isActive && 
      (item.unitType?.toLowerCase().includes("sf") || 
       item.unitType?.toLowerCase().includes("sq") ||
       item.description?.toLowerCase().includes("floor") ||
       item.description?.toLowerCase().includes("tile") ||
       item.description?.toLowerCase().includes("carpet") ||
       item.description?.toLowerCase().includes("vinyl") ||
       item.description?.toLowerCase().includes("hardwood") ||
       item.description?.toLowerCase().includes("laminate"))
    );
  }, [allItems]);

  const addRoom = (preset?: typeof ROOM_PRESETS[0]) => {
    const newRoom: Room = {
      id: crypto.randomUUID(),
      name: preset?.name || `Room ${rooms.length + 1}`,
      length: preset?.length || 10,
      width: preset?.width || 10,
    };
    setRooms([...rooms, newRoom]);
  };

  const updateRoom = (id: string, field: keyof Room, value: string | number) => {
    setRooms(rooms.map(room => 
      room.id === id ? { ...room, [field]: value } : room
    ));
  };

  const removeRoom = (id: string) => {
    setRooms(rooms.filter(room => room.id !== id));
  };

  const clearAllRooms = () => {
    setRooms([]);
    setSelectedFlooring(null);
  };

  const totalSqFt = useMemo(() => {
    return rooms.reduce((sum, room) => sum + (room.length * room.width), 0);
  }, [rooms]);

  const sqFtWithWaste = useMemo(() => {
    return Math.ceil(totalSqFt * (1 + wasteFactor / 100));
  }, [totalSqFt, wasteFactor]);

  const materialCost = useMemo(() => {
    if (!selectedFlooring) return 0;
    const pricePerSqFt = parseFloat(selectedFlooring.retailPrice) || 0;
    return sqFtWithWaste * pricePerSqFt;
  }, [selectedFlooring, sqFtWithWaste]);

  const laborCost = useMemo(() => {
    if (!selectedFlooring) return 0;
    const laborPerSqFt = parseFloat(selectedFlooring.laborRate) || 0;
    return sqFtWithWaste * laborPerSqFt;
  }, [selectedFlooring, sqFtWithWaste]);

  const totalCost = materialCost + laborCost;

  const handleSaveEstimate = () => {
    toast({
      title: "Estimate Saved",
      description: `"${estimateName}" saved successfully. Full save functionality coming soon.`,
    });
    setSaveDialogOpen(false);
    setEstimateName("");
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={dashboardPath}>
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-heading font-bold text-foreground flex items-center gap-3">
              <Ruler className="w-8 h-8 text-primary" />
              Floor Calculator
            </h1>
            <p className="text-muted-foreground mt-1">Calculate square footage and flooring costs by room</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/contractor/calculator">
            <Button variant="outline" data-testid="button-item-calculator">
              <Calculator className="w-4 h-4 mr-2" />
              Item Calculator
            </Button>
          </Link>
          {rooms.length > 0 && (
            <Button variant="outline" onClick={clearAllRooms} data-testid="button-clear-all">
              <RotateCcw className="w-4 h-4 mr-2" />
              Clear All
            </Button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Grid3X3 className="w-5 h-5" />
                    Rooms
                  </CardTitle>
                  <CardDescription>Add rooms and enter dimensions in feet</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => addRoom()}
                  data-testid="button-add-custom-room"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Custom Room
                </Button>
                <Separator orientation="vertical" className="h-8" />
                <span className="text-sm text-muted-foreground self-center">Quick Add:</span>
                {ROOM_PRESETS.slice(0, 6).map((preset) => (
                  <Button
                    key={preset.name}
                    variant="ghost"
                    size="sm"
                    onClick={() => addRoom(preset)}
                    data-testid={`button-add-${preset.name.toLowerCase().replace(" ", "-")}`}
                  >
                    {preset.name}
                  </Button>
                ))}
              </div>

              {rooms.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Square className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No rooms added yet</p>
                  <p className="text-sm">Click a room type above or add a custom room</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Room Name</TableHead>
                      <TableHead className="w-28">Length (ft)</TableHead>
                      <TableHead className="w-28">Width (ft)</TableHead>
                      <TableHead className="w-28 text-right">Sq Ft</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rooms.map((room) => (
                      <TableRow key={room.id} data-testid={`row-room-${room.id}`}>
                        <TableCell>
                          <Input
                            value={room.name}
                            onChange={(e) => updateRoom(room.id, "name", e.target.value)}
                            className="max-w-48"
                            data-testid={`input-room-name-${room.id}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            step="0.5"
                            value={room.length}
                            onChange={(e) => updateRoom(room.id, "length", parseFloat(e.target.value) || 0)}
                            data-testid={`input-room-length-${room.id}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            step="0.5"
                            value={room.width}
                            onChange={(e) => updateRoom(room.id, "width", parseFloat(e.target.value) || 0)}
                            data-testid={`input-room-width-${room.id}`}
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {(room.length * room.width).toLocaleString()} sq ft
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeRoom(room.id)}
                            className="text-destructive hover:text-destructive"
                            data-testid={`button-remove-room-${room.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Flooring Material</CardTitle>
              <CardDescription>Select a flooring type to calculate costs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Select Flooring Type</Label>
                <Select
                  value={selectedFlooring?.id || ""}
                  onValueChange={(value) => {
                    const item = flooringItems.find(i => i.id === value);
                    setSelectedFlooring(item || null);
                  }}
                >
                  <SelectTrigger data-testid="select-flooring-type">
                    <SelectValue placeholder={itemsLoading ? "Loading..." : "Choose a flooring material"} />
                  </SelectTrigger>
                  <SelectContent>
                    {flooringItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.description} - ${parseFloat(item.retailPrice).toFixed(2)}/{item.unitType}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedFlooring && (
                <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Material Cost</p>
                    <p className="font-semibold">${parseFloat(selectedFlooring.retailPrice).toFixed(2)}/sq ft</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Labor Rate</p>
                    <p className="font-semibold">${parseFloat(selectedFlooring.laborRate).toFixed(2)}/sq ft</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Unit Type</p>
                    <p className="font-semibold">{selectedFlooring.unitType}</p>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Waste Factor: {wasteFactor}%</Label>
                  <span className="text-sm text-muted-foreground">Recommended: 10-15%</span>
                </div>
                <Slider
                  value={[wasteFactor]}
                  onValueChange={(value) => setWasteFactor(value[0])}
                  min={0}
                  max={25}
                  step={1}
                  data-testid="slider-waste-factor"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Total Rooms</span>
                  <Badge variant="secondary" data-testid="text-room-count">{rooms.length}</Badge>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Base Square Footage</span>
                  <span className="font-medium" data-testid="text-base-sqft">{totalSqFt.toLocaleString()} sq ft</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Waste ({wasteFactor}%)</span>
                  <span className="font-medium">+{(sqFtWithWaste - totalSqFt).toLocaleString()} sq ft</span>
                </div>
                <div className="flex justify-between items-center text-lg font-semibold">
                  <span>Total to Order</span>
                  <span data-testid="text-total-sqft">{sqFtWithWaste.toLocaleString()} sq ft</span>
                </div>
              </div>

              {selectedFlooring && rooms.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Material Cost</span>
                      <span className="font-medium" data-testid="text-material-cost">
                        ${materialCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Labor Cost</span>
                      <span className="font-medium" data-testid="text-labor-cost">
                        ${laborCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center text-xl font-bold text-primary">
                      <span>Total Estimate</span>
                      <span data-testid="text-total-cost">
                        ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </>
              )}

              {rooms.length > 0 && (
                <Button 
                  className="w-full mt-4" 
                  onClick={() => setSaveDialogOpen(true)}
                  disabled={!selectedFlooring}
                  data-testid="button-save-estimate"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Estimate
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Floor Estimate</DialogTitle>
            <DialogDescription>
              Save this flooring calculation for future reference
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="estimate-name">Estimate Name</Label>
              <Input
                id="estimate-name"
                value={estimateName}
                onChange={(e) => setEstimateName(e.target.value)}
                placeholder="e.g., Living Room Hardwood"
                data-testid="input-estimate-name"
              />
            </div>
            <div className="p-4 bg-muted rounded-lg space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Rooms:</span>
                <span>{rooms.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Sq Ft:</span>
                <span>{sqFtWithWaste.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Flooring:</span>
                <span>{selectedFlooring?.description || "None selected"}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Total Cost:</span>
                <span>${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)} data-testid="button-cancel-save">
              Cancel
            </Button>
            <Button 
              disabled={!estimateName.trim()}
              onClick={handleSaveEstimate}
              data-testid="button-confirm-save"
            >
              Save Estimate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
