import { useState } from "react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import ImageViewerModal from "@/components/image-viewer-modal";
import { 
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Image as ImageIcon,
  MapPin,
  MessageSquare,
  Paperclip,
  Plus,
  Send,
  TrendingUp,
  Users,
  Camera,
  Milestone,
  FileText,
  AlertCircle,
  Phone,
  Mail
} from "lucide-react";
import projectImage from "@assets/generated_images/modern_luxury_home_interior_with_natural_light.png";
import blueprintImage from "@assets/generated_images/construction_blueprints_and_hard_hat_on_table.png";

const PROJECTS_DATA: Record<string, {
  id: string;
  name: string;
  address: string;
  status: string;
  phase: string;
  progress: number;
  image: string;
  nextMilestone: string;
  dueDate: string;
  budget: number;
  spent: number;
  startDate: string;
  endDate: string;
  description: string;
}> = {
  jenkins: {
    id: "jenkins",
    name: "The Jenkins Residence",
    address: "123 Maple Avenue",
    status: "Active",
    phase: "Phase 3: Rough-in",
    progress: 45,
    image: projectImage,
    nextMilestone: "Drywall Inspection",
    dueDate: "Jan 15, 2026",
    budget: 145000,
    spent: 62350,
    startDate: "Oct 1, 2025",
    endDate: "Mar 15, 2026",
    description: "Complete home renovation including kitchen remodel, bathroom upgrades, and open floor plan conversion."
  },
  lakehouse: {
    id: "lakehouse",
    name: "Lake House Retreat",
    address: "889 Shoreline Drive",
    status: "Planning",
    phase: "Phase 1: Design",
    progress: 15,
    image: blueprintImage,
    nextMilestone: "Permit Approval",
    dueDate: "Mar 01, 2026",
    budget: 285000,
    spent: 15200,
    startDate: "Jan 15, 2026",
    endDate: "Aug 30, 2026",
    description: "New construction lakefront property with modern design and sustainable features."
  },
  loft: {
    id: "loft",
    name: "Downtown Loft",
    address: "450 Main St, Unit 4B",
    status: "Completed",
    phase: "Handover",
    progress: 100,
    image: projectImage,
    nextMilestone: "Warranty Check",
    dueDate: "Completed",
    budget: 78500,
    spent: 76200,
    startDate: "Jun 1, 2025",
    endDate: "Sep 30, 2025",
    description: "Industrial loft conversion with exposed brick, modern kitchen, and custom built-ins."
  }
};

const MILESTONES = [
  { id: 1, name: "Project Kickoff", date: "Oct 1, 2025", status: "completed", description: "Initial meeting and project scope finalized" },
  { id: 2, name: "Demolition Complete", date: "Oct 15, 2025", status: "completed", description: "All demo work finished, site cleared" },
  { id: 3, name: "Framing Inspection", date: "Nov 8, 2025", status: "completed", description: "Structural framing passed inspection" },
  { id: 4, name: "Rough-in Complete", date: "Dec 20, 2025", status: "in_progress", description: "Electrical, plumbing, and HVAC rough-ins" },
  { id: 5, name: "Drywall Installation", date: "Jan 10, 2026", status: "upcoming", description: "Drywall hanging and mudding" },
  { id: 6, name: "Finish Work Begins", date: "Feb 1, 2026", status: "upcoming", description: "Cabinets, trim, and fixtures" },
  { id: 7, name: "Final Inspection", date: "Mar 1, 2026", status: "upcoming", description: "Final city inspection" },
  { id: 8, name: "Project Handover", date: "Mar 15, 2026", status: "upcoming", description: "Keys delivered, warranty begins" }
];

const MESSAGES = [
  { id: 1, sender: "Mike Builder", role: "Project Manager", avatar: "MB", message: "Hi Sarah, just wanted to let you know the tile samples arrived. I'll leave them on the counter for you to check out this weekend.", time: "10:30 AM", isOwn: false },
  { id: 2, sender: "You", role: "", avatar: "SJ", message: "Thanks Mike! We'll swing by Saturday morning. Are the new lighting fixtures there too?", time: "10:45 AM", isOwn: true },
  { id: 3, sender: "Mike Builder", role: "Project Manager", avatar: "MB", message: "Yes, the pendant lights are in box 4 in the garage. Let me know if you want to open them up.", time: "10:48 AM", isOwn: false },
  { id: 4, sender: "System", role: "", avatar: "SYS", message: "New plan uploaded: A2.1 - Elevations (Rev 2). Please review and approve.", time: "Yesterday", isOwn: false, isSystem: true }
];

