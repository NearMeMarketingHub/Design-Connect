import { useState, useRef, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  MapPin,
  MessageSquare,
  Plus,
  Send,
  TrendingUp,
  Users,
  Milestone,
  Phone,
  Mail,
  ChevronDown,
  TestTube,
  Shield,
  Settings
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import projectImage from "@assets/generated_images/modern_luxury_home_interior_with_natural_light.png";

const MILESTONES = [
  { id: 1, name: "Project Kickoff", date: "Oct 1, 2025", status: "completed", description: "Initial meeting and project scope finalized", 
    details: "Met with homeowners to review final plans and material selections.", 
    tasks: ["Contract signed", "Deposit received", "Permits submitted"] },
  { id: 2, name: "Demolition Complete", date: "Oct 15, 2025", status: "completed", description: "All demo work finished, site cleared",
    details: "Removed existing kitchen cabinets, flooring, and non-load-bearing wall.",
    tasks: ["Kitchen demo complete", "Wall removal done", "Debris removed"] },
  { id: 3, name: "Framing Inspection", date: "Nov 8, 2025", status: "completed", description: "Structural framing passed inspection",
    details: "City inspector approved all structural framing including the new header.",
    tasks: ["Headers installed", "Joists secured", "Inspection passed"] },
  { id: 4, name: "Rough-in Complete", date: "Dec 20, 2025", status: "in_progress", description: "Electrical, plumbing, and HVAC rough-ins",
    details: "Electrical panel upgraded to 200A. New circuits run for kitchen appliances.",
    tasks: ["Electrical 80% complete", "Plumbing 90% complete", "Awaiting inspection"] },
  { id: 5, name: "Drywall Installation", date: "Jan 10, 2026", status: "upcoming", description: "Drywall hanging and mudding",
    details: "Drywall crew scheduled for 5-day install.",
    tasks: ["Schedule drywall crew", "Order materials", "Hang drywall"] },
  { id: 6, name: "Final Inspection", date: "Mar 1, 2026", status: "upcoming", description: "Final city inspection",
    details: "City inspector will verify all permitted work meets code.",
    tasks: ["Schedule inspection", "Prep checklist", "Address corrections"] }
];

const TEAM_MEMBERS = [
  { id: 1, name: "Mike Builder", role: "Project Manager", initials: "MB", email: "mike@buildvision.com", phone: "(555) 123-4567" },
  { id: 2, name: "Jane Design", role: "Lead Designer", initials: "JD", email: "jane@buildvision.com", phone: "(555) 234-5678" },
  { id: 3, name: "Tom Electric", role: "Electrician", initials: "TE", email: "tom@buildvision.com", phone: "(555) 345-6789" }
];

const INSPIRATION_IMAGES = [
  { id: 1, title: "Kitchen Backsplash", category: "Kitchen", src: `https://picsum.photos/seed/101/400/400` },
  { id: 2, title: "Island Pendant Lights", category: "Kitchen", src: `https://picsum.photos/seed/102/400/400` },
  { id: 3, title: "Master Bath Tile", category: "Bathroom", src: `https://picsum.photos/seed/103/400/400` },
  { id: 4, title: "Hardwood Flooring", category: "Flooring", src: `https://picsum.photos/seed/104/400/400` },
  { id: 5, title: "Cabinet Hardware", category: "Kitchen", src: `https://picsum.photos/seed/105/400/400` },
  { id: 6, title: "Paint Colors", category: "General", src: `https://picsum.photos/seed/106/400/400` }
];

export default function SandboxProject() {
  const params = useParams<{ id: string }>();
  const [location, setLocation] = useLocation();
  const projectId = params.id || "";
  const { user, loading: authLoading } = useAuth();
  
  const urlParams = new URLSearchParams(location.split('?')[1] || '');
  const tabFromUrl = urlParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabFromUrl || "overview");
  const [expandedMilestones, setExpandedMilestones] = useState<number[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: sandboxData, isLoading } = useQuery({
    queryKey: ["/api/sandbox/data"],
    queryFn: () => api.getSandboxData(),
    enabled: user?.role === "admin",
  });

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) {
      setLocation("/");
    }
  }, [user, authLoading, setLocation]);

  useEffect(() => {
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  const toggleMilestone = (id: number) => {
    setExpandedMilestones(prev => 
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!sandboxData?.project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Sandbox project not found</p>
          <Link href="/super-admin">
            <Button>Return to Admin</Button>
          </Link>
        </div>
      </div>
    );
  }

  const project = sandboxData.project;
  const projectData = {
    name: project.name,
    address: project.address || "123 Test Street",
    status: project.status || "in_progress",
    phase: project.phase || "Phase 3: Rough-in",
    progress: project.progress || 45,
    budget: parseInt(project.budget || "0") || 145000,
    spent: 62350,
    startDate: "Oct 1, 2025",
    endDate: "Mar 15, 2026",
    nextMilestone: project.nextMilestone || "Drywall Inspection",
    dueDate: "Jan 15, 2026",
    description: project.description || "Complete home renovation including kitchen remodel, bathroom upgrades, and open floor plan conversion."
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="h-16 border-b border-border bg-card px-4 md:px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/sandbox/dashboard">
            <Button variant="ghost" size="sm" className="gap-2" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back to Dashboard</span>
            </Button>
          </Link>
          <Badge variant="outline" className="border-purple-600 text-purple-600">
            Test Mode
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="text-muted-foreground" data-testid="button-settings">
            <Settings className="w-5 h-5" />
          </Button>
          <Link href="/super-admin">
            <Button variant="ghost" size="icon" className="text-muted-foreground" data-testid="button-exit-sandbox">
              <Shield className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 md:p-8">
        <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg p-4 flex items-start gap-3 mb-6">
            <TestTube className="w-5 h-5 text-purple-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-purple-800 dark:text-purple-200">Sandbox Project</p>
              <p className="text-xs text-purple-600 dark:text-purple-400">
                This is isolated test data. Changes here won't affect real projects.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-3xl font-heading font-bold" data-testid="text-project-name">{projectData.name}</h1>
                <Badge className={`${
                  projectData.status === 'in_progress' ? 'bg-green-500 hover:bg-green-600' :
                  projectData.status === 'planning' ? 'bg-blue-500 hover:bg-blue-600' :
                  'bg-slate-500 hover:bg-slate-600'
                } border-0`} data-testid="badge-project-status">
                  {projectData.status.replace("_", " ")}
                </Badge>
              </div>
              <div className="flex items-center text-muted-foreground text-sm mt-1">
                <MapPin className="w-4 h-4 mr-1" />
                <span data-testid="text-project-address">{projectData.address}</span>
              </div>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
            <TabsList className="w-full justify-start border-b border-border bg-transparent p-0 rounded-none h-auto overflow-x-auto flex-nowrap">
              <TabsTrigger 
                value="overview"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:bg-muted px-4 py-3 whitespace-nowrap transition-colors"
                data-testid="tab-overview"
              >
                Overview
              </TabsTrigger>
              <TabsTrigger 
                value="inspiration"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:bg-muted px-4 py-3 whitespace-nowrap transition-colors"
                data-testid="tab-inspiration"
              >
                Inspiration & Selections
              </TabsTrigger>
              <TabsTrigger 
                value="timeline"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:bg-muted px-4 py-3 whitespace-nowrap transition-colors"
                data-testid="tab-timeline"
              >
                Timeline
              </TabsTrigger>
              <TabsTrigger 
                value="messages"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:bg-muted px-4 py-3 whitespace-nowrap transition-colors"
                data-testid="tab-messages"
              >
                Messages
              </TabsTrigger>
              <TabsTrigger 
                value="progress"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:bg-muted px-4 py-3 whitespace-nowrap transition-colors"
                data-testid="tab-progress"
              >
                Progress Photos
              </TabsTrigger>
              <TabsTrigger 
                value="documents"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:bg-muted px-4 py-3 whitespace-nowrap transition-colors"
                data-testid="tab-documents"
              >
                Documents
              </TabsTrigger>
            </TabsList>

            <div className="mt-6">
              <TabsContent value="overview" className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card data-testid="card-stat-progress">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <TrendingUp className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Progress</p>
                          <p className="text-xl font-bold" data-testid="text-progress">{projectData.progress}%</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card data-testid="card-stat-budget">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-500/10 rounded-lg">
                          <DollarSign className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Budget</p>
                          <p className="text-xl font-bold" data-testid="text-budget">{formatCurrency(projectData.budget)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card data-testid="card-stat-spent">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-500/10 rounded-lg">
                          <Clock className="h-5 w-5 text-orange-600" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Spent</p>
                          <p className="text-xl font-bold" data-testid="text-spent">{formatCurrency(projectData.spent)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card data-testid="card-stat-completion">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                          <Calendar className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Est. Complete</p>
                          <p className="text-xl font-bold" data-testid="text-end-date">{projectData.endDate}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                  <div className="md:col-span-2 space-y-6">
                    <Card data-testid="card-current-phase">
                      <CardHeader>
                        <CardTitle>Current Phase: {projectData.phase.split(':')[1]?.trim() || projectData.phase}</CardTitle>
                        <CardDescription>{projectData.phase}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <img 
                          src={projectImage} 
                          alt="Project Progress" 
                          className="w-full h-48 md:h-64 object-cover rounded-md"
                          data-testid="img-project-hero"
                        />
                        <div>
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-muted-foreground">Overall Progress</span>
                            <span className="font-medium">{projectData.progress}%</span>
                          </div>
                          <Progress value={projectData.progress} className="h-2" />
                        </div>
                        <p className="text-sm text-muted-foreground" data-testid="text-description">
                          {projectData.description}
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Milestone className="h-5 w-5" />
                          Next Milestone
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/20">
                          <div className="flex items-center gap-3">
                            <CheckCircle2 className="h-6 w-6 text-primary" />
                            <div>
                              <p className="font-medium" data-testid="text-next-milestone">{projectData.nextMilestone}</p>
                              <p className="text-sm text-muted-foreground">Target: {projectData.dueDate}</p>
                            </div>
                          </div>
                          <Badge variant="outline">Upcoming</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Users className="h-5 w-5" />
                          Your Team
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {TEAM_MEMBERS.map((member) => (
                          <Popover key={member.id}>
                            <PopoverTrigger asChild>
                              <div 
                                className="flex items-center gap-3 p-2 -m-2 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                                data-testid={`button-team-member-${member.id}`}
                              >
                                <Avatar>
                                  <AvatarFallback>{member.initials}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium text-sm">{member.name}</p>
                                  <p className="text-xs text-muted-foreground">{member.role}</p>
                                </div>
                              </div>
                            </PopoverTrigger>
                            <PopoverContent className="w-64" align="start">
                              <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-10 w-10">
                                    <AvatarFallback>{member.initials}</AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="font-semibold">{member.name}</p>
                                    <p className="text-sm text-muted-foreground">{member.role}</p>
                                  </div>
                                </div>
                                <div className="space-y-2 pt-2 border-t">
                                  <a 
                                    href={`mailto:${member.email}`} 
                                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    <Mail className="h-4 w-4" />
                                    {member.email}
                                  </a>
                                  <a 
                                    href={`tel:${member.phone}`} 
                                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    <Phone className="h-4 w-4" />
                                    {member.phone}
                                  </a>
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        ))}
                        <Button 
                          variant="outline" 
                          className="w-full mt-2 hover:bg-muted transition-colors" 
                          data-testid="button-contact-team"
                          onClick={() => setActiveTab("messages")}
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Contact Team
                        </Button>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Calendar className="h-5 w-5" />
                          Project Schedule
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Start Date</span>
                          <span className="font-medium" data-testid="text-start-date">{projectData.startDate}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Target End</span>
                          <span className="font-medium">{projectData.endDate}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Duration</span>
                          <span className="font-medium">24 weeks</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="inspiration" className="space-y-6">
                <input 
                  type="file" 
                  ref={fileInputRef}
                  accept="image/*"
                  multiple
                  className="hidden"
                  data-testid="input-file-upload"
                />
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold">Inspiration & Selections</h3>
                    <p className="text-sm text-muted-foreground">Upload inspiration photos and track material selections</p>
                  </div>
                  <Button 
                    data-testid="button-upload-inspiration"
                    onClick={() => fileInputRef.current?.click()}
                    className="hover:bg-primary/90 transition-colors"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Upload Image
                  </Button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {INSPIRATION_IMAGES.map((img) => (
                    <div 
                      key={img.id} 
                      className="group relative aspect-square bg-muted rounded-lg overflow-hidden border border-border cursor-pointer hover:border-primary transition-colors"
                      data-testid={`card-inspiration-${img.id}`}
                    >
                      <img 
                        src={img.src} 
                        alt={img.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button 
                          size="icon" 
                          variant="secondary" 
                          data-testid={`button-comment-inspiration-${img.id}`}
                        >
                          <MessageSquare className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent">
                        <div>
                          <p className="text-white text-sm font-medium">{img.title}</p>
                          <p className="text-white/70 text-xs">{img.category}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <div 
                    className="aspect-square border-2 border-dashed border-muted-foreground/30 rounded-lg flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/50 cursor-pointer transition-colors"
                    data-testid="button-add-inspiration"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Plus className="w-8 h-8 mb-2" />
                    <span className="text-sm font-medium">Add Image</span>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="timeline" className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold">Project Timeline</h3>
                  <p className="text-sm text-muted-foreground">Track milestones and project phases</p>
                </div>

                <Card>
                  <CardContent className="p-6">
                    <div className="relative">
                      {MILESTONES.map((milestone, index) => {
                        const isExpanded = expandedMilestones.includes(milestone.id);
                        return (
                          <div key={milestone.id} className="flex gap-4 pb-8 last:pb-0" data-testid={`milestone-${milestone.id}`}>
                            <div className="flex flex-col items-center">
                              <div className={`w-4 h-4 rounded-full border-2 ${
                                milestone.status === 'completed' ? 'bg-green-500 border-green-500' :
                                milestone.status === 'in_progress' ? 'bg-primary border-primary animate-pulse' :
                                'bg-muted border-muted-foreground/30'
                              }`}>
                                {milestone.status === 'completed' && (
                                  <CheckCircle2 className="w-3 h-3 text-white m-auto" style={{ marginTop: '-1px' }} />
                                )}
                              </div>
                              {index < MILESTONES.length - 1 && (
                                <div className={`w-0.5 flex-1 mt-2 ${
                                  milestone.status === 'completed' ? 'bg-green-500' : 'bg-muted-foreground/20'
                                }`} />
                              )}
                            </div>
                            
                            <div className="flex-1 pb-4">
                              <div 
                                className="flex items-start justify-between cursor-pointer hover:bg-muted/50 -mx-2 px-2 py-1 rounded-lg transition-colors"
                                onClick={() => toggleMilestone(milestone.id)}
                                data-testid={`button-expand-milestone-${milestone.id}`}
                              >
                                <div className="flex items-start gap-2">
                                  <ChevronDown 
                                    className={`w-4 h-4 mt-1 text-muted-foreground transition-transform duration-200 ${
                                      isExpanded ? 'rotate-180' : ''
                                    }`} 
                                  />
                                  <div>
                                    <h4 className="font-medium">{milestone.name}</h4>
                                    <p className="text-sm text-muted-foreground">{milestone.description}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">{milestone.date}</span>
                                  <Badge variant={
                                    milestone.status === 'completed' ? 'default' :
                                    milestone.status === 'in_progress' ? 'secondary' : 'outline'
                                  } className={
                                    milestone.status === 'completed' ? 'bg-green-500' :
                                    milestone.status === 'in_progress' ? 'bg-primary' : ''
                                  }>
                                    {milestone.status.replace('_', ' ')}
                                  </Badge>
                                </div>
                              </div>
                              
                              {isExpanded && (
                                <div className="mt-4 ml-6 space-y-3 animate-in slide-in-from-top-2 duration-200">
                                  <p className="text-sm text-muted-foreground">{milestone.details}</p>
                                  <div className="space-y-2">
                                    <p className="text-xs font-medium uppercase text-muted-foreground">Tasks</p>
                                    {milestone.tasks.map((task, i) => (
                                      <div key={i} className="flex items-center gap-2 text-sm">
                                        <CheckCircle2 className={`w-3.5 h-3.5 ${
                                          milestone.status === 'completed' ? 'text-green-500' : 'text-muted-foreground/50'
                                        }`} />
                                        <span>{task}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="messages" className="space-y-6">
                <Card className="h-[600px] flex flex-col">
                  <CardHeader className="border-b">
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      Project Messages
                    </CardTitle>
                    <CardDescription>Chat with your project team</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col p-0">
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      <div className="flex gap-3">
                        <Avatar>
                          <AvatarFallback>MB</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">Mike Builder</span>
                            <span className="text-xs text-muted-foreground">9:00 AM</span>
                          </div>
                          <div className="mt-1 p-3 bg-muted rounded-lg rounded-tl-none">
                            <p className="text-sm">Good morning! The electrical inspection passed. We're moving forward with insulation today.</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-3 flex-row-reverse">
                        <Avatar>
                          <AvatarFallback>TC</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 flex flex-col items-end">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">9:15 AM</span>
                            <span className="font-medium text-sm">You</span>
                          </div>
                          <div className="mt-1 p-3 bg-primary text-primary-foreground rounded-lg rounded-tr-none">
                            <p className="text-sm">That's great news! Thanks for the update.</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <Avatar>
                          <AvatarFallback>JD</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">Jane Design</span>
                            <span className="text-xs text-muted-foreground">10:30 AM</span>
                          </div>
                          <div className="mt-1 p-3 bg-muted rounded-lg rounded-tl-none">
                            <p className="text-sm">I've uploaded the final tile selections to the inspiration board. Please review when you get a chance!</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="border-t p-4">
                      <div className="flex gap-2">
                        <Textarea 
                          placeholder="Type your message..." 
                          className="min-h-[44px] max-h-32 resize-none"
                          data-testid="input-message"
                        />
                        <Button size="icon" data-testid="button-send-message">
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="progress" className="space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold">Progress Photos</h3>
                    <p className="text-sm text-muted-foreground">Visual documentation of your project's progress</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[
                    { id: 1, date: "Dec 10, 2025", title: "Kitchen Framing", description: "Island framing complete", images: 3 },
                    { id: 2, date: "Dec 8, 2025", title: "Electrical Rough-in", description: "Panel installed, main runs complete", images: 5 },
                    { id: 3, date: "Dec 5, 2025", title: "Plumbing Rough-in", description: "Supply lines to all fixtures", images: 4 },
                    { id: 4, date: "Nov 28, 2025", title: "HVAC Ductwork", description: "Main trunk and branch lines", images: 2 },
                    { id: 5, date: "Nov 15, 2025", title: "Framing Complete", description: "All walls and ceiling joists done", images: 6 },
                    { id: 6, date: "Nov 8, 2025", title: "Inspection Passed", description: "Structural inspection approved", images: 3 }
                  ].map((post) => (
                    <Card key={post.id} className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow" data-testid={`card-post-${post.id}`}>
                      <div className="aspect-video bg-muted relative">
                        <img 
                          src={`https://picsum.photos/seed/${post.id * 200}/400/300`} 
                          alt={post.title}
                          className="w-full h-full object-cover"
                        />
                        {post.images > 1 && (
                          <Badge className="absolute top-2 right-2 bg-black/60">
                            +{post.images - 1} more
                          </Badge>
                        )}
                      </div>
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground mb-1">{post.date}</p>
                        <h4 className="font-medium">{post.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1">{post.description}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="documents" className="space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold">Project Documents</h3>
                    <p className="text-sm text-muted-foreground">Contracts, permits, and project files</p>
                  </div>
                  <Button data-testid="button-upload-document">
                    <Plus className="h-4 w-4 mr-2" />
                    Upload Document
                  </Button>
                </div>

                <div className="grid gap-4">
                  {[
                    { id: 1, name: "Construction Contract.pdf", category: "Contracts", date: "Oct 1, 2025", size: "2.4 MB" },
                    { id: 2, name: "Building Permit.pdf", category: "Permits", date: "Oct 5, 2025", size: "1.1 MB" },
                    { id: 3, name: "Floor Plans v3.pdf", category: "Plans", date: "Oct 10, 2025", size: "5.2 MB" },
                    { id: 4, name: "Change Order #01.pdf", category: "Change Orders", date: "Nov 15, 2025", size: "890 KB" },
                    { id: 5, name: "Change Order #02.pdf", category: "Change Orders", date: "Nov 28, 2025", size: "1.2 MB" },
                    { id: 6, name: "Material Specifications.pdf", category: "Specifications", date: "Oct 8, 2025", size: "3.7 MB" }
                  ].map((doc) => (
                    <Card key={doc.id} className="hover:bg-muted/50 transition-colors cursor-pointer" data-testid={`card-document-${doc.id}`}>
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                            <span className="text-red-600 text-xs font-bold">PDF</span>
                          </div>
                          <div>
                            <p className="font-medium">{doc.name}</p>
                            <p className="text-sm text-muted-foreground">{doc.category} • {doc.date}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-muted-foreground">{doc.size}</span>
                          <Button variant="ghost" size="sm">Download</Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
