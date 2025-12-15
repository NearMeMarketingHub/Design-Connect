import { useState, useRef, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import ImageViewerModal from "@/components/image-viewer-modal";
import DocumentViewerModal from "@/components/document-viewer-modal";
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
  Mail,
  X,
  ChevronDown,
  Reply,
  File,
  Upload,
  FolderOpen
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
  { id: 1, name: "Project Kickoff", date: "Oct 1, 2025", status: "completed", description: "Initial meeting and project scope finalized", 
    details: "Met with homeowners to review final plans and material selections. Discussed timeline expectations and communication preferences. Site access arranged and temporary utilities confirmed.", 
    tasks: ["Contract signed", "Deposit received", "Permits submitted"] },
  { id: 2, name: "Demolition Complete", date: "Oct 15, 2025", status: "completed", description: "All demo work finished, site cleared",
    details: "Removed existing kitchen cabinets, flooring, and non-load-bearing wall between kitchen and dining room. Debris hauled and site cleaned for framing crew.",
    tasks: ["Kitchen demo complete", "Wall removal done", "Debris removed", "Site cleaned"] },
  { id: 3, name: "Framing Inspection", date: "Nov 8, 2025", status: "completed", description: "Structural framing passed inspection",
    details: "City inspector approved all structural framing including the new header for the open floor plan. Minor corrections made to one joist hanger.",
    tasks: ["Headers installed", "Joists secured", "Inspection passed"] },
  { id: 4, name: "Rough-in Complete", date: "Dec 20, 2025", status: "in_progress", description: "Electrical, plumbing, and HVAC rough-ins",
    details: "Electrical panel upgraded to 200A. New circuits run for kitchen appliances. Plumbing relocated for island sink. HVAC ductwork modified for open floor plan.",
    tasks: ["Electrical 80% complete", "Plumbing 90% complete", "HVAC modifications done", "Awaiting inspection"] },
  { id: 5, name: "Drywall Installation", date: "Jan 10, 2026", status: "upcoming", description: "Drywall hanging and mudding",
    details: "Drywall crew scheduled for 5-day install. Includes hanging, taping, mudding, and sanding. Ceiling texture to match existing areas.",
    tasks: ["Schedule drywall crew", "Order materials", "Hang drywall", "Tape and mud", "Sand and prep"] },
  { id: 6, name: "Finish Work Begins", date: "Feb 1, 2026", status: "upcoming", description: "Cabinets, trim, and fixtures",
    details: "Cabinet installation followed by countertop templating. Trim carpentry includes baseboards, crown molding, and window casings. Light fixtures and plumbing fixtures installed.",
    tasks: ["Install cabinets", "Template countertops", "Install trim", "Paint walls", "Install fixtures"] },
  { id: 7, name: "Final Inspection", date: "Mar 1, 2026", status: "upcoming", description: "Final city inspection",
    details: "City inspector will verify all permitted work meets code. Includes electrical, plumbing, mechanical, and structural sign-offs.",
    tasks: ["Schedule inspection", "Prep checklist", "Address any corrections"] },
  { id: 8, name: "Project Handover", date: "Mar 15, 2026", status: "upcoming", description: "Keys delivered, warranty begins",
    details: "Final walkthrough with homeowners to review all completed work. Warranty documentation provided. Maintenance instructions for new systems and finishes.",
    tasks: ["Final cleaning", "Walkthrough scheduled", "Warranty docs prepared", "Keys delivered"] }
];

type LocalMessage = {
  id: string;
  sender: string;
  avatar: string;
  message: string;
  time: string;
  isOwn: boolean;
  isSystem?: boolean;
  attachment?: { type: 'image' | 'file'; src: string; name: string };
  replyTo?: { id: string; sender: string; message: string; image?: { src: string; title: string } };
};

const PROGRESS_PHOTOS = [
  { id: 1, date: "Dec 10, 2025", title: "Kitchen Framing", description: "Island framing complete", category: "Framing" },
  { id: 2, date: "Dec 8, 2025", title: "Electrical Rough-in", description: "Panel installed, main runs complete", category: "Electrical" },
  { id: 3, date: "Dec 5, 2025", title: "Plumbing Rough-in", description: "Supply lines to all fixtures", category: "Plumbing" },
  { id: 4, date: "Nov 28, 2025", title: "HVAC Ductwork", description: "Main trunk and branch lines", category: "HVAC" },
  { id: 5, date: "Nov 15, 2025", title: "Framing Complete", description: "All walls and ceiling joists done", category: "Framing" },
  { id: 6, date: "Nov 8, 2025", title: "Inspection Passed", description: "Structural inspection approved", category: "Inspection" }
];

