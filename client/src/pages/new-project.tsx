import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, FolderOpen, MapPin, Calendar, DollarSign, User, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const PROJECT_TYPES = [
  "New Construction",
  "Renovation",
  "Remodel",
  "Addition",
  "Commercial",
  "Residential",
  "Mixed Use",
];

const PROJECT_STATUSES = [
  "Planning",
  "Active",
  "In Progress",
  "On Hold",
  "Completed",
];

const STATUS_PHASES: Record<string, string[]> = {
  "Planning": [
    "Pre-Construction",
    "Design",
    "Permitting",
  ],
  "Active": [
    "Foundation",
    "Framing",
    "Rough-in",
    "Insulation",
    "Drywall",
    "Finishing",
  ],
  "In Progress": [
    "Foundation",
    "Framing",
    "Rough-in",
    "Insulation",
    "Drywall",
    "Finishing",
  ],
  "On Hold": [
    "Pre-Construction",
    "Design",
    "Permitting",
    "Foundation",
    "Framing",
    "Rough-in",
    "Insulation",
    "Drywall",
    "Finishing",
  ],
  "Completed": [
    "Final Inspection",
    "Handover",
  ],
};

const ALL_PHASES = [
  "Pre-Construction",
  "Design",
  "Permitting",
  "Foundation",
  "Framing",
  "Rough-in",
  "Insulation",
  "Drywall",
  "Finishing",
  "Final Inspection",
  "Handover",
];

export default function NewProject() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: "",
    address: "",
    type: "",
    status: "Planning",
    phase: "Pre-Construction",
    description: "",
    budget: "",
    clientId: "",
    nextMilestone: "",
    dueDate: "",
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["/api/users/clients"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users/clients");
      return res.json();
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("POST", "/api/projects", {
        ...data,
        progress: 0,
        budget: data.budget ? parseFloat(data.budget) : null,
        clientId: data.clientId || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Project Created",
        description: "Your new project has been created successfully.",
      });
      setLocation("/admin-dashboard");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create project",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter a project name.",
        variant: "destructive",
      });
      return;
    }
    if (!formData.address.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter a project address.",
        variant: "destructive",
      });
      return;
    }
    if (formData.budget && isNaN(parseFloat(formData.budget))) {
      toast({
        title: "Invalid Budget",
        description: "Please enter a valid number for the budget.",
        variant: "destructive",
      });
      return;
    }
    createProjectMutation.mutate(formData);
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => {
      const newData = { ...prev, [field]: value };
      
      // When status changes, reset phase if current phase is not valid for new status
      if (field === "status") {
        const validPhases = STATUS_PHASES[value] || ALL_PHASES;
        if (!validPhases.includes(prev.phase)) {
          newData.phase = validPhases[0] || "";
        }
      }
      
      return newData;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/admin-dashboard")}
          data-testid="button-back"
          className="hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">New Project</h1>
          <p className="text-muted-foreground mt-1">Create a new construction project</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderOpen className="w-5 h-5" />
                  Project Details
                </CardTitle>
                <CardDescription>Basic information about the project</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Project Name *</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Jenkins Residence"
                      value={formData.name}
                      onChange={(e) => handleChange("name", e.target.value)}
                      data-testid="input-project-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type">Project Type</Label>
                    <Select value={formData.type} onValueChange={(v) => handleChange("type", v)}>
                      <SelectTrigger data-testid="select-project-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {PROJECT_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address" className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Project Address *
                  </Label>
                  <Input
                    id="address"
                    placeholder="e.g., 123 Main Street, City, State 12345"
                    value={formData.address}
                    onChange={(e) => handleChange("address", e.target.value)}
                    data-testid="input-project-address"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description" className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    placeholder="Describe the scope of work, goals, and any important details..."
                    rows={4}
                    value={formData.description}
                    onChange={(e) => handleChange("description", e.target.value)}
                    data-testid="input-project-description"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Status & Timeline
                </CardTitle>
                <CardDescription>Project status and milestone tracking</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select value={formData.status} onValueChange={(v) => handleChange("status", v)}>
                      <SelectTrigger data-testid="select-project-status">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {PROJECT_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phase">Current Phase</Label>
                    <Select value={formData.phase} onValueChange={(v) => handleChange("phase", v)}>
                      <SelectTrigger data-testid="select-project-phase">
                        <SelectValue placeholder="Select phase" />
                      </SelectTrigger>
                      <SelectContent>
                        {(STATUS_PHASES[formData.status] || ALL_PHASES).map((phase: string) => (
                          <SelectItem key={phase} value={phase}>
                            {phase}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Phases shown are based on the selected status
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nextMilestone">Next Milestone</Label>
                    <Input
                      id="nextMilestone"
                      placeholder="e.g., Foundation Inspection"
                      value={formData.nextMilestone}
                      onChange={(e) => handleChange("nextMilestone", e.target.value)}
                      data-testid="input-next-milestone"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dueDate">Target Completion Date</Label>
                    <Input
                      id="dueDate"
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => handleChange("dueDate", e.target.value)}
                      data-testid="input-due-date"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Budget
                </CardTitle>
                <CardDescription>Project financials</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="budget">Estimated Budget</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                    <Input
                      id="budget"
                      type="number"
                      placeholder="0.00"
                      className="pl-7"
                      value={formData.budget}
                      onChange={(e) => handleChange("budget", e.target.value)}
                      data-testid="input-budget"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Client
                </CardTitle>
                <CardDescription>Assign to a client</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="client">Select Client</Label>
                  <Select value={formData.clientId} onValueChange={(v) => handleChange("clientId", v)}>
                    <SelectTrigger data-testid="select-client">
                      <SelectValue placeholder="Choose a client (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client: { id: string; name: string; username: string }) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name || client.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    You can assign a client later if needed
                  </p>
                </div>
              </CardContent>
            </Card>

            <Button
              type="submit"
              className="w-full hover:bg-primary/90 hover:scale-[1.02] transition-all"
              size="lg"
              disabled={createProjectMutation.isPending}
              data-testid="button-create-project"
            >
              <Save className="w-4 h-4 mr-2" />
              {createProjectMutation.isPending ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