const PROGRESS_PHOTOS = [
  { id: 1, date: "Dec 10, 2025", title: "Kitchen Framing", description: "Island framing complete", category: "Framing" },
  { id: 2, date: "Dec 8, 2025", title: "Electrical Rough-in", description: "Panel installed, main runs complete", category: "Electrical" },
  { id: 3, date: "Dec 5, 2025", title: "Plumbing Rough-in", description: "Supply lines to all fixtures", category: "Plumbing" },
  { id: 4, date: "Nov 28, 2025", title: "HVAC Ductwork", description: "Main trunk and branch lines", category: "HVAC" },
  { id: 5, date: "Nov 15, 2025", title: "Framing Complete", description: "All walls and ceiling joists done", category: "Framing" },
  { id: 6, date: "Nov 8, 2025", title: "Inspection Passed", description: "Structural inspection approved", category: "Inspection" }
];

const INSPIRATION_IMAGES = [
  { id: 1, title: "Kitchen Backsplash", category: "Kitchen", status: "approved" },
  { id: 2, title: "Island Pendant Lights", category: "Kitchen", status: "approved" },
  { id: 3, title: "Master Bath Tile", category: "Bathroom", status: "reviewing" },
  { id: 4, title: "Hardwood Flooring", category: "Flooring", status: "approved" },
  { id: 5, title: "Cabinet Hardware", category: "Kitchen", status: "reviewing" },
  { id: 6, title: "Paint Colors", category: "General", status: "approved" }
];

const TEAM_MEMBERS = [
  { id: 1, name: "Mike Builder", role: "Project Manager", initials: "MB", email: "mike@buildvision.com", phone: "(555) 123-4567" },
  { id: 2, name: "Jane Design", role: "Lead Designer", initials: "JD", email: "jane@buildvision.com", phone: "(555) 234-5678" },
  { id: 3, name: "Tom Electric", role: "Electrician", initials: "TE", email: "tom@buildvision.com", phone: "(555) 345-6789" }
];

