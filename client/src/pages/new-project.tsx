import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, Save, FolderOpen, MapPin, Calendar, DollarSign, User, FileText, Mail, UserPlus, Plus, Trash2, GripVertical } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  "On Hold",
  "Completed",
];

const DEFAULT_PHASE_MILESTONES: Record<string, string[]> = {
  "Pre-Construction": ["Site Survey", "Soil Testing", "Initial Budgeting"],
  "Design": ["Schematic Design", "Design Development", "Construction Documents"],
  "Permitting": ["Submit Permits", "Permit Review", "Permit Approval"],
  "Foundation": ["Excavation", "Footings", "Foundation Pour", "Foundation Cure"],
  "Framing": ["Floor Framing", "Wall Framing", "Roof Framing"],
  "Rough-in": ["Electrical Rough-in", "Plumbing Rough-in", "HVAC Rough-in"],
  "Insulation": ["Wall Insulation", "Attic Insulation", "Inspection"],
  "Drywall": ["Hang Drywall", "Tape & Mud", "Texture & Prime"],
  "Finishing": ["Trim & Millwork", "Paint", "Flooring", "Fixtures"],
  "Final Inspection": ["Pre-inspection Walkthrough", "Final Inspection", "Punch List"],
  "Handover": ["Client Walkthrough", "Documentation Handoff", "Keys & Warranty"],
  "Project Complete": ["Project Archived"],
};

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
    "Final Inspection",
    "Handover",
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
    "Final Inspection",
    "Handover",
  ],
  "Completed": [
    "Project Complete",
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
  "Project Complete",
];