const INITIAL_INSPIRATION_IMAGES = [
  { id: 1, title: "Kitchen Backsplash", category: "Kitchen", src: `https://picsum.photos/seed/${1 * 123}/400/400` },
  { id: 2, title: "Island Pendant Lights", category: "Kitchen", src: `https://picsum.photos/seed/${2 * 123}/400/400` },
  { id: 3, title: "Master Bath Tile", category: "Bathroom", src: `https://picsum.photos/seed/${3 * 123}/400/400` },
  { id: 4, title: "Hardwood Flooring", category: "Flooring", src: `https://picsum.photos/seed/${4 * 123}/400/400` },
  { id: 5, title: "Cabinet Hardware", category: "Kitchen", src: `https://picsum.photos/seed/${5 * 123}/400/400` },
  { id: 6, title: "Paint Colors", category: "General", src: `https://picsum.photos/seed/${6 * 123}/400/400` }
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
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState("overview");
  const [messageText, setMessageText] = useState("");
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerImages, setViewerImages] = useState<{ src: string; title?: string; description?: string }[]>([]);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);
  const [documentViewerOpen, setDocumentViewerOpen] = useState(false);
  const [documentToView, setDocumentToView] = useState<{ src: string; name: string; type: 'image' | 'file' } | null>(null);
  const [replyingToImage, setReplyingToImage] = useState<{ src: string; title: string; category: string } | null>(null);
  const [inspirationImages, setInspirationImages] = useState(INITIAL_INSPIRATION_IMAGES);
  const [expandedMilestones, setExpandedMilestones] = useState<number[]>([]);
  const [replyingToMessage, setReplyingToMessage] = useState<{ id: string; sender: string; message: string } | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<{ type: 'image' | 'file'; src: string; name: string } | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<{ type: 'image' | 'file'; src: string; name: string }[]>([
    { type: 'file', src: '#', name: 'Kitchen_Plans_v2.pdf' },
    { type: 'file', src: '#', name: 'Material_Selections.xlsx' },
    { type: 'image', src: 'https://picsum.photos/seed/upload1/200/200', name: 'Tile_Sample_1.jpg' },
    { type: 'image', src: 'https://picsum.photos/seed/upload2/200/200', name: 'Cabinet_Reference.png' },
  ]);
  const [attachmentPopoverOpen, setAttachmentPopoverOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageAttachmentInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const hasScrolledToBottom = useRef(false);

  // Fetch messages from API
  const { data: apiMessages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['/api/projects', projectId, 'messages'],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/messages`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!projectId,
  });

  // Transform API messages to local format
  const messages: LocalMessage[] = apiMessages.map((msg: any) => ({
    id: msg.id,
    sender: msg.senderName,
    avatar: msg.senderAvatar || msg.senderName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2),
    message: msg.content,
    time: new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
    isOwn: msg.senderName === 'You' || msg.senderId === 'current-user' || msg.isOwn,
    isSystem: msg.isSystem,
    ...(msg.attachmentUrl && {
      attachment: {
        type: msg.attachmentType as 'image' | 'file',
        src: msg.attachmentUrl,
        name: msg.attachmentName || 'Attachment'
      }
    }),
    ...((msg.replyToId || msg.replyToImageUrl) && {
      replyTo: {
        id: msg.replyToId || '',
        sender: msg.replyToSender || '',
        message: msg.replyToContent || '',
        ...(msg.replyToImageUrl && {
          image: { src: msg.replyToImageUrl, title: msg.replyToImageTitle || '' }
        })
      }
    })
  }));

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (messageData: any) => {
      const res = await fetch(`/api/projects/${projectId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messageData)
      });
      if (!res.ok) throw new Error('Failed to send message');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'messages'] });
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  });

  // Scroll to bottom when messages load or tab changes
  useEffect(() => {
    if (messages.length > 0 && messagesContainerRef.current && activeTab === 'messages') {
      // Use requestAnimationFrame to ensure layout is complete
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
          }
        });
      });
    }
  }, [messages, activeTab]);

  const toggleMilestone = (id: number) => {
    setExpandedMilestones(prev => 
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const sendMessage = () => {
    if (!messageText.trim() && !pendingAttachment && !replyingToImage) return;
    
    const messageData = {
      projectId,
      senderId: 'current-user',
      senderName: 'You',
      senderAvatar: 'SJ',
      content: messageText.trim() || ' ',
      ...(pendingAttachment && {
        attachmentType: pendingAttachment.type,
        attachmentUrl: pendingAttachment.src,
        attachmentName: pendingAttachment.name
      }),
      ...(replyingToMessage && {
        replyToId: replyingToMessage.id,
        replyToSender: replyingToMessage.sender,
        replyToContent: replyingToMessage.message
      }),
      ...(replyingToImage && {
        replyToImageUrl: replyingToImage.src,
        replyToImageTitle: replyingToImage.title
      })
    };
    
    sendMessageMutation.mutate(messageData);
    setMessageText("");
    setPendingAttachment(null);
    setReplyingToMessage(null);
    setReplyingToImage(null);
  };

  const handleMessageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const isImage = file.type.startsWith('image/');
    const newFile = {
      type: isImage ? 'image' as const : 'file' as const,
      src: URL.createObjectURL(file),
      name: file.name
    };
    
    setPendingAttachment(newFile);
    setUploadedFiles(prev => [...prev, newFile]);
    setAttachmentPopoverOpen(false);
    
    if (messageAttachmentInputRef.current) {
      messageAttachmentInputRef.current.value = "";
    }
  };
  
  const selectExistingFile = (file: { type: 'image' | 'file'; src: string; name: string }) => {
    setPendingAttachment(file);
    setAttachmentPopoverOpen(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    const newImages = Array.from(files).map((file, index) => {
      const id = Date.now() + index;
      const fileName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      const title = fileName.charAt(0).toUpperCase() + fileName.slice(1);
      return {
        id,
        title,
        category: "Uploaded",
        src: URL.createObjectURL(file)
      };
    });
    
    setInspirationImages(prev => [...prev, ...newImages]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

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
            <input 
              type="file" 
              ref={fileInputRef}
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileUpload}
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
              {inspirationImages.map((img, index) => (
                <div 
                  key={img.id} 
                  className="group relative aspect-square bg-muted rounded-lg overflow-hidden border border-border cursor-pointer hover:border-primary transition-colors"
                  data-testid={`card-inspiration-${img.id}`}
                  onClick={() => openImageViewer(
                    inspirationImages.map(i => ({
                      src: i.src,
                      title: i.title,
                      description: i.category
                    })),
                    index
                  )}
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
                      onClick={(e) => {
                        e.stopPropagation();
                        setReplyingToImage({
                          src: img.src,
                          title: img.title,
                          category: img.category
                        });
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
                onClick={() => fileInputRef.current?.click()}
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
                  {MILESTONES.map((milestone, index) => {
                    const isExpanded = expandedMilestones.includes(milestone.id);
                    return (
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
                            <div className="text-right flex-shrink-0 ml-4">
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
                          
                          {/* Expanded content */}
                          <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
                            isExpanded ? 'max-h-96 opacity-100 mt-3' : 'max-h-0 opacity-0'
                          }`}>
                            <div className="ml-6 pl-4 border-l-2 border-muted space-y-3">
                              <p className="text-sm text-muted-foreground">{milestone.details}</p>
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-2">Tasks:</p>
                                <div className="space-y-1">
                                  {milestone.tasks.map((task, taskIndex) => (
                                    <div key={taskIndex} className="flex items-center gap-2 text-sm">
                                      <CheckCircle2 className={`w-3.5 h-3.5 ${
                                        milestone.status === 'completed' ? 'text-green-500' : 
                                        milestone.status === 'in_progress' && taskIndex < 2 ? 'text-green-500' :
                                        'text-muted-foreground/40'
                                      }`} />
                                      <span className={milestone.status === 'completed' || (milestone.status === 'in_progress' && taskIndex < 2) ? '' : 'text-muted-foreground'}>
                                        {task}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* MESSAGES TAB */}
          <TabsContent value="messages" className="space-y-6">
            <input 
              type="file" 
              ref={messageAttachmentInputRef}
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              onChange={handleMessageFileUpload}
            />
            <Card className="h-[calc(100vh-200px)] min-h-[500px] flex flex-col">
              <CardHeader className="border-b border-border py-4">
                <CardTitle className="text-lg">Project Communication</CardTitle>
                <CardDescription>Chat with your project team</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden p-0">
                <div ref={messagesContainerRef} className="h-full overflow-y-auto p-4 space-y-4">
                {messages.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`group flex gap-3 ${msg.isOwn ? 'flex-row-reverse' : ''}`}
                    data-testid={`message-${msg.id}`}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className={msg.isSystem ? 'bg-primary/20 text-primary' : ''}>
                        {msg.avatar}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`max-w-[80%] ${msg.isSystem ? 'w-full' : ''}`}>
                      {msg.isSystem ? (
                        <div className="bg-primary/10 border border-primary/20 p-3 rounded-lg flex items-center gap-3">
                          <AlertCircle className="h-5 w-5 text-primary flex-shrink-0" />
                          <div>
                            <p className="text-sm">{msg.message}</p>
                            <span className="text-xs text-muted-foreground mt-1 block">{msg.time}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="relative">
                          {/* Reply to preview */}
                          {msg.replyTo && (
                            <div className={`mb-1 p-2 rounded-t-lg border-l-2 border-primary/50 ${
                              msg.isOwn ? 'bg-primary/20' : 'bg-muted/80'
                            }`}>
                              {msg.replyTo.image ? (
                                <div className="flex items-center gap-2">
                                  <img 
                                    src={msg.replyTo.image.src} 
                                    alt={msg.replyTo.image.title}
                                    className="w-10 h-10 object-cover rounded cursor-pointer"
                                    onClick={() => openImageViewer([{ src: msg.replyTo!.image!.src, title: msg.replyTo!.image!.title }], 0)}
                                  />
                                  <span className="text-xs text-muted-foreground">{msg.replyTo.image.title}</span>
                                </div>
                              ) : (
                                <>
                                  <p className="text-xs font-medium text-primary">{msg.replyTo.sender}</p>
                                  <p className="text-xs text-muted-foreground truncate">{msg.replyTo.message}</p>
                                </>
                              )}
                            </div>
                          )}
                          
                          <div className={`p-3 rounded-lg ${
                            msg.isOwn 
                              ? 'bg-primary text-primary-foreground rounded-tr-none' 
                              : 'bg-muted rounded-tl-none'
                          } ${msg.replyTo ? 'rounded-t-none' : ''}`}>
                            {/* Attachment preview */}
                            {msg.attachment && (
                              <div className="mb-2">
                                {msg.attachment.type === 'image' ? (
                                  <img 
                                    src={msg.attachment.src} 
                                    alt={msg.attachment.name}
                                    className="max-w-full max-h-48 rounded cursor-pointer hover:opacity-90"
                                    onClick={() => openImageViewer([{ src: msg.attachment!.src, title: msg.attachment!.name }], 0)}
                                  />
                                ) : (
                                  <div 
                                    className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:opacity-80 transition-opacity ${
                                      msg.isOwn ? 'bg-primary-foreground/10' : 'bg-background'
                                    }`}
                                    onClick={() => {
                                      setDocumentToView({ src: msg.attachment!.src, name: msg.attachment!.name, type: msg.attachment!.type });
                                      setDocumentViewerOpen(true);
                                    }}
                                  >
                                    <File className="w-4 h-4" />
                                    <span className="text-sm truncate underline">{msg.attachment.name}</span>
                                  </div>
                                )}
                              </div>
                            )}
                            {msg.message && <p className="text-sm">{msg.message}</p>}
                            <span className={`text-xs mt-1 block ${
                              msg.isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
                            }`}>
                              {msg.sender} • {msg.time}
                            </span>
                          </div>
                          
                          {/* Reply button */}
                          {!msg.isSystem && !msg.isOwn && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute -right-10 top-1/2 -translate-y-1/2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => setReplyingToMessage({ id: msg.id, sender: msg.sender, message: msg.message })}
                              data-testid={`button-reply-${msg.id}`}
                            >
                              <Reply className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
                </div>
              </CardContent>
              <div className="p-4 border-t border-border bg-muted/10">
                {/* Replying to message preview */}
                {replyingToMessage && (
                  <div className="mb-3 flex items-start gap-3 p-2 bg-muted rounded-lg border border-border border-l-4 border-l-primary">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-primary">Replying to {replyingToMessage.sender}</p>
                      <p className="text-sm text-muted-foreground truncate">{replyingToMessage.message}</p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 shrink-0"
                      onClick={() => setReplyingToMessage(null)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
                
                {/* Replying to image preview */}
                {replyingToImage && (
                  <div className="mb-3 flex items-start gap-3 p-2 bg-muted rounded-lg border border-border">
                    <img 
                      src={replyingToImage.src} 
                      alt={replyingToImage.title}
                      className="w-16 h-16 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => openImageViewer([{ 
                        src: replyingToImage.src, 
                        title: replyingToImage.title, 
                        description: replyingToImage.category 
                      }], 0)}
                      data-testid="img-reply-preview"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{replyingToImage.title}</p>
                      <p className="text-xs text-muted-foreground">{replyingToImage.category}</p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 shrink-0"
                      onClick={() => setReplyingToImage(null)}
                      data-testid="button-clear-reply"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
                
                {/* Pending attachment preview */}
                {pendingAttachment && (
                  <div className="mb-3 flex items-start gap-3 p-2 bg-muted rounded-lg border border-border">
                    {pendingAttachment.type === 'image' ? (
                      <img 
                        src={pendingAttachment.src} 
                        alt={pendingAttachment.name}
                        className="w-16 h-16 object-cover rounded"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-background rounded flex items-center justify-center">
                        <File className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{pendingAttachment.name}</p>
                      <p className="text-xs text-muted-foreground">{pendingAttachment.type === 'image' ? 'Image' : 'File'} attached</p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 shrink-0"
                      onClick={() => setPendingAttachment(null)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
                
                <div className="flex gap-2">
                  <Popover open={attachmentPopoverOpen} onOpenChange={setAttachmentPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        data-testid="button-attach"
                        className="hover:bg-muted transition-colors"
                      >
                        <Paperclip className="w-4 h-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-0" align="start" side="top">
                      <div className="p-3 border-b border-border">
                        <p className="text-sm font-medium">Add Attachment</p>
                      </div>
                      <div className="p-2">
                        <Button
                          variant="ghost"
                          className="w-full justify-start gap-2 h-10"
                          onClick={() => messageAttachmentInputRef.current?.click()}
                          data-testid="button-upload-new"
                        >
                          <Upload className="w-4 h-4" />
                          Upload New File
                        </Button>
                      </div>
                      {uploadedFiles.length > 0 && (
                        <>
                          <div className="px-3 py-2 border-t border-border">
                            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                              <FolderOpen className="w-3 h-3" />
                              Recent Uploads
                            </p>
                          </div>
                          <div className="max-h-48 overflow-y-auto p-2 space-y-1">
                            {uploadedFiles.map((file, index) => (
                              <Button
                                key={index}
                                variant="ghost"
                                className="w-full justify-start gap-2 h-auto py-2"
                                onClick={() => selectExistingFile(file)}
                                data-testid={`button-select-file-${index}`}
                              >
                                {file.type === 'image' ? (
                                  <img 
                                    src={file.src} 
                                    alt={file.name}
                                    className="w-8 h-8 object-cover rounded"
                                  />
                                ) : (
                                  <div className="w-8 h-8 bg-muted rounded flex items-center justify-center">
                                    <File className="w-4 h-4 text-muted-foreground" />
                                  </div>
                                )}
                                <span className="text-sm truncate flex-1 text-left">{file.name}</span>
                              </Button>
                            ))}
                          </div>
                        </>
                      )}
                    </PopoverContent>
                  </Popover>
                  <Textarea 
                    placeholder={
                      replyingToImage ? `Comment on "${replyingToImage.title}"...` : 
                      replyingToMessage ? `Reply to ${replyingToMessage.sender}...` :
                      "Type a message..."
                    } 
                    className="min-h-[60px] flex-1 resize-none py-3"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    data-testid="input-message"
                  />
                  <Button 
                    size="icon" 
                    data-testid="button-send-message"
                    onClick={sendMessage}
                    disabled={!messageText.trim() && !pendingAttachment && !replyingToImage}
                    className="hover:bg-primary/90 transition-colors"
                  >
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

      {/* Document Viewer Modal */}
      <DocumentViewerModal
        document={documentToView}
        isOpen={documentViewerOpen}
        onClose={() => setDocumentViewerOpen(false)}
      />
    </div>
  );
}