export default function ProjectDetails() {
  const params = useParams<{ id: string }>();
  const projectId = params.id || "";
  const project = PROJECTS_DATA[projectId];
  
  const [activeTab, setActiveTab] = useState("overview");
  const [messageText, setMessageText] = useState("");
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerImages, setViewerImages] = useState<{ src: string; title?: string; description?: string }[]>([]);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);

  const openImageViewer = (images: { src: string; title?: string; description?: string }[], startIndex = 0) => {
    setViewerImages(images);
    setViewerInitialIndex(startIndex);
    setViewerOpen(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
  };

  const getPhaseName = (phase: string) => {
    if (phase.includes(':')) {
      const parts = phase.split(':');
      return parts[1]?.trim() || phase;
    }
    return phase;
  };

  if (!project) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/my-projects">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-heading font-bold">Project Not Found</h1>
        </div>
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Project Not Found</h2>
            <p className="text-muted-foreground mb-4">
              The project you're looking for doesn't exist or you don't have access to it.
            </p>
            <Link href="/my-projects">
              <Button data-testid="button-back-to-projects">Back to My Projects</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Back Navigation */}
      <div className="flex items-center gap-4">
        <Link href="/my-projects">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-heading font-bold" data-testid="text-project-name">{project.name}</h1>
            <Badge className={`${
              project.status === 'Active' ? 'bg-green-500 hover:bg-green-600' :
              project.status === 'Planning' ? 'bg-blue-500 hover:bg-blue-600' :
              'bg-slate-500 hover:bg-slate-600'
            } border-0`} data-testid="badge-project-status">
              {project.status}
            </Badge>
          </div>
          <div className="flex items-center text-muted-foreground text-sm mt-1">
            <MapPin className="w-4 h-4 mr-1" />
            <span data-testid="text-project-address">{project.address}</span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
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
        </TabsList>

        <div className="mt-6">
          {/* OVERVIEW TAB */}
          <TabsContent value="overview" className="space-y-6">
            {/* Progress and Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card data-testid="card-stat-progress">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <TrendingUp className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Progress</p>
                      <p className="text-xl font-bold" data-testid="text-progress">{project.progress}%</p>
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
                      <p className="text-xl font-bold" data-testid="text-budget">{formatCurrency(project.budget)}</p>
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
                      <p className="text-xl font-bold" data-testid="text-spent">{formatCurrency(project.spent)}</p>
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
                      <p className="text-xl font-bold" data-testid="text-end-date">{project.endDate}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Main Content Grid */}
            <div className="grid md:grid-cols-3 gap-6">
              {/* Left Column - Main Info */}
              <div className="md:col-span-2 space-y-6">
                {/* Current Phase Card */}
                <Card data-testid="card-current-phase">
                  <CardHeader>
                    <CardTitle>Current Phase: {getPhaseName(project.phase)}</CardTitle>
                    <CardDescription>{project.phase}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <img 
                      src={project.image} 
                      alt="Project Progress" 
                      className="w-full h-48 md:h-64 object-cover rounded-md cursor-pointer hover:opacity-90 transition-opacity"
                      data-testid="img-project-hero"
                    />
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-muted-foreground">Overall Progress</span>
                        <span className="font-medium">{project.progress}%</span>
                      </div>
                      <Progress value={project.progress} className="h-2" />
                    </div>
                    <p className="text-sm text-muted-foreground" data-testid="text-description">
                      {project.description}
                    </p>
                  </CardContent>
                </Card>

                {/* Next Milestone */}
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
                          <p className="font-medium" data-testid="text-next-milestone">{project.nextMilestone}</p>
                          <p className="text-sm text-muted-foreground">Target: {project.dueDate}</p>
                        </div>
                      </div>
                      <Badge variant="outline">Upcoming</Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column - Team and Quick Links */}
              <div className="space-y-6">
                {/* Team Card */}
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
                                data-testid={`link-email-${member.id}`}
                              >
                                <Mail className="h-4 w-4" />
                                {member.email}
                              </a>
                              <a 
                                href={`tel:${member.phone}`} 
                                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                                data-testid={`link-phone-${member.id}`}
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

                {/* Project Dates */}
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
                      <span className="font-medium" data-testid="text-start-date">{project.startDate}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Target End</span>
                      <span className="font-medium">{project.endDate}</span>
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

          {/* INSPIRATION & SELECTIONS TAB */}
          <TabsContent value="inspiration" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">Inspiration & Selections</h3>
                <p className="text-sm text-muted-foreground">Upload inspiration photos and track material selections</p>
              </div>
              <Button data-testid="button-upload-inspiration">
                <Plus className="h-4 w-4 mr-2" />
                Upload Image
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {INSPIRATION_IMAGES.map((img, index) => (
                <div 
                  key={img.id} 
                  className="group relative aspect-square bg-muted rounded-lg overflow-hidden border border-border cursor-pointer hover:border-primary transition-colors"
                  data-testid={`card-inspiration-${img.id}`}
                  onClick={() => openImageViewer(
                    INSPIRATION_IMAGES.map(i => ({
                      src: `https://picsum.photos/seed/${i.id * 123}/400/400`,
                      title: i.title,
                      description: i.category
                    })),
                    index
                  )}
                >
                  <img 
                    src={`https://picsum.photos/seed/${img.id * 123}/400/400`} 
                    alt={img.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button 
                      size="icon" 
                      variant="secondary" 
                      data-testid={`button-comment-inspiration-${img.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setMessageText(`Regarding "${img.title}" (${img.category}): `);
                        setActiveTab("messages");
                      }}
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
              
              {/* Upload Placeholder */}
              <div 
                className="aspect-square border-2 border-dashed border-muted-foreground/30 rounded-lg flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/50 cursor-pointer transition-colors"
                data-testid="button-add-inspiration"
              >
                <Plus className="w-8 h-8 mb-2" />
                <span className="text-sm font-medium">Add Image</span>
              </div>
            </div>
          </TabsContent>

          {/* TIMELINE TAB */}
          <TabsContent value="timeline" className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold">Project Timeline</h3>
              <p className="text-sm text-muted-foreground">Track milestones and project phases</p>
            </div>

            <Card>
              <CardContent className="p-6">
                <div className="relative">
                  {MILESTONES.map((milestone, index) => (
                    <div key={milestone.id} className="flex gap-4 pb-8 last:pb-0" data-testid={`milestone-${milestone.id}`}>
                      {/* Timeline line and dot */}
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
                      
                      {/* Milestone content */}
                      <div className="flex-1 pb-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium">{milestone.name}</h4>
                            <p className="text-sm text-muted-foreground">{milestone.description}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">{milestone.date}</p>
                            <Badge 
                              variant={milestone.status === 'completed' ? 'default' : 'outline'}
                              className={`text-xs mt-1 ${
                                milestone.status === 'completed' ? 'bg-green-500' :
                                milestone.status === 'in_progress' ? 'border-primary text-primary' :
                                ''
                              }`}
                              data-testid={`badge-milestone-status-${milestone.id}`}
                            >
                              {milestone.status === 'completed' ? 'Complete' :
                               milestone.status === 'in_progress' ? 'In Progress' : 'Upcoming'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* MESSAGES TAB */}
          <TabsContent value="messages" className="space-y-6">
            <Card className="h-[calc(100vh-200px)] min-h-[500px] flex flex-col">
              <CardHeader className="border-b border-border py-4">
                <CardTitle className="text-lg">Project Communication</CardTitle>
                <CardDescription>Chat with your project team</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                {MESSAGES.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`flex gap-3 ${msg.isOwn ? 'flex-row-reverse' : ''}`}
                    data-testid={`message-${msg.id}`}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className={msg.isSystem ? 'bg-primary/20 text-primary' : ''}>
                        {msg.avatar}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`max-w-[80%] ${
                      msg.isSystem ? 'w-full' : ''
                    }`}>
                      {msg.isSystem ? (
                        <div className="bg-primary/10 border border-primary/20 p-3 rounded-lg flex items-center gap-3">
                          <AlertCircle className="h-5 w-5 text-primary flex-shrink-0" />
                          <div>
                            <p className="text-sm">{msg.message}</p>
                            <span className="text-xs text-muted-foreground mt-1 block">{msg.time}</span>
                          </div>
                        </div>
                      ) : (
                        <div className={`p-3 rounded-lg ${
                          msg.isOwn 
                            ? 'bg-primary text-primary-foreground rounded-tr-none' 
                            : 'bg-muted rounded-tl-none'
                        }`}>
                          <p className="text-sm">{msg.message}</p>
                          <span className={`text-xs mt-1 block ${
                            msg.isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
                          }`}>
                            {msg.sender} • {msg.time}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
              <div className="p-4 border-t border-border bg-muted/10">
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" data-testid="button-attach-file">
                    <Paperclip className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" data-testid="button-attach-image">
                    <ImageIcon className="w-4 h-4" />
                  </Button>
                  <Textarea 
                    placeholder="Type a message..." 
                    className="min-h-[60px] flex-1 resize-none py-3"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    data-testid="input-message"
                  />
                  <Button size="icon" data-testid="button-send-message">
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* PROGRESS PHOTOS TAB */}
          <TabsContent value="progress" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">Progress Photos</h3>
                <p className="text-sm text-muted-foreground">Build documentation and site photos from your contractor</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {PROGRESS_PHOTOS.map((photo, index) => (
                <Card 
                  key={photo.id} 
                  className="group overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                  data-testid={`card-progress-photo-${photo.id}`}
                  onClick={() => openImageViewer(
                    PROGRESS_PHOTOS.map(p => ({
                      src: `https://picsum.photos/seed/${p.id * 456}/600/400`,
                      title: p.title,
                      description: `${p.description} - ${p.date}`
                    })),
                    index
                  )}
                >
                  <div className="aspect-video relative overflow-hidden bg-muted">
                    <img 
                      src={`https://picsum.photos/seed/${photo.id * 456}/600/400`}
                      alt={photo.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button variant="secondary" size="sm">
                        <Camera className="w-4 h-4 mr-2" />
                        View Photo
                      </Button>
                    </div>
                    <Badge className="absolute top-2 right-2 bg-black/60 border-0">
                      {photo.category}
                    </Badge>
                  </div>
                  <CardContent className="p-4">
                    <h4 className="font-medium">{photo.title}</h4>
                    <p className="text-sm text-muted-foreground">{photo.description}</p>
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {photo.date}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </div>
      </Tabs>

      {/* Image Viewer Modal */}
      <ImageViewerModal
        images={viewerImages}
        initialIndex={viewerInitialIndex}
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />
    </div>
  );
}