export default function NewProject() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [currentStep, setCurrentStep] = useState(1);

  const [formData, setFormData] = useState({
    name: "",
    address: "",
    type: "",
    status: "Planning",
    phase: "Pre-Construction",
    description: "",
    budget: "",
    clientId: "",
    dueDate: "",
  });

  const [clientMode, setClientMode] = useState<"existing" | "invite">("existing");
  const [inviteData, setInviteData] = useState({
    email: "",
    clientName: "",
  });

  const [phaseMilestones, setPhaseMilestones] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {};
    ALL_PHASES.forEach(phase => {
      initial[phase] = [...(DEFAULT_PHASE_MILESTONES[phase] || [])];
    });
    return initial;
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
    onSuccess: async (project) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      
      if (clientMode === "invite" && inviteData.email) {
        try {
          await apiRequest("POST", `/api/projects/${project.id}/invite`, {
            email: inviteData.email,
            clientName: inviteData.clientName,
          });
          toast({
            title: "Project Created & Invite Sent",
            description: `Project created and invitation sent to ${inviteData.email}`,
          });
        } catch (inviteError) {
          toast({
            title: "Project Created",
            description: "Project created but failed to send invite. You can send it later.",
            variant: "default",
          });
        }
      } else {
        toast({
          title: "Project Created",
          description: "Your new project has been created successfully.",
        });
      }
      
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

  const handleNextStep = () => {
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
    setCurrentStep(2);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createProjectMutation.mutate(formData);
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => {
      const newData = { ...prev, [field]: value };
      
      if (field === "status") {
        const validPhases = STATUS_PHASES[value] || ALL_PHASES;
        if (!validPhases.includes(prev.phase)) {
          newData.phase = validPhases[0] || "";
        }
      }
      
      return newData;
    });
  };

  const addMilestone = (phase: string) => {
    setPhaseMilestones(prev => ({
      ...prev,
      [phase]: [...(prev[phase] || []), "New Milestone"]
    }));
  };

  const updateMilestone = (phase: string, index: number, value: string) => {
    setPhaseMilestones(prev => ({
      ...prev,
      [phase]: prev[phase].map((m, i) => i === index ? value : m)
    }));
  };

  const removeMilestone = (phase: string, index: number) => {
    setPhaseMilestones(prev => ({
      ...prev,
      [phase]: prev[phase].filter((_, i) => i !== index)
    }));
  };

  const availablePhases = STATUS_PHASES[formData.status] || ALL_PHASES;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => currentStep === 1 ? setLocation("/admin-dashboard") : setCurrentStep(1)}
          data-testid="button-back"
          className="hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-heading font-bold text-foreground">New Project</h1>
          <p className="text-muted-foreground mt-1">
            {currentStep === 1 ? "Step 1: Project Details" : "Step 2: Timeline & Milestones"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${currentStep >= 1 ? "bg-primary" : "bg-muted"}`} />
          <div className={`w-8 h-0.5 ${currentStep >= 2 ? "bg-primary" : "bg-muted"}`} />
          <div className={`w-3 h-3 rounded-full ${currentStep >= 2 ? "bg-primary" : "bg-muted"}`} />
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {currentStep === 1 && (
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
                  <CardDescription>Assign to an existing client or invite a new one</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Tabs value={clientMode} onValueChange={(v) => setClientMode(v as "existing" | "invite")}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="existing" data-testid="tab-existing-client">
                        <User className="w-4 h-4 mr-2" />
                        Existing
                      </TabsTrigger>
                      <TabsTrigger value="invite" data-testid="tab-invite-client">
                        <UserPlus className="w-4 h-4 mr-2" />
                        Invite New
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="existing" className="space-y-4 mt-4">
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
                    </TabsContent>
                    <TabsContent value="invite" className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label htmlFor="clientName">Client Name</Label>
                        <Input
                          id="clientName"
                          placeholder="John Smith"
                          value={inviteData.clientName}
                          onChange={(e) => setInviteData(prev => ({ ...prev, clientName: e.target.value }))}
                          data-testid="input-client-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="clientEmail">Client Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="clientEmail"
                            type="email"
                            placeholder="client@example.com"
                            className="pl-10"
                            value={inviteData.email}
                            onChange={(e) => setInviteData(prev => ({ ...prev, email: e.target.value }))}
                            data-testid="input-client-email"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          An invitation will be sent after the project is created
                        </p>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>

              <Button
                type="button"
                onClick={handleNextStep}
                className="w-full hover:bg-primary/90 hover:scale-[1.02] transition-all"
                size="lg"
                data-testid="button-next-step"
              >
                Next Step
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Status & Timeline
                </CardTitle>
                <CardDescription>Set the project status and customize milestones for each phase</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                        {availablePhases.map((phase: string) => (
                          <SelectItem key={phase} value={phase}>
                            {phase}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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

            <Card>
              <CardHeader>
                <CardTitle>Customize Phase Milestones</CardTitle>
                <CardDescription>
                  Add, remove, or rename milestones for each phase. These will be used to track progress.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {availablePhases.map((phase) => (
                    <div key={phase} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-lg">{phase}</h4>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addMilestone(phase)}
                          data-testid={`button-add-milestone-${phase}`}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Add Milestone
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {(phaseMilestones[phase] || []).map((milestone, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                            <Input
                              value={milestone}
                              onChange={(e) => updateMilestone(phase, index, e.target.value)}
                              className="flex-1"
                              data-testid={`input-milestone-${phase}-${index}`}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeMilestone(phase, index)}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              data-testid={`button-remove-milestone-${phase}-${index}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                        {(phaseMilestones[phase] || []).length === 0 && (
                          <p className="text-sm text-muted-foreground italic">
                            No milestones added. Click "Add Milestone" to create one.
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentStep(1)}
                className="flex-1"
                size="lg"
                data-testid="button-back-step"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                type="submit"
                className="flex-1 hover:bg-primary/90 hover:scale-[1.02] transition-all"
                size="lg"
                disabled={createProjectMutation.isPending}
                data-testid="button-create-project"
              >
                <Save className="w-4 h-4 mr-2" />
                {createProjectMutation.isPending ? "Creating..." : "Create Project"}
              </Button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
