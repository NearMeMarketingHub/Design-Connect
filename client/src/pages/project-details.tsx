import { useState, useRef, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { getInitials } from "@/lib/utils";
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
import SendForSignatureDialog from "@/components/send-for-signature-dialog";
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
  FolderOpen,
  MoreVertical,
  Pencil,
  Trash2,
  Check,
  CheckCheck,
  Heart,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  Layers,
  Shield,
  Receipt,
  BookOpen,
  Settings
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ChatPanel } from "@/components/ChatPanel";
import { SignatureFieldEditor, SignatureField } from "@/components/signature-field-editor";
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

// Milestone descriptions mapped to the actual phase names used in the system
const MILESTONE_DESCRIPTIONS: Record<string, { description: string; details: string }> = {
  "Pre-Construction": { 
    description: "Initial planning and site preparation", 
    details: "Meet with homeowners to review final plans and material selections. Discuss timeline expectations and communication preferences. Site access arranged and temporary utilities confirmed." 
  },
  "Design": { 
    description: "Design development and finalization", 
    details: "Complete architectural and engineering drawings. Finalize material selections and specifications." 
  },
  "Permitting": { 
    description: "Building permits and approvals", 
    details: "Submit permit applications and obtain necessary approvals from local authorities." 
  },
  "Foundation": { 
    description: "Foundation and site work", 
    details: "Excavation, footings, and foundation construction. Site grading and drainage." 
  },
  "Framing": { 
    description: "Structural framing complete", 
    details: "Wall framing, floor joists, roof trusses, and structural sheathing installed." 
  },
  "Rough-in": { 
    description: "Electrical, plumbing, and HVAC rough-ins", 
    details: "Complete all rough-in work for electrical, plumbing, and HVAC systems." 
  },
  "Insulation": { 
    description: "Insulation installation", 
    details: "Install insulation in walls, ceilings, and floors for energy efficiency." 
  },
  "Drywall": { 
    description: "Drywall hanging and finishing", 
    details: "Drywall installation including hanging, taping, mudding, and sanding." 
  },
  "Finishing": { 
    description: "Cabinets, trim, and fixtures", 
    details: "Cabinet installation, trim carpentry, painting, and fixture installation." 
  },
  "Final Inspection": { 
    description: "Final city inspection", 
    details: "City inspector will verify all permitted work meets code." 
  },
  "Handover": { 
    description: "Keys delivered, warranty begins", 
    details: "Final walkthrough with homeowners to review all completed work." 
  },
  "Project Complete": { 
    description: "Project successfully completed", 
    details: "All work finished, inspections passed, and project closed out." 
  }
};

// Legacy MILESTONES array for backwards compatibility (not used for new phases)
const MILESTONES = [
  { id: 1, name: "Pre-Construction", date: "TBD", status: "upcoming", description: "Initial planning and site preparation", details: "", tasks: [] },
  { id: 2, name: "Design", date: "TBD", status: "upcoming", description: "Design development and finalization", details: "", tasks: [] },
  { id: 3, name: "Permitting", date: "TBD", status: "upcoming", description: "Building permits and approvals", details: "", tasks: [] },
  { id: 4, name: "Foundation", date: "TBD", status: "upcoming", description: "Foundation and site work", details: "", tasks: [] },
  { id: 5, name: "Framing", date: "TBD", status: "upcoming", description: "Structural framing complete", details: "", tasks: [] },
  { id: 6, name: "Rough-in", date: "TBD", status: "upcoming", description: "Electrical, plumbing, and HVAC rough-ins", details: "", tasks: [] },
  { id: 7, name: "Insulation", date: "TBD", status: "upcoming", description: "Insulation installation", details: "", tasks: [] },
  { id: 8, name: "Drywall", date: "TBD", status: "upcoming", description: "Drywall hanging and finishing", details: "", tasks: [] },
  { id: 9, name: "Finishing", date: "TBD", status: "upcoming", description: "Cabinets, trim, and fixtures", details: "", tasks: [] },
  { id: 10, name: "Final Inspection", date: "TBD", status: "upcoming", description: "Final city inspection", details: "", tasks: [] },
  { id: 11, name: "Handover", date: "TBD", status: "upcoming", description: "Keys delivered, warranty begins", details: "", tasks: [] },
  { id: 12, name: "Project Complete", date: "TBD", status: "upcoming", description: "Project successfully completed", details: "", tasks: [] }
];

type LocalMessage = {
  id: string;
  sender: string;
  avatar: string;
  message: string;
  time: string;
  isOwn: boolean;
  isSystem?: boolean;
  isRead?: boolean;
  isEdited?: boolean;
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

// Status and phase options for contractor editing
const PROJECT_STATUSES = ["Planning", "Active", "On Hold", "Completed"];
const PHASES_BY_STATUS: Record<string, string[]> = {
  "Planning": ["Pre-Construction", "Design Development", "Permitting"],
  "Active": ["Foundation", "Framing", "Rough-In", "Drywall", "Finishes", "Final Inspection", "Handover"],
  "On Hold": [], // No milestones - On Hold is a temporary pause state
  "Completed": ["Project Complete"]
};

// Get all unique phases including any custom/legacy phases
const getAllPhases = (status: string, currentPhase?: string): string[] => {
  const standardPhases = PHASES_BY_STATUS[status] || [];
  // Include the current phase if it's not in the standard list (for legacy/custom phases)
  if (currentPhase && !standardPhases.includes(currentPhase)) {
    return [currentPhase, ...standardPhases];
  }
  return standardPhases;
};

export default function ProjectDetails() {
  const params = useParams<{ id: string }>();
  const [location, setLocation] = useLocation();
  const projectId = params.id || "";
  const staticProject = PROJECTS_DATA[projectId];
  const queryClient = useQueryClient();
  const { user, currentPortal } = useAuth();
  
  // Contractor controls - check if user can edit this project
  const isContractorView = currentPortal === 'contractor' || currentPortal === 'admin';
  const canEdit = isContractorView && (user?.role === 'contractor' || user?.role === 'admin');
  
  // Get portal base path
  const getPortalPath = () => {
    if (currentPortal === 'admin') return '/admin';
    if (currentPortal === 'contractor') return '/contractor';
    return '/client';
  };
  const portalPath = getPortalPath();
  const projectBasePath = `${portalPath}/project/${projectId}`;
  
  // Get back path based on current portal
  const getBackPath = () => {
    if (currentPortal === 'admin') return '/admin/dashboard';
    if (currentPortal === 'contractor') return '/contractor/projects';
    return '/client/projects';
  };
  const backPath = getBackPath();
  
  // Determine active tab from URL path (strip query string first)
  const getTabFromPath = () => {
    const path = location.split('?')[0];
    if (path.endsWith('/progress')) return 'progress';
    if (path.endsWith('/documents')) return 'documents';
    if (path.endsWith('/messages')) return 'messages';
    if (path.endsWith('/budget')) return 'budget';
    if (path.endsWith('/timeline')) return 'timeline';
    if (path.endsWith('/inspiration')) return 'inspiration';
    if (path.endsWith('/contractor-photos')) return 'contractor-photos';
    if (path.endsWith('/action-center')) return 'action-center';
    return 'overview';
  };
  
  // Handle tab change - navigate to sub-page
  const handleTabChange = (tab: string) => {
    if (tab === 'overview') {
      setLocation(projectBasePath);
    } else {
      setLocation(`${projectBasePath}/${tab}`);
    }
  };
  
  // State for contractor editing
  const [isEditing, setIsEditing] = useState(false);
  const [editStatus, setEditStatus] = useState("");
  const [editPhase, setEditPhase] = useState("");
  const [editDescription, setEditDescription] = useState("");
  
  // Parse admin context from URL query parameter (needed before API call)
  const urlParams = new URLSearchParams(location.split('?')[1] || '');
  const isFromAdmin = urlParams.get('from') === 'admin';
  
  // Fetch project from API if not found in static data (for database projects)
  // Only use admin endpoint when coming from admin context
  const { data: apiProject, isLoading: projectLoading } = useQuery({
    queryKey: ['/api/admin/projects', projectId, isFromAdmin],
    queryFn: async () => {
      const endpoint = isFromAdmin 
        ? `/api/admin/projects/${projectId}` 
        : `/api/projects/${projectId}`;
      const res = await fetch(endpoint, { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !staticProject && !!projectId,
  });
  
  // Merge static or API project data
  const project = staticProject || (apiProject ? {
    id: apiProject.id,
    name: apiProject.name,
    address: apiProject.address || "Address not specified",
    status: apiProject.status || "Active",
    phase: apiProject.phase || "Planning",
    progress: apiProject.progress || 0,
    image: blueprintImage,
    nextMilestone: apiProject.nextMilestone || "Upcoming milestone",
    dueDate: "TBD",
    budget: parseInt(apiProject.budget) || 0,
    spent: 0,
    startDate: "TBD",
    endDate: "TBD",
    description: apiProject.description || "",
    clientId: apiProject.clientId
  } : null);
  const activeTab = getTabFromPath();
  
  // Update project mutation for contractor editing
  const updateProjectMutation = useMutation({
    mutationFn: async (data: { status?: string; phase?: string; progress?: number; description?: string; nextMilestone?: string }) => {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to update project');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/projects', projectId, isFromAdmin] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      setIsEditing(false);
    }
  });

  // Fetch project phases from API
  const { data: apiPhases = [] } = useQuery({
    queryKey: ['/api/projects', projectId, 'phases'],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/phases`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !staticProject && !!projectId,
  });

  // Update phase status mutation (for marking milestones complete/incomplete)
  const updatePhaseMutation = useMutation({
    mutationFn: async ({ phaseId, status }: { phaseId: string; status: string }) => {
      const res = await fetch(`/api/phases/${phaseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error('Failed to update phase');
      return res.json();
    },
    onSuccess: () => {
      // Invalidate all relevant queries to refetch updated data
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'phases'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/projects', projectId, isFromAdmin] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      // Also invalidate the specific project endpoint to get updated progress
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}`] });
      // Invalidate milestone tasks since they may have been auto-completed
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'milestone-tasks'] });
    }
  });

  // Initialize phases mutation (for existing projects without phases)
  const initializePhasesMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/phases/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to initialize phases');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'phases'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
    }
  });

  // Toggle phase completion status - simple on/off toggle
  const togglePhaseStatus = (phaseId: string, currentStatus: string) => {
    // Simple toggle: if completed (in any format), set to pending; otherwise set to completed
    const isCompleted = currentStatus.toLowerCase() === 'completed';
    const newStatus = isCompleted ? 'pending' : 'completed';
    updatePhaseMutation.mutate({ phaseId, status: newStatus });
  };

  // Handle clicking on static milestone (initialize phases first, then toggle)
  const handleStaticMilestoneClick = async (milestoneName: string, index: number) => {
    try {
      // Initialize phases for this project - pass the static MILESTONES data
      const res = await fetch(`/api/projects/${projectId}/phases/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ phases: MILESTONES })
      });
      if (!res.ok) throw new Error('Failed to initialize phases');
      const phases = await res.json();
      
      // Find the phase that matches this milestone
      const phase = phases.find((p: any) => p.name === milestoneName) || phases[index];
      if (phase) {
        // Simple toggle: if completed, set to pending; otherwise set to completed
        const newStatus = phase.status === 'completed' ? 'pending' : 'completed';
        await fetch(`/api/phases/${phase.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ status: newStatus })
        });
      }
      
      // Invalidate queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'phases'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
    } catch (error) {
      console.error('Failed to toggle milestone:', error);
    }
  };

  // Fetch phase updates for this project
  const { data: phaseUpdates = [] } = useQuery({
    queryKey: ['/api/projects', projectId, 'phase-updates'],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/phase-updates`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !staticProject && !!projectId && apiPhases.length > 0,
  });

  // State for adding new phase update
  const [newPhaseUpdate, setNewPhaseUpdate] = useState<{ [phaseId: string]: string }>({});

  // Create phase update mutation
  const createPhaseUpdateMutation = useMutation({
    mutationFn: async ({ phaseId, projectId, content }: { phaseId: string; projectId: string; content: string }) => {
      const res = await fetch(`/api/phases/${phaseId}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ projectId, content })
      });
      if (!res.ok) throw new Error('Failed to create update');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'phase-updates'] });
    }
  });

  // Delete phase update mutation
  const deletePhaseUpdateMutation = useMutation({
    mutationFn: async (updateId: string) => {
      const res = await fetch(`/api/phase-updates/${updateId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to delete update');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'phase-updates'] });
    }
  });

  // Add a phase update
  const addPhaseUpdate = (phaseId: string) => {
    const content = newPhaseUpdate[phaseId]?.trim();
    if (!content) return;
    createPhaseUpdateMutation.mutate({ phaseId, projectId: projectId!, content });
    setNewPhaseUpdate(prev => ({ ...prev, [phaseId]: '' }));
  };

  // Get updates for a specific phase
  const getPhaseUpdates = (phaseId: string) => {
    return phaseUpdates.filter((u: any) => u.phaseId === phaseId);
  };

  // Fetch milestone tasks for this project
  const { data: milestoneTasks = [] } = useQuery({
    queryKey: ['/api/projects', projectId, 'milestone-tasks'],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/milestone-tasks`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !staticProject && !!projectId && apiPhases.length > 0,
  });

  // State for adding new milestone task
  const [newTaskTitle, setNewTaskTitle] = useState<{ [phaseId: string]: string }>({});
  const [newTaskNeedsPercentage, setNewTaskNeedsPercentage] = useState<{ [phaseId: string]: boolean }>({});
  
  // State for tracking slider values during drag (to prevent snap-back)
  const [sliderValues, setSliderValues] = useState<{ [taskId: string]: number }>({});
  
  // State for tracking which task's percentage is being edited via text input
  const [editingPercentTask, setEditingPercentTask] = useState<string | null>(null);
  const [editingPercentValue, setEditingPercentValue] = useState<string>("");

  // Create milestone task mutation
  const createMilestoneTaskMutation = useMutation({
    mutationFn: async ({ phaseId, projectId, title, requiresPercentage }: { phaseId: string; projectId: string; title: string; requiresPercentage: boolean }) => {
      const res = await fetch(`/api/phases/${phaseId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ projectId, title, requiresPercentage })
      });
      if (!res.ok) throw new Error('Failed to create task');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'milestone-tasks'] });
      // Also invalidate project to get updated progress
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/projects', projectId, isFromAdmin] });
    }
  });

  // Update milestone task mutation
  const updateMilestoneTaskMutation = useMutation({
    mutationFn: async ({ taskId, updates }: { taskId: string; updates: { isComplete?: boolean; progressPercent?: number } }) => {
      const res = await fetch(`/api/milestone-tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates)
      });
      if (!res.ok) throw new Error('Failed to update task');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'milestone-tasks'] });
      // Also invalidate project to get updated progress
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/projects', projectId, isFromAdmin] });
    }
  });

  // Delete milestone task mutation
  const deleteMilestoneTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await fetch(`/api/milestone-tasks/${taskId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to delete task');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'milestone-tasks'] });
      // Also invalidate project to get updated progress
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/projects', projectId, isFromAdmin] });
    }
  });

  // Add a milestone task
  const addMilestoneTask = (phaseId: string) => {
    const title = newTaskTitle[phaseId]?.trim();
    if (!title) return;
    const requiresPercentage = newTaskNeedsPercentage[phaseId] || false;
    createMilestoneTaskMutation.mutate({ phaseId, projectId: projectId!, title, requiresPercentage });
    setNewTaskTitle(prev => ({ ...prev, [phaseId]: '' }));
    setNewTaskNeedsPercentage(prev => ({ ...prev, [phaseId]: false }));
  };

  // Get tasks for a specific phase - sorted by creation time to maintain consistent order
  const getPhaseTasks = (phaseId: string) => {
    return milestoneTasks
      .filter((t: any) => t.phaseId === phaseId)
      .sort((a: any, b: any) => {
        // Sort by createdAt to maintain insertion order
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateA - dateB;
      });
  };

  // Use API phases if available, otherwise fall back to static MILESTONES
  // Keep original phase data for proper status tracking
  const allMilestones = apiPhases.length > 0 
    ? apiPhases.map((p: any, idx: number) => {
        // Normalize status: completed stays completed, everything else is upcoming
        const normalizedStatus = p.status?.toLowerCase() === 'completed' ? 'completed' : 'upcoming';
        // Get description from the MILESTONE_DESCRIPTIONS map by phase name
        const milestoneInfo = MILESTONE_DESCRIPTIONS[p.name];
        return {
          id: p.id,
          name: p.name,
          date: p.dateRange || 'TBD',
          status: normalizedStatus,
          originalStatus: p.status, // Keep original status for toggle
          description: milestoneInfo?.description || `${p.name} phase`,
          details: milestoneInfo?.details || '',
          tasks: p.tasks || []
        };
      })
    : MILESTONES;
  
  // Filter to show milestones for the current status
  // "On Hold" shows no milestones - it's just a pause state, not a work phase
  const getStatusMilestones = (status: string) => {
    const statusPhases: Record<string, string[]> = {
      "Planning": ["Pre-Construction", "Design", "Permitting"],
      "Active": ["Foundation", "Framing", "Rough-in", "Insulation", "Drywall", "Finishing", "Final Inspection", "Handover"],
      "On Hold": [], // No milestones shown during hold - it's a temporary pause
      "Completed": ["Project Complete"],
    };
    return statusPhases[status] || [];
  };
  
  // Filter and sort milestones to maintain consistent order regardless of completion status
  const displayMilestones = project?.status 
    ? (() => {
        const statusPhaseOrder = getStatusMilestones(project.status);
        return allMilestones
          .filter((m: any) => statusPhaseOrder.includes(m.name))
          .sort((a: any, b: any) => {
            // Sort by the order defined in statusPhaseOrder, not by database order
            return statusPhaseOrder.indexOf(a.name) - statusPhaseOrder.indexOf(b.name);
          });
      })()
    : allMilestones;
  
  // Initialize edit state when entering edit mode
  const startEditing = () => {
    if (project) {
      setEditStatus(project.status);
      setEditPhase(project.phase);
      setEditDescription(project.description || "");
      setIsEditing(true);
    }
  };
  
  // Save project changes
  const saveProjectChanges = () => {
    updateProjectMutation.mutate({
      status: editStatus,
      phase: editPhase,
      description: editDescription
    });
  };
  
  // Get available phases for the selected status (includes current phase if not in standard list)
  const getAvailablePhases = (status: string) => {
    return getAllPhases(status, project?.phase);
  };
  
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
  const [editingMessage, setEditingMessage] = useState<{ id: string; content: string } | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [postDetailOpen, setPostDetailOpen] = useState(false);
  const [postImageIndex, setPostImageIndex] = useState(0);
  const [newComment, setNewComment] = useState("");
  const [replyingToPost, setReplyingToPost] = useState<{ id: string; title: string; coverImage: string } | null>(null);
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostCaption, setNewPostCaption] = useState("");
  const [newPostImages, setNewPostImages] = useState<string[]>([]);
  const [selectedInspiration, setSelectedInspiration] = useState<any | null>(null);
  const [inspirationDetailOpen, setInspirationDetailOpen] = useState(false);
  const [chatPickerOpen, setChatPickerOpen] = useState(false);
  const [pendingImageForChat, setPendingImageForChat] = useState<{ src: string; title: string; category: string } | null>(null);
  const [selectedChatForMessage, setSelectedChatForMessage] = useState<string | null>(null);
  const [createInspirationOpen, setCreateInspirationOpen] = useState(false);
  const [newInspirationTitle, setNewInspirationTitle] = useState("");
  const [newInspirationCaption, setNewInspirationCaption] = useState("");
  const [newInspirationCategory, setNewInspirationCategory] = useState("");
  const [newInspirationImages, setNewInspirationImages] = useState<string[]>([]);
  const [newInspirationComment, setNewInspirationComment] = useState("");
  const [inspirationImageIndex, setInspirationImageIndex] = useState(0);
  const [inspirationSortOrder, setInspirationSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [inspirationCategoryFilter, setInspirationCategoryFilter] = useState<string>('all');
  const inspirationFileInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageAttachmentInputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Fetch messages from API (legacy)
  const { data: apiMessages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['/api/projects', projectId, 'messages'],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/messages`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!projectId,
  });

  // Fetch chats for chat picker
  const { data: projectChats = [] } = useQuery({
    queryKey: ['/api/projects', projectId, 'chats'],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/chats`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!projectId,
  });

  // Transform API messages to local format (filter out deleted messages)
  const messages: LocalMessage[] = apiMessages
    .filter((msg: any) => !msg.isDeleted)
    .map((msg: any) => ({
      id: msg.id,
      sender: msg.senderName,
      avatar: msg.senderAvatar || getInitials(msg.senderName),
      message: msg.content,
      time: new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
      isOwn: msg.isOwn === true || msg.senderName === 'You' || msg.senderId === 'current-user',
      isSystem: msg.isSystem,
      isRead: !!msg.readAt,
      isEdited: !!msg.editedAt,
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
    }
  });

  // Edit message mutation
  const editMessageMutation = useMutation({
    mutationFn: async ({ messageId, content }: { messageId: string; content: string }) => {
      const res = await fetch(`/api/messages/${messageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      if (!res.ok) throw new Error('Failed to edit message');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'messages'] });
      setEditDialogOpen(false);
      setEditingMessage(null);
      setEditContent("");
    }
  });

  // Delete message mutation
  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const res = await fetch(`/api/messages/${messageId}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete message');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'messages'] });
    }
  });

  const handleEditMessage = (msg: LocalMessage) => {
    setEditingMessage({ id: msg.id, content: msg.message });
    setEditContent(msg.message);
    setEditDialogOpen(true);
  };

  const handleDeleteMessage = (messageId: string) => {
    if (confirm('Are you sure you want to delete this message?')) {
      deleteMessageMutation.mutate(messageId);
    }
  };

  // Mark messages as read when viewing chat
  useEffect(() => {
    if (activeTab === 'messages' && projectId && messages.length > 0) {
      fetch(`/api/projects/${projectId}/messages/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'messages'] });
      }).catch(() => {});
    }
  }, [activeTab, projectId, messages.length]);

  // Fetch progress posts
  const { data: progressPosts = [] } = useQuery({
    queryKey: ['/api/projects', projectId, 'posts'],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/posts`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!projectId,
  });

  // Fetch inspiration images from API
  const { data: apiInspirationImages = [] } = useQuery({
    queryKey: ['/api/projects', projectId, 'inspiration'],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/inspiration`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!projectId,
  });

  // Create inspiration image mutation
  const createInspirationMutation = useMutation({
    mutationFn: async (data: { imageUrl: string; coverImage?: string; images?: string[]; title: string; caption?: string; category?: string }) => {
      const res = await fetch(`/api/projects/${projectId}/inspiration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to create inspiration image');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'inspiration'] });
    }
  });

  // Delete inspiration image mutation
  const deleteInspirationMutation = useMutation({
    mutationFn: async (imageId: string) => {
      const res = await fetch(`/api/inspiration/${imageId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete inspiration image');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'inspiration'] });
      setSelectedInspiration(null);
      setInspirationDetailOpen(false);
    }
  });

  // Fetch comments for selected inspiration (reuses posts endpoint)
  const { data: inspirationComments = [] } = useQuery({
    queryKey: ['/api/posts', selectedInspiration?.id, 'comments'],
    queryFn: async () => {
      const res = await fetch(`/api/posts/${selectedInspiration?.id}/comments`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedInspiration?.id,
  });

  // Fetch reactions for selected inspiration (reuses posts endpoint)
  const { data: inspirationReactions = [] } = useQuery({
    queryKey: ['/api/posts', selectedInspiration?.id, 'reactions'],
    queryFn: async () => {
      const res = await fetch(`/api/posts/${selectedInspiration?.id}/reactions`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedInspiration?.id,
  });

  // Add inspiration comment mutation
  const addInspirationCommentMutation = useMutation({
    mutationFn: async ({ imageId, content }: { imageId: string; content: string }) => {
      const res = await fetch(`/api/posts/${imageId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, userName: user?.name || 'You', userAvatar: user?.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'YO' })
      });
      if (!res.ok) throw new Error('Failed to add comment');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/posts', selectedInspiration?.id, 'comments'] });
      setNewInspirationComment("");
    }
  });

  // Toggle inspiration reaction mutation
  const toggleInspirationReactionMutation = useMutation({
    mutationFn: async (imageId: string) => {
      const res = await fetch(`/api/posts/${imageId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reactionType: 'like', userName: user?.name || 'You' })
      });
      if (!res.ok) throw new Error('Failed to toggle reaction');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/posts', selectedInspiration?.id, 'reactions'] });
    }
  });

  // Fetch comments for selected post
  const { data: postComments = [] } = useQuery({
    queryKey: ['/api/posts', selectedPost?.id, 'comments'],
    queryFn: async () => {
      const res = await fetch(`/api/posts/${selectedPost?.id}/comments`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedPost?.id,
  });

  // Fetch reactions for selected post
  const { data: postReactions = [] } = useQuery({
    queryKey: ['/api/posts', selectedPost?.id, 'reactions'],
    queryFn: async () => {
      const res = await fetch(`/api/posts/${selectedPost?.id}/reactions`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedPost?.id,
  });

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: async ({ postId, content }: { postId: string; content: string }) => {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, userName: 'You', userAvatar: 'YO' })
      });
      if (!res.ok) throw new Error('Failed to add comment');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/posts', selectedPost?.id, 'comments'] });
      setNewComment("");
    }
  });

  // Toggle reaction mutation
  const toggleReactionMutation = useMutation({
    mutationFn: async (postId: string) => {
      const res = await fetch(`/api/posts/${postId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reactionType: 'like', userName: 'You' })
      });
      if (!res.ok) throw new Error('Failed to toggle reaction');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/posts', selectedPost?.id, 'reactions'] });
    }
  });

  // Create progress post mutation
  const createPostMutation = useMutation({
    mutationFn: async (data: { title: string; caption: string; images: string[] }) => {
      const res = await fetch(`/api/projects/${projectId}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: data.title,
          caption: data.caption,
          coverImage: data.images[0] || '',
          images: data.images
        })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to create post');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'posts'] });
      setCreatePostOpen(false);
      setNewPostTitle("");
      setNewPostCaption("");
      setNewPostImages([]);
    },
    onError: (error: Error) => {
      alert(error.message || 'Failed to create post');
    }
  });

  // Delete progress post mutation
  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      const res = await fetch(`/api/posts/${postId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to delete post');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'posts'] });
      setPostDetailOpen(false);
      setSelectedPost(null);
    },
    onError: (error: Error) => {
      alert(error.message || 'Failed to delete post');
    }
  });

  const handleCreatePost = () => {
    if (!newPostTitle.trim() || newPostImages.length === 0) return;
    createPostMutation.mutate({
      title: newPostTitle.trim(),
      caption: newPostCaption.trim(),
      images: newPostImages
    });
  };

  // Contractor photos state
  const [createContractorPhotoOpen, setCreateContractorPhotoOpen] = useState(false);
  const [newContractorPhotoTitle, setNewContractorPhotoTitle] = useState("");
  const [newContractorPhotoCaption, setNewContractorPhotoCaption] = useState("");
  const [newContractorPhotoImages, setNewContractorPhotoImages] = useState<string[]>([]);
  const [selectedContractorPhoto, setSelectedContractorPhoto] = useState<any>(null);
  const [contractorPhotoDetailOpen, setContractorPhotoDetailOpen] = useState(false);

  // Fetch contractor photos (only for contractors/admins)
  const { data: contractorPhotos = [] } = useQuery({
    queryKey: ['/api/projects', projectId, 'contractor-photos'],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/contractor-photos`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!projectId && canEdit,
  });

  // Create contractor photo mutation
  const createContractorPhotoMutation = useMutation({
    mutationFn: async (data: { title: string; caption: string; images: string[] }) => {
      const res = await fetch(`/api/projects/${projectId}/contractor-photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: data.title,
          caption: data.caption,
          coverImage: data.images[0] || '',
          images: data.images
        })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to create contractor photo');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'contractor-photos'] });
      setCreateContractorPhotoOpen(false);
      setNewContractorPhotoTitle("");
      setNewContractorPhotoCaption("");
      setNewContractorPhotoImages([]);
    },
    onError: (error: Error) => {
      alert(error.message || 'Failed to create contractor photo');
    }
  });

  // Delete contractor photo mutation
  const deleteContractorPhotoMutation = useMutation({
    mutationFn: async (photoId: string) => {
      const res = await fetch(`/api/contractor-photos/${photoId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to delete contractor photo');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'contractor-photos'] });
      setContractorPhotoDetailOpen(false);
      setSelectedContractorPhoto(null);
    },
    onError: (error: Error) => {
      alert(error.message || 'Failed to delete contractor photo');
    }
  });

  const handleCreateContractorPhoto = () => {
    if (!newContractorPhotoTitle.trim() || newContractorPhotoImages.length === 0) return;
    createContractorPhotoMutation.mutate({
      title: newContractorPhotoTitle.trim(),
      caption: newContractorPhotoCaption.trim(),
      images: newContractorPhotoImages
    });
  };

  const handleDeleteContractorPhoto = (photoId: string) => {
    if (confirm('Are you sure you want to delete this photo?')) {
      deleteContractorPhotoMutation.mutate(photoId);
    }
  };

  const openContractorPhotoDetail = (photo: any) => {
    setSelectedContractorPhoto(photo);
    setContractorPhotoDetailOpen(true);
  };

  // Document upload state
  const [uploadDocumentOpen, setUploadDocumentOpen] = useState(false);
  const [newDocumentType, setNewDocumentType] = useState<string>("");
  const [newDocumentFile, setNewDocumentFile] = useState<{ name: string; objectPath: string; size: number; mimeType: string } | null>(null);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadPhase, setUploadPhase] = useState<'idle' | 'upload'>('idle');
  const [uploadPhaseLabel, setUploadPhaseLabel] = useState('Uploading...');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [requiresSignature, setRequiresSignature] = useState(false);
  const [requiresNotarization, setRequiresNotarization] = useState(false);
  const [notarizationDueDate, setNotarizationDueDate] = useState<string>("");
  const [selectedNotaryProfileId, setSelectedNotaryProfileId] = useState<string>("");
  const [showCreateNotaryProfile, setShowCreateNotaryProfile] = useState(false);
  const [newNotaryProfile, setNewNotaryProfile] = useState({ name: "", email: "", phone: "", companyName: "", address: "", city: "", state: "", zipCode: "" });
  const documentFileInputRef = useRef<HTMLInputElement>(null);
  
  // Upload wizard state for signature documents
  const [uploadWizardStep, setUploadWizardStep] = useState<1 | 2>(1);
  const [signatureFields, setSignatureFields] = useState<SignatureField[]>([]);
  const [signatureDueDate, setSignatureDueDate] = useState<string>("");
  const [signatureMessage, setSignatureMessage] = useState<string>("");
  
  // Delete document confirmation dialog
  const [deleteDocumentDialogOpen, setDeleteDocumentDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<{ id: string; name: string } | null>(null);

  // Notarization upload dialog (for clients to upload notarized documents)
  const [notarizationUploadDialogOpen, setNotarizationUploadDialogOpen] = useState(false);
  const [notarizationUploadDocId, setNotarizationUploadDocId] = useState<string | null>(null);
  const [notarizedFile, setNotarizedFile] = useState<{ name: string; objectPath: string; size: number; mimeType: string } | null>(null);
  const [isUploadingNotarized, setIsUploadingNotarized] = useState(false);
  const [notarizedUploadProgress, setNotarizedUploadProgress] = useState(0);
  const notarizedFileInputRef = useRef<HTMLInputElement>(null);

  // Fetch project documents
  const { data: projectDocuments = [], isLoading: documentsLoading } = useQuery({
    queryKey: ['/api/projects', projectId, 'documents'],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/documents`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!projectId,
  });

  // Fetch signing packets
  const { data: signingPackets = [] } = useQuery({
    queryKey: ['/api/projects', projectId, 'signing-packets'],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/signing-packets`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!projectId,
  });

  // Fetch notary profiles (for contractors to manage, for clients to view recommended notaries)
  const { data: notaryProfiles = [] } = useQuery({
    queryKey: ['/api/notary-profiles'],
    queryFn: async () => {
      const res = await fetch('/api/notary-profiles', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Upload notarized document mutation (for clients)
  const uploadNotarizedDocMutation = useMutation({
    mutationFn: async (data: { documentId: string; notarizedFileUrl: string }) => {
      const res = await fetch(`/api/documents/${data.documentId}/upload-notarized`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ notarizedFileUrl: data.notarizedFileUrl })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to upload notarized document');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'documents'] });
      setNotarizationUploadDialogOpen(false);
      setNotarizationUploadDocId(null);
      setNotarizedFile(null);
    },
    onError: (error: Error) => {
      alert(error.message || 'Failed to upload notarized document');
    }
  });

  // Create notary profile mutation
  const createNotaryProfileMutation = useMutation({
    mutationFn: async (data: { name: string; email?: string; phone?: string; companyName?: string; address?: string; city?: string; state?: string; zipCode?: string }) => {
      const res = await fetch('/api/notary-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to create notary profile');
      }
      return res.json();
    },
    onSuccess: (profile) => {
      queryClient.invalidateQueries({ queryKey: ['/api/notary-profiles'] });
      setSelectedNotaryProfileId(profile.id);
      setShowCreateNotaryProfile(false);
      setNewNotaryProfile({ name: "", email: "", phone: "", companyName: "", address: "", city: "", state: "", zipCode: "" });
    },
    onError: (error: Error) => {
      alert(error.message || 'Failed to create notary profile');
    }
  });

  // Send for signature state
  const [sendForSignatureOpen, setSendForSignatureOpen] = useState(false);
  const [documentToSign, setDocumentToSign] = useState<{ id: string; name: string } | null>(null);

  // Create document mutation
  const createDocumentMutation = useMutation({
    mutationFn: async (data: { 
      name: string; 
      type: string; 
      fileUrl: string; 
      fileSize?: number; 
      mimeType?: string;
      requiresSignature?: boolean;
      signatureStatus?: string;
      finalDocumentType?: string;
      requiresNotarization?: boolean;
      notarizationStatus?: string;
      notarizationDueDate?: string;
      notaryProfileId?: string;
    }) => {
      const res = await fetch(`/api/projects/${projectId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to upload document');
      }
      return res.json();
    },
    onSuccess: (doc) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'documents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'signing-packets'] });
      setUploadDocumentOpen(false);
      setNewDocumentType("");
      setNewDocumentFile(null);
      setRequiresSignature(false);
      setRequiresNotarization(false);
      setNotarizationDueDate("");
      setSelectedNotaryProfileId("");
      setUploadWizardStep(1);
      setSignatureFields([]);
      setSignatureDueDate("");
      setSignatureMessage("");
    },
    onError: (error: Error) => {
      alert(error.message || 'Failed to upload document');
    }
  });

  // Delete document mutation
  const deleteDocumentMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to delete document');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'documents'] });
    },
    onError: (error: Error) => {
      alert(error.message || 'Failed to delete document');
    }
  });

  // Handle document file upload using multipart form with progress tracking
  const handleDocumentFileUpload = async (files: FileList) => {
    const file = files[0];
    if (!file) return;
    
    const mimeType = file.type || 'application/octet-stream';
    
    // Check if signature is required and file is not PDF
    if (requiresSignature && mimeType !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setUploadError('Documents requiring signature must be in PDF format. Please convert your document to PDF first.');
      return;
    }
    
    setIsUploadingDocument(true);
    setUploadProgress(0);
    setUploadPhase('upload');
    setUploadPhaseLabel('Uploading...');
    setUploadError(null);
    
    try {
      // Use FormData for multipart upload
      const formData = new FormData();
      formData.append('file', file);
      
      setUploadProgress(10);
      
      // Upload using multipart form (more reliable than raw binary)
      const response = await new Promise<{ objectPath: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 85) + 10;
            setUploadProgress(Math.min(percentComplete, 95));
          }
        });
        
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploadProgress(100);
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch {
              reject(new Error('Invalid response'));
            }
          } else {
            reject(new Error('Failed to upload file'));
          }
        });
        
        xhr.addEventListener('error', () => reject(new Error('Upload failed')));
        xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));
        
        xhr.open('POST', '/api/uploads/file');
        xhr.send(formData);
      });
      
      // Store file info
      setNewDocumentFile({
        name: file.name,
        objectPath: response.objectPath,
        size: file.size,
        mimeType: mimeType
      });
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError(error instanceof Error ? error.message : 'Failed to upload file. Please try again.');
      setUploadProgress(0);
    } finally {
      setIsUploadingDocument(false);
      setUploadPhase('idle');
    }
  };

  // Handle notarized file upload (for clients uploading externally notarized documents)
  const handleNotarizedFileUpload = async (files: FileList) => {
    const file = files[0];
    if (!file) return;
    
    const mimeType = file.type || 'application/octet-stream';
    
    setIsUploadingNotarized(true);
    setNotarizedUploadProgress(0);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      setNotarizedUploadProgress(10);
      
      const response = await new Promise<{ objectPath: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 85) + 10;
            setNotarizedUploadProgress(Math.min(percentComplete, 95));
          }
        });
        
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setNotarizedUploadProgress(100);
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch {
              reject(new Error('Invalid response'));
            }
          } else {
            reject(new Error('Failed to upload file'));
          }
        });
        
        xhr.addEventListener('error', () => reject(new Error('Upload failed')));
        xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));
        
        xhr.open('POST', '/api/uploads/file');
        xhr.send(formData);
      });
      
      setNotarizedFile({
        name: file.name,
        objectPath: response.objectPath,
        size: file.size,
        mimeType: mimeType
      });
    } catch (error) {
      console.error('Upload error:', error);
      alert(error instanceof Error ? error.message : 'Failed to upload file. Please try again.');
      setNotarizedUploadProgress(0);
    } finally {
      setIsUploadingNotarized(false);
    }
  };

  // Create document with signature packet mutation
  const [signatureCreationError, setSignatureCreationError] = useState<string | null>(null);
  const createDocumentWithSignatureMutation = useMutation({
    mutationFn: async (data: { 
      document: { name: string; type: string; fileUrl: string; fileSize?: number; mimeType?: string };
      recipients: Array<{ name: string; email: string }>;
      fields: SignatureField[];
      dueDate: string;
      message?: string;
    }) => {
      // First create the document with pending_setup status (safe rollback state)
      const docRes = await fetch(`/api/projects/${projectId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...data.document,
          requiresSignature: true,
          signatureStatus: 'pending_setup',
          finalDocumentType: data.document.type
        })
      });
      if (!docRes.ok) {
        const errData = await docRes.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to upload document');
      }
      const doc = await docRes.json();
      
      // Then create the signing packet (this will update doc status to pending_signature)
      const packetRes = await fetch(`/api/projects/${projectId}/signing-packets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          documentId: doc.id,
          title: data.document.name,
          message: data.message || undefined,
          dueDate: data.dueDate || undefined,
          recipients: data.recipients,
          fields: data.fields
        })
      });
      if (!packetRes.ok) {
        const errData = await packetRes.json().catch(() => ({}));
        // Document was created but packet failed - it will appear in Action Center for retry
        throw new Error(errData.message || 'Failed to create signing request. The document was saved and you can set up signatures from the Action Center.');
      }
      return packetRes.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'documents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'signing-packets'] });
      setUploadDocumentOpen(false);
      setNewDocumentType("");
      setNewDocumentFile(null);
      setRequiresSignature(false);
      setUploadWizardStep(1);
      setSignatureFields([]);
      setSignatureDueDate("");
      setSignatureMessage("");
      setSignatureCreationError(null);
    },
    onError: (error: Error) => {
      // Keep wizard state so user can retry or see what went wrong
      setSignatureCreationError(error.message || 'Failed to create signature request');
    }
  });

  const handleCreateDocument = () => {
    if (!newDocumentType || !newDocumentFile) return;
    if (requiresNotarization && !selectedNotaryProfileId) {
      alert('Please select a recommended notary');
      return;
    }
    createDocumentMutation.mutate({
      name: newDocumentFile.name,
      type: newDocumentType,
      fileUrl: newDocumentFile.objectPath,
      fileSize: newDocumentFile.size,
      mimeType: newDocumentFile.mimeType,
      requiresSignature: requiresSignature,
      signatureStatus: requiresSignature ? 'pending_setup' : undefined,
      finalDocumentType: requiresSignature ? newDocumentType : undefined,
      requiresNotarization: requiresNotarization,
      notarizationStatus: requiresNotarization ? 'pending' : undefined,
      notarizationDueDate: requiresNotarization ? notarizationDueDate : undefined,
      notaryProfileId: requiresNotarization ? selectedNotaryProfileId : undefined
    });
  };
  
  const handleCreateDocumentWithSignature = () => {
    if (!newDocumentType || !newDocumentFile) return;
    
    // Clear any previous error
    setSignatureCreationError(null);
    
    // Validate client exists
    if (!apiProject?.client) {
      setSignatureCreationError('No client assigned to this project. Please assign a client before requesting signatures.');
      return;
    }
    
    // Validate due date
    if (!signatureDueDate) {
      setSignatureCreationError('Please select a due date');
      return;
    }
    
    // Validate signature fields
    if (signatureFields.length === 0) {
      setSignatureCreationError('Please add at least one signature field');
      return;
    }
    
    createDocumentWithSignatureMutation.mutate({
      document: {
        name: newDocumentFile.name,
        type: newDocumentType,
        fileUrl: newDocumentFile.objectPath,
        fileSize: newDocumentFile.size,
        mimeType: newDocumentFile.mimeType
      },
      recipients: [{ name: apiProject.client.name, email: apiProject.client.email }],
      fields: signatureFields,
      dueDate: signatureDueDate,
      message: signatureMessage || undefined
    });
  };

  const handleDeleteDocument = (doc: { id: string; name: string }) => {
    setDocumentToDelete(doc);
    setDeleteDocumentDialogOpen(true);
  };
  
  const confirmDeleteDocument = () => {
    if (documentToDelete) {
      deleteDocumentMutation.mutate(documentToDelete.id);
      setDeleteDocumentDialogOpen(false);
      setDocumentToDelete(null);
    }
  };

  const openDocumentViewer = (doc: { name: string; fileUrl: string; mimeType?: string }) => {
    const isImage = doc.mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.name);
    setDocumentToView({
      src: doc.fileUrl,
      name: doc.name,
      type: isImage ? 'image' : 'file'
    });
    setDocumentViewerOpen(true);
  };

  const downloadDocument = (doc: { name: string; fileUrl: string }) => {
    const link = document.createElement('a');
    link.href = doc.fileUrl;
    link.download = doc.name;
    link.click();
  };

  // Document type configuration
  const documentTypeConfig = {
    contracts: { label: 'Contracts', icon: FileText, color: 'blue', description: 'Agreements & proposals' },
    plans: { label: 'Plans & Drawings', icon: Layers, color: 'purple', description: 'Blueprints & designs' },
    permits: { label: 'Permits & Approvals', icon: Shield, color: 'green', description: 'Official documents' },
    invoices: { label: 'Invoices & Payments', icon: Receipt, color: 'amber', description: 'Billing records' },
    warranties: { label: 'Warranties & Manuals', icon: BookOpen, color: 'cyan', description: 'Product documentation' },
  };

  // Group documents by type
  const documentsByType = projectDocuments.reduce((acc: Record<string, any[]>, doc: any) => {
    if (!acc[doc.type]) acc[doc.type] = [];
    acc[doc.type].push(doc);
    return acc;
  }, {});

  // Calculate pending action count for Action Center badge
  const pendingActionDocs = projectDocuments.filter((doc: any) => 
    doc.requiresSignature && (doc.signatureStatus === 'pending_setup' || doc.signatureStatus === 'pending_signature')
  );
  const pendingActionPackets = signingPackets.filter((packet: any) => 
    packet.status === 'pending'
  );
  const pendingActionCount = isContractorView 
    ? pendingActionDocs.length 
    : pendingActionPackets.filter((p: any) => 
        p.participants?.some((part: any) => part.status === 'pending' && part.email === user?.email)
      ).length;

  const handleDeletePost = (postId: string) => {
    if (confirm('Are you sure you want to delete this post?')) {
      deletePostMutation.mutate(postId);
    }
  };

  // Handle post image upload
  const postImageInputRef = useRef<HTMLInputElement>(null);
  const contractorPhotoInputRef = useRef<HTMLInputElement>(null);
  const handlePostImageUpload = async (files: FileList) => {
    for (const file of Array.from(files)) {
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        continue;
      }
      if (!file.type.startsWith('image/')) {
        alert('Only image files are allowed');
        continue;
      }
      
      try {
        // Get presigned upload URL
        const signedRes = await fetch('/api/uploads/request-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: file.name,
            size: file.size,
            contentType: file.type
          })
        });
        if (!signedRes.ok) throw new Error('Failed to get upload URL');
        const { uploadURL, objectPath } = await signedRes.json();
        
        // Upload to object storage
        const uploadRes = await fetch(uploadURL, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file
        });
        if (!uploadRes.ok) throw new Error('Upload failed');
        
        // Use the object path as the public URL
        setNewPostImages(prev => [...prev, objectPath]);
      } catch (error) {
        console.error('Upload failed:', error);
        alert('Failed to upload image');
      }
    }
  };

  // Handle contractor photo image upload
  const handleContractorPhotoImageUpload = async (files: FileList) => {
    for (const file of Array.from(files)) {
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        continue;
      }
      if (!file.type.startsWith('image/')) {
        alert('Only image files are allowed');
        continue;
      }
      
      try {
        // Get presigned upload URL
        const signedRes = await fetch('/api/uploads/request-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: file.name,
            size: file.size,
            contentType: file.type
          })
        });
        if (!signedRes.ok) throw new Error('Failed to get upload URL');
        const { uploadURL, objectPath } = await signedRes.json();
        
        // Upload to object storage
        const uploadRes = await fetch(uploadURL, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file
        });
        if (!uploadRes.ok) throw new Error('Upload failed');
        
        // Use the object path as the public URL
        setNewContractorPhotoImages(prev => [...prev, objectPath]);
      } catch (error) {
        console.error('Upload failed:', error);
        alert('Failed to upload image');
      }
    }
  };

  const openPostDetail = (post: any) => {
    setSelectedPost(post);
    setPostImageIndex(0);
    setPostDetailOpen(true);
  };

  const toggleMilestone = (id: number) => {
    setExpandedMilestones(prev => 
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const sendMessage = () => {
    if (!messageText.trim() && !pendingAttachment && !replyingToImage && !replyingToPost) return;
    
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
      }),
      ...(replyingToPost && {
        replyToImageUrl: replyingToPost.coverImage,
        replyToImageTitle: `Progress: ${replyingToPost.title}`
      })
    };
    
    sendMessageMutation.mutate(messageData);
    setMessageText("");
    setPendingAttachment(null);
    setReplyingToMessage(null);
    setReplyingToImage(null);
    setReplyingToPost(null);
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

  // State to store the actual files for upload (multi-image support)
  const [inspirationFilesToUpload, setInspirationFilesToUpload] = useState<File[]>([]);
  const [inspirationUploading, setInspirationUploading] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const newFiles: File[] = [];
    const newPreviews: string[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 5 * 1024 * 1024) {
        alert(`File ${file.name} is too large. Max 5MB per image.`);
        continue;
      }
      if (!file.type.startsWith('image/')) {
        alert(`${file.name} is not an image file`);
        continue;
      }
      newFiles.push(file);
      newPreviews.push(URL.createObjectURL(file));
    }
    
    if (newFiles.length > 0) {
      // Set title from first file if no title yet
      if (!newInspirationTitle) {
        const fileName = newFiles[0].name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        setNewInspirationTitle(fileName.charAt(0).toUpperCase() + fileName.slice(1));
      }
      setNewInspirationImages(prev => [...prev, ...newPreviews]);
      setInspirationFilesToUpload(prev => [...prev, ...newFiles]);
      setCreateInspirationOpen(true);
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleInspirationFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const newFiles: File[] = [];
    const newPreviews: string[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 5 * 1024 * 1024) {
        alert(`File ${file.name} is too large. Max 5MB per image.`);
        continue;
      }
      if (!file.type.startsWith('image/')) {
        alert(`${file.name} is not an image file`);
        continue;
      }
      newFiles.push(file);
      newPreviews.push(URL.createObjectURL(file));
    }
    
    if (newFiles.length > 0) {
      setNewInspirationImages(prev => [...prev, ...newPreviews]);
      setInspirationFilesToUpload(prev => [...prev, ...newFiles]);
    }
    
    if (inspirationFileInputRef.current) {
      inspirationFileInputRef.current.value = "";
    }
  };

  const removeInspirationImage = (index: number) => {
    // Revoke blob URL to prevent memory leak
    if (newInspirationImages[index]?.startsWith('blob:')) {
      URL.revokeObjectURL(newInspirationImages[index]);
    }
    setNewInspirationImages(prev => prev.filter((_, i) => i !== index));
    setInspirationFilesToUpload(prev => prev.filter((_, i) => i !== index));
  };

  const openInspirationDetail = (inspiration: any) => {
    setSelectedInspiration(inspiration);
    setInspirationDetailOpen(true);
  };

  const createInspiration = async () => {
    if (!newInspirationTitle.trim() || inspirationFilesToUpload.length === 0) return;
    
    setInspirationUploading(true);
    
    try {
      // Upload all files and collect the CDN URLs
      const uploadedUrls: string[] = [];
      
      for (const file of inspirationFilesToUpload) {
        // Step 1: Get presigned upload URL
        const signedRes = await fetch('/api/uploads/request-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: file.name,
            size: file.size,
            contentType: file.type
          })
        });
        if (!signedRes.ok) throw new Error('Failed to get upload URL');
        const { uploadURL, objectPath } = await signedRes.json();
        
        // Step 2: Upload to object storage
        const uploadRes = await fetch(uploadURL, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file
        });
        if (!uploadRes.ok) throw new Error('Upload failed');
        
        uploadedUrls.push(objectPath);
      }
      
      // Step 3: Create inspiration with cover image and all images
      createInspirationMutation.mutate({
        imageUrl: uploadedUrls[0], // Keep for backward compatibility
        coverImage: uploadedUrls[0],
        images: uploadedUrls,
        title: newInspirationTitle.trim(),
        caption: newInspirationCaption.trim() || undefined,
        category: newInspirationCategory.trim() || undefined
      });
      
      // Clean up blob URLs
      newInspirationImages.forEach(url => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
      
      setCreateInspirationOpen(false);
      setNewInspirationTitle("");
      setNewInspirationCaption("");
      setNewInspirationCategory("");
      setNewInspirationImages([]);
      setInspirationFilesToUpload([]);
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload image');
    } finally {
      setInspirationUploading(false);
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

  if (projectLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href={backPath}>
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-heading font-bold">Loading Project...</h1>
        </div>
        <Card>
          <CardContent className="p-8 text-center">
            <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-muted-foreground">Loading project details...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href={backPath}>
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
            <Link href={backPath}>
              <Button data-testid="button-back-to-projects">
                Back to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      {/* Header with Back Navigation */}
      <div className="flex items-center gap-4">
        <Link href={backPath}>
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-heading font-bold" data-testid="text-project-name">{project.name}</h1>
            <Badge className={`${
              project.status === 'Active' || project.status === 'active' ? 'bg-green-500 hover:bg-green-600' :
              project.status === 'Planning' || project.status === 'planning' ? 'bg-blue-500 hover:bg-blue-600' :
              'bg-slate-500 hover:bg-slate-600'
            } border-0`} data-testid="badge-project-status">
              {project.status}
            </Badge>
            {isFromAdmin && (
              <Badge variant="outline" className="border-primary text-primary">
                Admin View
              </Badge>
            )}
          </div>
          <div className="flex items-center text-muted-foreground text-sm mt-1">
            <MapPin className="w-4 h-4 mr-1" />
            <span data-testid="text-project-address">{project.address}</span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-6">
        <TabsList className="w-full justify-start border-b border-border bg-transparent p-0 pt-2 rounded-none h-auto overflow-x-auto overflow-y-visible flex-nowrap">
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
          {canEdit && (
            <TabsTrigger 
              value="contractor-photos"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:bg-muted px-4 py-3 whitespace-nowrap transition-colors"
              data-testid="tab-contractor-photos"
            >
              Contractor Photos
            </TabsTrigger>
          )}
          <TabsTrigger 
            value="documents"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:bg-muted px-4 py-3 whitespace-nowrap transition-colors"
            data-testid="tab-documents"
          >
            Documents
          </TabsTrigger>
          <TabsTrigger 
            value="action-center"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:bg-muted px-4 py-3 pr-6 whitespace-nowrap transition-colors relative overflow-visible"
            data-testid="tab-action-center"
          >
            Action Center
            {pendingActionCount > 0 && (
              <span className="absolute top-1 right-0 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {pendingActionCount}
              </span>
            )}
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
                {/* Client Info Card - Only visible to contractors */}
                {isContractorView && apiProject?.client && (
                  <Card data-testid="card-client-info">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Client Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={apiProject.client.profilePicture || undefined} />
                          <AvatarFallback>{getInitials(apiProject.client.name || apiProject.client.username)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium" data-testid="text-client-name">{apiProject.client.name || apiProject.client.username}</p>
                          <p className="text-sm text-muted-foreground">Project Client</p>
                        </div>
                      </div>
                      <div className="space-y-2 pt-2 border-t">
                        {apiProject.client.email && (
                          <a 
                            href={`mailto:${apiProject.client.email}`} 
                            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                            data-testid="link-client-email"
                          >
                            <Mail className="h-4 w-4" />
                            {apiProject.client.email}
                          </a>
                        )}
                        {apiProject.client.phone && (
                          <a 
                            href={`tel:${apiProject.client.phone}`} 
                            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                            data-testid="link-client-phone"
                          >
                            <Phone className="h-4 w-4" />
                            {apiProject.client.phone}
                          </a>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

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
                      onClick={() => handleTabChange("messages")}
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

          {/* INSPIRATION & SELECTIONS TAB - Instagram-style Feed */}
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
                <p className="text-sm text-muted-foreground">Design ideas and material selections from the team</p>
              </div>
              <div className="flex items-center gap-2">
                <Select value={inspirationCategoryFilter} onValueChange={setInspirationCategoryFilter}>
                  <SelectTrigger className="w-[140px]" data-testid="select-inspiration-category">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" data-testid="option-category-all">All Categories</SelectItem>
                    {/* Get unique categories from inspiration images */}
                    {(Array.from(new Set(
                      (apiInspirationImages.length > 0 ? apiInspirationImages : INITIAL_INSPIRATION_IMAGES.map(img => ({ category: img.category })))
                        .map((img: any) => img.category)
                        .filter(Boolean)
                    )) as string[]).map((category) => (
                      <SelectItem key={category} value={category} data-testid={`option-category-${category.toLowerCase().replace(/\s+/g, '-')}`}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={inspirationSortOrder} onValueChange={(value: 'newest' | 'oldest') => setInspirationSortOrder(value)}>
                  <SelectTrigger className="w-[160px]" data-testid="select-inspiration-sort">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest" data-testid="option-sort-newest">Newest to Oldest</SelectItem>
                    <SelectItem value="oldest" data-testid="option-sort-oldest">Oldest to Newest</SelectItem>
                  </SelectContent>
                </Select>
                <Button 
                  data-testid="button-upload-inspiration"
                  onClick={() => setCreateInspirationOpen(true)}
                  className="hover:bg-primary/90 transition-colors"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Inspiration
                </Button>
              </div>
            </div>

            {/* Instagram-style grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Use API images if available, fallback to demo data */}
              {(apiInspirationImages.length > 0 ? apiInspirationImages : INITIAL_INSPIRATION_IMAGES.map((img, idx) => ({
                id: `demo-${img.id}`,
                imageUrl: img.src,
                coverImage: img.src,
                images: [img.src],
                title: img.title,
                caption: `Sample ${img.category} inspiration for your project`,
                category: img.category,
                creatorName: 'Design Team',
                createdAt: new Date(Date.now() - idx * 86400000 * 3).toISOString()
              })))
              .filter((img: any) => inspirationCategoryFilter === 'all' || img.category === inspirationCategoryFilter)
              .sort((a: any, b: any) => {
                const dateA = new Date(a.createdAt).getTime();
                const dateB = new Date(b.createdAt).getTime();
                return inspirationSortOrder === 'newest' ? dateB - dateA : dateA - dateB;
              })
              .map((inspiration: any) => (
                <Card 
                  key={inspiration.id} 
                  className="group overflow-hidden cursor-pointer hover:shadow-lg transition-all"
                  data-testid={`card-inspiration-${inspiration.id}`}
                  onClick={() => {
                    setInspirationImageIndex(0);
                    openInspirationDetail(inspiration);
                  }}
                >
                  <div className="aspect-square relative overflow-hidden bg-muted">
                    <img 
                      src={inspiration.coverImage || inspiration.imageUrl}
                      alt={inspiration.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    {inspiration.images && inspiration.images.length > 1 && (
                      <Badge className="absolute top-3 left-3 bg-black/60 border-0 text-white">
                        <ImageIcon className="w-3 h-3 mr-1" />
                        {inspiration.images.length}
                      </Badge>
                    )}
                    {inspiration.category && (
                      <Badge className="absolute top-3 right-3 bg-black/60 border-0 text-white">
                        {inspiration.category}
                      </Badge>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Avatar className="w-6 h-6">
                        <AvatarFallback className="text-xs">
                          {inspiration.creatorName?.split(' ').map((n: string) => n[0]).join('') || 'DT'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{inspiration.creatorName || 'Design Team'}</span>
                    </div>
                    <h4 className="font-semibold line-clamp-1">{inspiration.title}</h4>
                    {inspiration.caption && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{inspiration.caption}</p>
                    )}
                    <div className="flex items-center justify-between mt-3">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(inspiration.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                      <div className="flex items-center gap-2">
                        {!String(inspiration.id).startsWith('demo-') && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 px-2 gap-1"
                            data-testid={`button-like-inspiration-${inspiration.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleInspirationReactionMutation.mutate(inspiration.id);
                            }}
                          >
                            <Heart className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 px-2 gap-1"
                          data-testid={`button-chat-inspiration-${inspiration.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setReplyingToImage({
                              src: inspiration.imageUrl,
                              title: inspiration.title,
                              category: inspiration.category || 'Inspiration'
                            });
                            handleTabChange("messages");
                          }}
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Empty state with upload CTA */}
              {apiInspirationImages.length === 0 && INITIAL_INSPIRATION_IMAGES.length === 0 && (
                <Card className="border-dashed col-span-full">
                  <CardContent className="p-12 text-center">
                    <ImageIcon className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Inspiration Yet</h3>
                    <p className="text-muted-foreground mb-6">
                      Add design ideas, material samples, and visual references for your project.
                    </p>
                    <Button onClick={() => setCreateInspirationOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add First Inspiration
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* TIMELINE TAB */}
          <TabsContent value="timeline" className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold">Project Timeline</h3>
              <p className="text-sm text-muted-foreground">Track milestones and project phases</p>
            </div>

            {/* Project Overview - Only visible to contractors/admins */}
            {canEdit && !staticProject && (
              <Card data-testid="card-project-overview">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Project Overview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-status">Status</Label>
                    <Select 
                      value={project.status} 
                      onValueChange={(value) => {
                        updateProjectMutation.mutate({ status: value });
                      }}
                    >
                      <SelectTrigger id="edit-status" data-testid="select-edit-status">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {PROJECT_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>{status}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Progress</Label>
                      <span className="text-sm text-muted-foreground">(Auto-calculated from milestones)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all" 
                          style={{ width: `${project.progress}%` }}
                        />
                      </div>
                      <span className="font-medium text-sm" data-testid="display-progress">{project.progress}%</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-description">Description</Label>
                    <Textarea
                      id="edit-description"
                      defaultValue={project.description || ""}
                      onBlur={(e) => {
                        if (e.target.value !== (project.description || "")) {
                          updateProjectMutation.mutate({ description: e.target.value });
                        }
                      }}
                      placeholder="Project description..."
                      rows={2}
                      data-testid="textarea-edit-description"
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="p-6">
                <div className="relative">
                  {displayMilestones.map((milestone: any, index: number) => {
                    const isExpanded = expandedMilestones.includes(milestone.id);
                    const isApiPhase = apiPhases.length > 0;
                    return (
                      <div key={milestone.id} className="flex gap-4 pb-8 last:pb-0" data-testid={`milestone-${milestone.id}`}>
                        {/* Timeline line and checkbox/dot */}
                        <div className="flex flex-col items-center">
                          {/* Clickable checkbox for contractors, visual indicator for clients */}
                          {canEdit ? (
                            <button
                              onClick={() => {
                                if (isApiPhase) {
                                  togglePhaseStatus(milestone.id, milestone.originalStatus || '');
                                } else {
                                  handleStaticMilestoneClick(milestone.name, index);
                                }
                              }}
                              disabled={updatePhaseMutation.isPending || initializePhasesMutation.isPending}
                              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110 ${
                                milestone.status === 'completed' 
                                  ? 'bg-green-500 border-green-500 hover:bg-green-600' 
                                  : milestone.status === 'in_progress' 
                                    ? 'bg-primary border-primary animate-pulse hover:bg-primary/80' 
                                    : 'bg-muted border-muted-foreground/30 hover:border-primary hover:bg-primary/10'
                              }`}
                              data-testid={`checkbox-milestone-${milestone.id}`}
                            >
                              {milestone.status === 'completed' && (
                                <CheckCircle2 className="w-4 h-4 text-white" />
                              )}
                            </button>
                          ) : (
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              milestone.status === 'completed' ? 'bg-green-500 border-green-500' :
                              milestone.status === 'in_progress' ? 'bg-primary border-primary animate-pulse' :
                              'bg-muted border-muted-foreground/30'
                            }`}>
                              {milestone.status === 'completed' && (
                                <CheckCircle2 className="w-3 h-3 text-white" />
                              )}
                            </div>
                          )}
                          {index < displayMilestones.length - 1 && (
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
                            isExpanded ? 'max-h-[800px] opacity-100 mt-3 overflow-y-auto' : 'max-h-0 opacity-0'
                          }`}>
                            <div className="ml-6 pl-4 border-l-2 border-muted space-y-4">
                              {milestone.details && (
                                <p className="text-sm text-muted-foreground">{milestone.details}</p>
                              )}
                              
                              {/* Milestone Tasks - new database-backed tasks */}
                              {isApiPhase && (
                                <div className="space-y-3">
                                  <p className="text-xs font-medium text-muted-foreground">Tasks:</p>
                                  
                                  {/* Existing tasks */}
                                  {getPhaseTasks(milestone.id).length > 0 ? (
                                    <div className="space-y-2">
                                      {getPhaseTasks(milestone.id).map((task: any) => (
                                        <div key={task.id} className="flex items-center gap-3 bg-muted/30 rounded-md p-2 group" data-testid={`task-${task.id}`}>
                                          {/* Checkbox or percentage based on task type */}
                                          {task.requiresPercentage ? (
                                            <div className="flex items-center gap-2 flex-1">
                                              <span className="text-sm flex-1">{task.title}</span>
                                              {canEdit ? (
                                                <div className="flex items-center gap-2">
                                                  <input
                                                    type="range"
                                                    min="0"
                                                    max="100"
                                                    value={sliderValues[task.id] ?? task.progressPercent ?? 0}
                                                    onChange={(e) => {
                                                      const value = parseInt(e.target.value);
                                                      setSliderValues(prev => ({ ...prev, [task.id]: value }));
                                                    }}
                                                    onMouseUp={() => {
                                                      const value = sliderValues[task.id];
                                                      if (value !== undefined) {
                                                        updateMilestoneTaskMutation.mutate({ 
                                                          taskId: task.id, 
                                                          updates: { progressPercent: value, isComplete: value === 100 } 
                                                        });
                                                      }
                                                    }}
                                                    onTouchEnd={() => {
                                                      const value = sliderValues[task.id];
                                                      if (value !== undefined) {
                                                        updateMilestoneTaskMutation.mutate({ 
                                                          taskId: task.id, 
                                                          updates: { progressPercent: value, isComplete: value === 100 } 
                                                        });
                                                      }
                                                    }}
                                                    className="w-24 h-2 accent-primary cursor-pointer"
                                                    data-testid={`slider-task-${task.id}`}
                                                  />
                                                  {editingPercentTask === task.id ? (
                                                    <input
                                                      type="number"
                                                      min="0"
                                                      max="100"
                                                      value={editingPercentValue}
                                                      onChange={(e) => setEditingPercentValue(e.target.value)}
                                                      onBlur={() => {
                                                        const value = Math.min(100, Math.max(0, parseInt(editingPercentValue) || 0));
                                                        setSliderValues(prev => ({ ...prev, [task.id]: value }));
                                                        updateMilestoneTaskMutation.mutate({ 
                                                          taskId: task.id, 
                                                          updates: { progressPercent: value, isComplete: value === 100 } 
                                                        });
                                                        setEditingPercentTask(null);
                                                      }}
                                                      onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                          const value = Math.min(100, Math.max(0, parseInt(editingPercentValue) || 0));
                                                          setSliderValues(prev => ({ ...prev, [task.id]: value }));
                                                          updateMilestoneTaskMutation.mutate({ 
                                                            taskId: task.id, 
                                                            updates: { progressPercent: value, isComplete: value === 100 } 
                                                          });
                                                          setEditingPercentTask(null);
                                                        } else if (e.key === 'Escape') {
                                                          setEditingPercentTask(null);
                                                        }
                                                      }}
                                                      autoFocus
                                                      className="w-12 h-5 text-xs text-right border rounded px-1"
                                                      data-testid={`input-percent-${task.id}`}
                                                    />
                                                  ) : (
                                                    <span 
                                                      className="text-xs font-medium w-10 text-right cursor-pointer hover:bg-muted rounded px-1"
                                                      onClick={() => {
                                                        setEditingPercentTask(task.id);
                                                        setEditingPercentValue(String(sliderValues[task.id] ?? task.progressPercent ?? 0));
                                                      }}
                                                      title="Click to edit"
                                                      data-testid={`percent-display-${task.id}`}
                                                    >
                                                      {sliderValues[task.id] ?? task.progressPercent ?? 0}%
                                                    </span>
                                                  )}
                                                </div>
                                              ) : (
                                                <div className="flex items-center gap-2">
                                                  <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                                                    <div 
                                                      className="h-full bg-primary transition-all" 
                                                      style={{ width: `${task.progressPercent || 0}%` }}
                                                    />
                                                  </div>
                                                  <span className="text-xs font-medium w-10 text-right">{task.progressPercent || 0}%</span>
                                                </div>
                                              )}
                                            </div>
                                          ) : (
                                            <div className="flex items-center gap-2 flex-1">
                                              {canEdit ? (
                                                <button
                                                  onClick={() => updateMilestoneTaskMutation.mutate({ 
                                                    taskId: task.id, 
                                                    updates: { isComplete: !task.isComplete } 
                                                  })}
                                                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                                                    task.isComplete 
                                                      ? 'bg-green-500 border-green-500' 
                                                      : 'border-muted-foreground/30 hover:border-primary'
                                                  }`}
                                                  data-testid={`checkbox-task-${task.id}`}
                                                >
                                                  {task.isComplete && <CheckCircle2 className="w-3 h-3 text-white" />}
                                                </button>
                                              ) : (
                                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                                  task.isComplete 
                                                    ? 'bg-green-500 border-green-500' 
                                                    : 'border-muted-foreground/30'
                                                }`}>
                                                  {task.isComplete && <CheckCircle2 className="w-3 h-3 text-white" />}
                                                </div>
                                              )}
                                              <span className={`text-sm ${task.isComplete ? 'line-through text-muted-foreground' : ''}`}>
                                                {task.title}
                                              </span>
                                            </div>
                                          )}
                                          
                                          {/* Delete button for contractors */}
                                          {canEdit && (
                                            <button
                                              onClick={() => deleteMilestoneTaskMutation.mutate(task.id)}
                                              className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive/80 transition-opacity p-1"
                                              data-testid={`button-delete-task-${task.id}`}
                                            >
                                              <X className="w-3 h-3" />
                                            </button>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-muted-foreground italic">No tasks yet</p>
                                  )}

                                  {/* Add new task form - only for contractors */}
                                  {canEdit && (
                                    <div className="space-y-2 pt-2 border-t border-muted">
                                      <div className="flex gap-2">
                                        <Input
                                          placeholder="Add a task..."
                                          value={newTaskTitle[milestone.id] || ''}
                                          onChange={(e) => setNewTaskTitle(prev => ({ ...prev, [milestone.id]: e.target.value }))}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              e.preventDefault();
                                              addMilestoneTask(milestone.id);
                                            }
                                          }}
                                          className="text-sm h-8 flex-1"
                                          data-testid={`input-new-task-${milestone.id}`}
                                        />
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => addMilestoneTask(milestone.id)}
                                          disabled={!newTaskTitle[milestone.id]?.trim() || createMilestoneTaskMutation.isPending}
                                          className="h-8"
                                          data-testid={`button-add-task-${milestone.id}`}
                                        >
                                          <Plus className="w-3 h-3" />
                                        </Button>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <label className="text-xs text-muted-foreground flex items-center gap-2 cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={newTaskNeedsPercentage[milestone.id] || false}
                                            onChange={(e) => setNewTaskNeedsPercentage(prev => ({ ...prev, [milestone.id]: e.target.checked }))}
                                            className="rounded border-muted-foreground/30"
                                            data-testid={`checkbox-needs-percentage-${milestone.id}`}
                                          />
                                          Track percentage progress
                                        </label>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Legacy static tasks (for demo projects) */}
                              {!isApiPhase && milestone.tasks && milestone.tasks.length > 0 && (
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground mb-2">Tasks:</p>
                                  <div className="space-y-1">
                                    {milestone.tasks.map((task: string, taskIndex: number) => (
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
                              )}
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
          <TabsContent value="messages" className="mt-6">
            {user?.id ? (
              <ChatPanel 
                projectId={projectId}
                currentUserId={user.id}
                currentUserRole={user.role}
                currentUserCompanyType={user.companyType}
                initialChatId={selectedChatForMessage}
                initialImageReference={pendingImageForChat}
                onImageReferenceSent={() => {
                  setPendingImageForChat(null);
                  setSelectedChatForMessage(null);
                }}
                projectClient={apiProject?.client || null}
              />
            ) : (
            <>
            <input 
              type="file" 
              ref={messageAttachmentInputRef}
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              onChange={handleMessageFileUpload}
            />
            <Card className="flex flex-col" style={{ height: 'calc(100vh - 280px)' }}>
              <CardHeader className="border-b border-border py-4">
                <CardTitle className="text-lg">Project Communication</CardTitle>
                <CardDescription>Chat with your project team</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 overflow-auto p-0">
                <div ref={messagesContainerRef} className="h-full overflow-y-auto flex flex-col-reverse p-4">
                  <div className="space-y-4">
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
                                <div className={`flex items-center gap-1 mt-1 ${
                                  msg.isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
                                }`}>
                                  <span className="text-xs">
                                    {msg.sender} • {msg.time}
                                    {msg.isEdited && <span className="italic"> (edited)</span>}
                                  </span>
                                  {msg.isOwn && (
                                    <span className="ml-1">
                                      {msg.isRead ? (
                                        <CheckCheck className="w-3 h-3 text-blue-400" />
                                      ) : (
                                        <Check className="w-3 h-3" />
                                      )}
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              {/* Reply button for others' messages */}
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
                              
                              {/* Edit/Delete menu for own messages */}
                              {!msg.isSystem && msg.isOwn && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="absolute -left-10 top-1/2 -translate-y-1/2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                      data-testid={`button-message-menu-${msg.id}`}
                                    >
                                      <MoreVertical className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="start">
                                    <DropdownMenuItem onClick={() => handleEditMessage(msg)} data-testid={`button-edit-${msg.id}`}>
                                      <Pencil className="w-4 h-4 mr-2" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                      onClick={() => handleDeleteMessage(msg.id)} 
                                      className="text-destructive"
                                      data-testid={`button-delete-${msg.id}`}
                                    >
                                      <Trash2 className="w-4 h-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
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

                {/* Replying to progress post preview */}
                {replyingToPost && (
                  <div className="mb-3 flex items-start gap-3 p-2 bg-muted rounded-lg border border-border border-l-4 border-l-primary">
                    <img 
                      src={replyingToPost.coverImage} 
                      alt={replyingToPost.title}
                      className="w-16 h-16 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => {
                        // Find the post and open detail view
                        const post = progressPosts.find((p: any) => p.id === replyingToPost.id) || 
                          PROGRESS_PHOTOS.map((photo, idx) => ({
                            id: `demo-${photo.id}`,
                            title: photo.title,
                            caption: photo.description,
                            coverImage: `https://picsum.photos/seed/${photo.id * 456}/600/400`,
                            images: [`https://picsum.photos/seed/${photo.id * 456}/600/400`],
                            creatorName: 'Mike Builder',
                            createdAt: new Date(Date.now() - idx * 86400000 * 2).toISOString()
                          })).find(p => p.id === replyingToPost.id);
                        if (post) openPostDetail(post);
                      }}
                      data-testid="img-post-reply-preview"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-primary">Replying to Progress Update</p>
                      <p className="text-sm font-medium truncate">{replyingToPost.title}</p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 shrink-0"
                      onClick={() => setReplyingToPost(null)}
                      data-testid="button-clear-post-reply"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
                
                {/* Quick replies */}
                <div className="mb-3 flex flex-wrap gap-2">
                  {['👍', '👎', '✅', '🙏', 'Thanks!', 'Looks great!', 'Sounds good', 'On my way', 'Got it'].map((reply) => (
                    <Button
                      key={reply}
                      variant="outline"
                      size="sm"
                      className="h-7 px-3 text-sm"
                      onClick={() => {
                        setMessageText(reply);
                      }}
                      data-testid={`quick-reply-${reply}`}
                    >
                      {reply}
                    </Button>
                  ))}
                </div>
                
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
                      replyingToPost ? `Comment on "${replyingToPost.title}"...` :
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
                    disabled={!messageText.trim() && !pendingAttachment && !replyingToImage && !replyingToPost}
                    className="hover:bg-primary/90 transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
            </>
            )}
          </TabsContent>

          {/* PROGRESS PHOTOS TAB */}
          <TabsContent value="progress" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">Progress Updates</h3>
                <p className="text-sm text-muted-foreground">Updates and photos from your contractor</p>
              </div>
              {canEdit && (
                <Button 
                  onClick={() => setCreatePostOpen(true)}
                  data-testid="button-create-post"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Post
                </Button>
              )}
            </div>

            {/* Demo posts if no API posts */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(progressPosts.length > 0 ? progressPosts : PROGRESS_PHOTOS.map((photo, idx) => ({
                id: `demo-${photo.id}`,
                title: photo.title,
                caption: photo.description,
                coverImage: `https://picsum.photos/seed/${photo.id * 456}/600/400`,
                images: [`https://picsum.photos/seed/${photo.id * 456}/600/400`, `https://picsum.photos/seed/${photo.id * 789}/600/400`],
                creatorName: 'Mike Builder',
                createdAt: new Date(Date.now() - idx * 86400000 * 2).toISOString()
              }))).map((post: any) => (
                <Card 
                  key={post.id} 
                  className="group overflow-hidden cursor-pointer hover:shadow-lg transition-all"
                  data-testid={`card-post-${post.id}`}
                  onClick={() => openPostDetail(post)}
                >
                  <div className="aspect-square relative overflow-hidden bg-muted">
                    <img 
                      src={post.coverImage}
                      alt={post.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    {post.images && post.images.length > 1 && (
                      <Badge className="absolute top-3 right-3 bg-black/60 border-0 text-white">
                        <ImageIcon className="w-3 h-3 mr-1" />
                        {post.images.length}
                      </Badge>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Avatar className="w-6 h-6">
                        <AvatarFallback className="text-xs">{post.creatorName?.split(' ').map((n: string) => n[0]).join('') || 'MB'}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{post.creatorName}</span>
                    </div>
                    <h4 className="font-semibold line-clamp-1">{post.title}</h4>
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{post.caption}</p>
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* CONTRACTOR PHOTOS TAB - Only visible to contractors/admins */}
          {canEdit && (
            <TabsContent value="contractor-photos" className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold">Contractor Photos</h3>
                  <p className="text-sm text-muted-foreground">Internal photos for contractor documentation only - not visible to clients</p>
                </div>
                <Button 
                  onClick={() => setCreateContractorPhotoOpen(true)}
                  data-testid="button-create-contractor-photo"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Photo
                </Button>
              </div>

              {contractorPhotos.length === 0 ? (
                <Card className="border-dashed border-2 bg-muted/30">
                  <CardContent className="p-12 text-center">
                    <Camera className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <h4 className="font-semibold text-lg mb-2">No contractor photos yet</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Add photos for internal documentation. These are not visible to clients.
                    </p>
                    <Button 
                      onClick={() => setCreateContractorPhotoOpen(true)}
                      variant="outline"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add First Photo
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {contractorPhotos.map((photo: any) => (
                    <Card 
                      key={photo.id} 
                      className="group overflow-hidden cursor-pointer hover:shadow-lg transition-all"
                      data-testid={`card-contractor-photo-${photo.id}`}
                      onClick={() => openContractorPhotoDetail(photo)}
                    >
                      <div className="aspect-square relative overflow-hidden bg-muted">
                        <img 
                          src={photo.coverImage}
                          alt={photo.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                        <Badge className="absolute top-3 left-3 bg-orange-500 border-0 text-white">
                          Internal Only
                        </Badge>
                        {photo.images && photo.images.length > 1 && (
                          <Badge className="absolute top-3 right-3 bg-black/60 border-0 text-white">
                            <ImageIcon className="w-3 h-3 mr-1" />
                            {photo.images.length}
                          </Badge>
                        )}
                      </div>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Avatar className="w-6 h-6">
                            <AvatarFallback className="text-xs">{photo.creatorName?.split(' ').map((n: string) => n[0]).join('') || 'C'}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">{photo.creatorName}</span>
                        </div>
                        <h4 className="font-semibold line-clamp-1">{photo.title}</h4>
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{photo.caption}</p>
                        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(photo.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          )}

          {/* DOCUMENTS TAB */}
          <TabsContent value="documents" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">Project Documents</h3>
                <p className="text-sm text-muted-foreground">Contracts, permits, plans, and other important files</p>
              </div>
              {canEdit && (
                <Button 
                  onClick={() => setUploadDocumentOpen(true)}
                  data-testid="button-upload-document"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Document
                </Button>
              )}
            </div>

            {/* Signing Packets Section - Different views for client vs contractor */}
            {(() => {
              // For clients: show only packets requiring their signature (pending or viewed but not signed)
              const clientPendingPackets = signingPackets.filter((packet: any) => 
                packet.status === 'pending' && 
                packet.participants?.some((p: any) => 
                  (p.email?.toLowerCase() === user?.email?.toLowerCase() || p.userId === user?.id) && 
                  (p.status === 'pending' || p.status === 'viewed')
                )
              );
              
              // Client view: show pending documents awaiting signature
              if (!isContractorView) {
                return (
                  <>
                    {clientPendingPackets.length > 0 && (
                      <Card>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-amber-500/10 rounded-lg">
                                <Send className="w-5 h-5 text-amber-600" />
                              </div>
                              <div>
                                <CardTitle className="text-base">Documents Awaiting Your Signature</CardTitle>
                                <p className="text-xs text-muted-foreground">Click to sign these documents</p>
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="space-y-2">
                            {clientPendingPackets.map((packet: any) => (
                              <div 
                                key={packet.id}
                                className="flex items-center justify-between p-3 rounded-lg border bg-amber-50 hover:bg-amber-100 cursor-pointer transition-colors"
                                data-testid={`signing-packet-${packet.id}`}
                                onClick={() => setLocation(`/client/sign/${packet.id}`)}
                              >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <FileText className="w-4 h-4 text-amber-600 shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium truncate">{packet.title}</p>
                                    <p className="text-xs text-muted-foreground">
                                      Created {new Date(packet.createdAt).toLocaleDateString()}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <Badge variant="outline" className="border-amber-500 text-amber-600">
                                    <Clock className="w-3 h-3 mr-1" />
                                    Click to Sign
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    
                    {/* Documents Requiring Notarization - Client View */}
                    {(() => {
                      const docsNeedingNotarization = projectDocuments.filter((doc: any) => 
                        doc.requiresNotarization && doc.notarizationStatus !== 'completed'
                      );
                      if (docsNeedingNotarization.length === 0) return null;
                      
                      return (
                        <Card>
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-500/10 rounded-lg">
                                  <Shield className="w-5 h-5 text-purple-600" />
                                </div>
                                <div>
                                  <CardTitle className="text-base">Documents Requiring Notarization</CardTitle>
                                  <p className="text-xs text-muted-foreground">These documents need to be notarized</p>
                                </div>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <div className="space-y-3">
                              {docsNeedingNotarization.map((doc: any) => {
                                const notaryProfile = notaryProfiles.find((p: any) => p.id === doc.notaryProfileId);
                                return (
                                  <div 
                                    key={doc.id}
                                    className="p-4 rounded-lg border bg-purple-50"
                                    data-testid={`notarization-doc-${doc.id}`}
                                  >
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="flex items-start gap-3 flex-1 min-w-0">
                                        <FileText className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                                        <div className="min-w-0 space-y-1">
                                          <p className="font-medium truncate">{doc.name}</p>
                                          {doc.notarizationDueDate && (
                                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                              <Calendar className="w-3 h-3" />
                                              Due: {new Date(doc.notarizationDueDate).toLocaleDateString()}
                                            </p>
                                          )}
                                          {doc.notarizationStatus === 'awaiting_approval' && (
                                            <Badge className="bg-amber-500 text-white border-0 text-xs">
                                              <Clock className="w-3 h-3 mr-1" />
                                              Awaiting Approval
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                      <div className="shrink-0 flex gap-2">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => window.open(doc.fileUrl, '_blank')}
                                        >
                                          <Download className="w-4 h-4 mr-1" />
                                          Download
                                        </Button>
                                        {doc.notarizationStatus !== 'awaiting_approval' && (
                                          <Button
                                            size="sm"
                                            onClick={() => {
                                              setNotarizationUploadDocId(doc.id);
                                              setNotarizationUploadDialogOpen(true);
                                            }}
                                            data-testid={`button-upload-notarized-${doc.id}`}
                                          >
                                            <Upload className="w-4 h-4 mr-1" />
                                            Upload Notarized
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                    {notaryProfile && (
                                      <div className="mt-3 p-3 bg-white rounded border">
                                        <p className="text-xs font-medium text-muted-foreground mb-1">Recommended Notary:</p>
                                        <p className="text-sm font-medium">{notaryProfile.name}</p>
                                        {notaryProfile.companyName && (
                                          <p className="text-xs text-muted-foreground">{notaryProfile.companyName}</p>
                                        )}
                                        {notaryProfile.phone && (
                                          <p className="text-xs text-muted-foreground">{notaryProfile.phone}</p>
                                        )}
                                        {notaryProfile.email && (
                                          <p className="text-xs text-muted-foreground">{notaryProfile.email}</p>
                                        )}
                                        {notaryProfile.address && (
                                          <p className="text-xs text-muted-foreground">
                                            {notaryProfile.address}{notaryProfile.city ? `, ${notaryProfile.city}` : ''}{notaryProfile.state ? `, ${notaryProfile.state}` : ''} {notaryProfile.zipCode}
                                          </p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })()}
                  </>
                );
              }
              
              // Contractor/Admin view: show all packets with status badges
              if (signingPackets.length > 0) {
                return (
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <Send className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-base">Signature Requests</CardTitle>
                            <p className="text-xs text-muted-foreground">Track documents sent for electronic signature</p>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        {signingPackets.map((packet: any) => (
                          <div 
                            key={packet.id}
                            className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                            data-testid={`signing-packet-${packet.id}`}
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{packet.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {packet.participants?.length || 0} recipient(s) • Created {new Date(packet.createdAt).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {packet.status === 'completed' && (
                                <Badge className="bg-green-500 text-white border-0">
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  Completed
                                </Badge>
                              )}
                              {packet.status === 'pending' && (
                                <Badge variant="outline" className="border-amber-500 text-amber-600">
                                  <Clock className="w-3 h-3 mr-1" />
                                  Pending
                                </Badge>
                              )}
                              {packet.status === 'cancelled' && (
                                <Badge variant="outline" className="border-gray-400 text-gray-500">
                                  Cancelled
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              }
              
              return null;
            })()}

            {/* Document Categories - Dynamic */}
            {documentsLoading ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading documents...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(documentTypeConfig).map(([type, config]) => {
                  const docs = documentsByType[type] || [];
                  const IconComponent = config.icon;
                  const colorClasses: Record<string, { bg: string; text: string }> = {
                    blue: { bg: 'bg-blue-500/10', text: 'text-blue-600' },
                    purple: { bg: 'bg-purple-500/10', text: 'text-purple-600' },
                    green: { bg: 'bg-green-500/10', text: 'text-green-600' },
                    amber: { bg: 'bg-amber-500/10', text: 'text-amber-600' },
                    cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-600' },
                  };
                  const colors = colorClasses[config.color] || colorClasses.blue;
                  
                  return (
                    <Card key={type} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 ${colors.bg} rounded-lg`}>
                            <IconComponent className={`w-5 h-5 ${colors.text}`} />
                          </div>
                          <div>
                            <CardTitle className="text-base">{config.label}</CardTitle>
                            <p className="text-xs text-muted-foreground">{config.description}</p>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-2">
                          {docs.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-2">No documents yet</p>
                          ) : (
                            docs.map((doc: any) => (
                              <div 
                                key={doc.id}
                                className="flex items-center justify-between p-2 rounded-lg hover:bg-muted cursor-pointer group" 
                                data-testid={`doc-${type}-${doc.id}`}
                                onClick={() => openDocumentViewer(doc)}
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                                  <span className="text-sm truncate">{doc.name}</span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  {canEdit && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDocumentToSign({ id: doc.id, name: doc.name });
                                        setSendForSignatureOpen(true);
                                      }}
                                      title="Send for Signature"
                                      data-testid={`button-sign-${doc.id}`}
                                    >
                                      <Send className="w-4 h-4 text-primary" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      downloadDocument(doc);
                                    }}
                                    data-testid={`button-download-${doc.id}`}
                                  >
                                    <Download className="w-4 h-4 text-muted-foreground" />
                                  </Button>
                                  {canEdit && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteDocument({ id: doc.id, name: doc.name });
                                      }}
                                      data-testid={`button-delete-${doc.id}`}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ACTION CENTER TAB */}
          <TabsContent value="action-center" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Action Center
                </CardTitle>
                <CardDescription>
                  {isContractorView 
                    ? "Documents requiring signature setup and pending signatures"
                    : "Documents that need your signature"
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isContractorView ? (
                  // Contractor View - Show documents pending setup
                  <div className="space-y-4">
                    {pendingActionDocs.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        No documents pending signature setup
                      </p>
                    ) : (
                      pendingActionDocs.map((doc: any) => (
                        <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <FileText className="h-8 w-8 text-blue-500" />
                            <div>
                              <p className="font-medium">{doc.name}</p>
                              <p className="text-sm text-muted-foreground">
                                Will be filed under: {documentTypeConfig[doc.finalDocumentType as keyof typeof documentTypeConfig]?.label || doc.finalDocumentType}
                              </p>
                              <Badge variant={doc.signatureStatus === 'pending_setup' ? 'outline' : 'secondary'} className="mt-1">
                                {doc.signatureStatus === 'pending_setup' ? 'Needs Setup' : 'Awaiting Signature'}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openDocumentViewer(doc)}
                            >
                              View
                            </Button>
                            {doc.signatureStatus === 'pending_setup' && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setLocation(`${projectBasePath}/signature-setup/${doc.id}`);
                                }}
                              >
                                Set Up Signing
                              </Button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  // Client View - Show documents needing their signature
                  <div className="space-y-4">
                    {pendingActionPackets.filter((p: any) => 
                      p.participants?.some((part: any) => part.status === 'pending' && part.email === user?.email)
                    ).length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        No documents requiring your signature
                      </p>
                    ) : (
                      pendingActionPackets
                        .filter((p: any) => 
                          p.participants?.some((part: any) => part.status === 'pending' && part.email === user?.email)
                        )
                        .map((packet: any) => {
                          const myParticipant = packet.participants?.find((p: any) => p.email === user?.email);
                          return (
                            <div key={packet.id} className="flex items-center justify-between p-4 border rounded-lg">
                              <div className="flex items-center gap-3">
                                <FileText className="h-8 w-8 text-orange-500" />
                                <div>
                                  <p className="font-medium">{packet.title}</p>
                                  <p className="text-sm text-muted-foreground">
                                    From: {packet.createdByName}
                                  </p>
                                  {packet.dueDate && (
                                    <p className="text-sm text-orange-600">
                                      Due: {new Date(packet.dueDate).toLocaleDateString()}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => {
                                  // Navigate to authenticated signing page using packet ID
                                  setLocation(`/client/sign/${packet.id}`);
                                }}
                              >
                                Sign Document
                              </Button>
                            </div>
                          );
                        })
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
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

      {/* Send for Signature Dialog */}
      <SendForSignatureDialog
        open={sendForSignatureOpen}
        onOpenChange={setSendForSignatureOpen}
        projectId={projectId || ""}
        document={documentToSign}
      />

      {/* Upload Document Dialog - Multi-step wizard */}
      <Dialog open={uploadDocumentOpen} onOpenChange={(open) => {
        setUploadDocumentOpen(open);
        if (!open) {
          setUploadWizardStep(1);
          setNewDocumentType("");
          setNewDocumentFile(null);
          setRequiresSignature(false);
          setRequiresNotarization(false);
          setNotarizationDueDate("");
          setSelectedNotaryProfileId("");
          setShowCreateNotaryProfile(false);
          setNewNotaryProfile({ name: "", email: "", phone: "", companyName: "", address: "", city: "", state: "", zipCode: "" });
          setSignatureFields([]);
          setSignatureDueDate("");
          setSignatureMessage("");
        }
      }}>
        <DialogContent className={uploadWizardStep === 2 ? "max-w-2xl max-h-[90vh] overflow-y-auto" : "max-w-md"}>
          <DialogHeader>
            <DialogTitle>
              {uploadWizardStep === 1 ? 'Upload Document' : 'Set Up Signature Fields'}
            </DialogTitle>
            <DialogDescription>
              {uploadWizardStep === 1 
                ? 'Select a document type and upload your file.'
                : `Set up signature requirements for "${newDocumentFile?.name}"`}
            </DialogDescription>
          </DialogHeader>
          
          {uploadWizardStep === 1 ? (
            <>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="document-type">Document Type</Label>
                  <Select value={newDocumentType} onValueChange={setNewDocumentType}>
                    <SelectTrigger id="document-type" data-testid="select-document-type">
                      <SelectValue placeholder="Select document type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contracts">Contracts</SelectItem>
                      <SelectItem value="plans">Plans & Drawings</SelectItem>
                      <SelectItem value="permits">Permits & Approvals</SelectItem>
                      <SelectItem value="invoices">Invoices & Payments</SelectItem>
                      <SelectItem value="warranties">Warranties & Manuals</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2 py-2">
                  <Checkbox
                    id="requires-signature"
                    checked={requiresSignature}
                    onCheckedChange={(checked) => setRequiresSignature(checked === true)}
                    data-testid="checkbox-requires-signature"
                  />
                  <Label htmlFor="requires-signature" className="text-sm font-medium cursor-pointer">
                    Signature Required
                  </Label>
                </div>
                {requiresSignature && (
                  <p className="text-xs text-muted-foreground bg-blue-50 text-blue-700 p-2 rounded border border-blue-200">
                    After uploading, you'll set up signature fields and recipients in the next step.
                  </p>
                )}
                <div className="flex items-center space-x-2 py-2">
                  <Checkbox
                    id="requires-notarization"
                    checked={requiresNotarization}
                    onCheckedChange={(checked) => setRequiresNotarization(checked === true)}
                    data-testid="checkbox-requires-notarization"
                  />
                  <Label htmlFor="requires-notarization" className="text-sm font-medium cursor-pointer">
                    Notarization Required
                  </Label>
                </div>
                {requiresNotarization && (
                  <div className="space-y-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-700">
                      The client will be notified that this document requires notarization.
                    </p>
                    <div className="space-y-2">
                      <Label htmlFor="notarization-due-date">Due Date</Label>
                      <Input
                        type="date"
                        id="notarization-due-date"
                        value={notarizationDueDate}
                        onChange={(e) => setNotarizationDueDate(e.target.value)}
                        data-testid="input-notarization-due-date"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Recommended Notary <span className="text-red-500">*</span></Label>
                      {showCreateNotaryProfile ? (
                        <div className="space-y-3 p-3 border rounded-lg bg-white">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Name *</Label>
                              <Input
                                placeholder="Notary name"
                                value={newNotaryProfile.name}
                                onChange={(e) => setNewNotaryProfile({...newNotaryProfile, name: e.target.value})}
                                data-testid="input-new-notary-name"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Company</Label>
                              <Input
                                placeholder="Company name"
                                value={newNotaryProfile.companyName}
                                onChange={(e) => setNewNotaryProfile({...newNotaryProfile, companyName: e.target.value})}
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Email</Label>
                              <Input
                                placeholder="email@example.com"
                                value={newNotaryProfile.email}
                                onChange={(e) => setNewNotaryProfile({...newNotaryProfile, email: e.target.value})}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Phone</Label>
                              <Input
                                placeholder="(555) 123-4567"
                                value={newNotaryProfile.phone}
                                onChange={(e) => setNewNotaryProfile({...newNotaryProfile, phone: e.target.value})}
                              />
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs">Address</Label>
                            <Input
                              placeholder="Street address"
                              value={newNotaryProfile.address}
                              onChange={(e) => setNewNotaryProfile({...newNotaryProfile, address: e.target.value})}
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <Label className="text-xs">City</Label>
                              <Input
                                placeholder="City"
                                value={newNotaryProfile.city}
                                onChange={(e) => setNewNotaryProfile({...newNotaryProfile, city: e.target.value})}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">State</Label>
                              <Input
                                placeholder="FL"
                                value={newNotaryProfile.state}
                                onChange={(e) => setNewNotaryProfile({...newNotaryProfile, state: e.target.value})}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">ZIP</Label>
                              <Input
                                placeholder="33101"
                                value={newNotaryProfile.zipCode}
                                onChange={(e) => setNewNotaryProfile({...newNotaryProfile, zipCode: e.target.value})}
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setShowCreateNotaryProfile(false)}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              disabled={!newNotaryProfile.name || createNotaryProfileMutation.isPending}
                              onClick={() => createNotaryProfileMutation.mutate(newNotaryProfile)}
                              data-testid="button-save-notary-profile"
                            >
                              {createNotaryProfileMutation.isPending ? 'Saving...' : 'Save Notary'}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Select value={selectedNotaryProfileId} onValueChange={setSelectedNotaryProfileId}>
                            <SelectTrigger data-testid="select-notary-profile">
                              <SelectValue placeholder="Select a notary" />
                            </SelectTrigger>
                            <SelectContent>
                              {notaryProfiles.map((profile: any) => (
                                <SelectItem key={profile.id} value={profile.id}>
                                  {profile.name} {profile.companyName ? `(${profile.companyName})` : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => setShowCreateNotaryProfile(true)}
                            data-testid="button-add-new-notary"
                          >
                            + Add New Notary
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>File</Label>
                  <input
                    type="file"
                    ref={documentFileInputRef}
                    className="hidden"
                    accept=".pdf,.xls,.xlsx,.png,.jpg,.jpeg,.gif"
                    onChange={(e) => {
                      if (e.target.files) {
                        handleDocumentFileUpload(e.target.files);
                      }
                    }}
                  />
                  {uploadError && (
                    <div className="p-3 rounded-lg border border-red-200 bg-red-50 mb-2">
                      <div className="flex items-start gap-2">
                        <X className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-red-700">Upload Failed</p>
                          <p className="text-xs text-red-600 mt-1">{uploadError}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-red-600 hover:text-red-800"
                          onClick={() => setUploadError(null)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                  {isUploadingDocument ? (
                    <div className="p-3 rounded-lg border bg-muted/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{uploadPhaseLabel}</span>
                        <span className="text-sm font-semibold text-primary">{uploadProgress}%</span>
                      </div>
                      <Progress value={uploadProgress} className="h-2" />
                    </div>
                  ) : newDocumentFile ? (
                    <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/50">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <span className="text-sm flex-1 truncate">{newDocumentFile.name}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setNewDocumentFile(null)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => documentFileInputRef.current?.click()}
                      data-testid="button-select-file"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Select File
                    </Button>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setUploadDocumentOpen(false);
                    setNewDocumentType("");
                    setNewDocumentFile(null);
                    setRequiresSignature(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateDocument}
                  disabled={!newDocumentType || !newDocumentFile || createDocumentMutation.isPending || isUploadingDocument}
                  data-testid="button-submit-document"
                >
                  {createDocumentMutation.isPending ? 'Saving...' : 'Save Document'}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="space-y-6 py-4">
                {/* Error Display */}
                {signatureCreationError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700">{signatureCreationError}</p>
                  </div>
                )}

                {/* Sending To Info */}
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <span className="font-medium">Sending to:</span>{' '}
                    {apiProject?.client ? (
                      <>{apiProject.client.name} ({apiProject.client.email})</>
                    ) : (
                      <span className="text-amber-600">No client assigned to this project</span>
                    )}
                  </p>
                </div>

                {/* Visual Signature Field Editor */}
                {newDocumentFile && (
                  <div className="space-y-3">
                    <Label className="text-base font-semibold">Place Signature Fields</Label>
                    <p className="text-sm text-muted-foreground">
                      Click "Add" to place fields on the document, then drag and resize them to position.
                    </p>
                    <SignatureFieldEditor
                      documentId=""
                      documentUrl={newDocumentFile.objectPath}
                      documentMimeType={newDocumentFile.mimeType}
                      fields={signatureFields}
                      onFieldsChange={setSignatureFields}
                    />
                  </div>
                )}

                {/* Due Date & Message */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Due Date (Required)</Label>
                    <Input
                      type="date"
                      value={signatureDueDate}
                      onChange={(e) => setSignatureDueDate(e.target.value)}
                      required
                      data-testid="input-signature-due-date"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Message to Recipients (Optional)</Label>
                  <Input
                    placeholder="Add a message for the signers..."
                    value={signatureMessage}
                    onChange={(e) => setSignatureMessage(e.target.value)}
                    data-testid="input-signature-message"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setUploadWizardStep(1)}
                >
                  Back
                </Button>
                <Button
                  onClick={handleCreateDocumentWithSignature}
                  disabled={
                    signatureFields.length === 0 || 
                    !apiProject?.client ||
                    !signatureDueDate ||
                    createDocumentWithSignatureMutation.isPending
                  }
                  data-testid="button-save-with-signature"
                >
                  {createDocumentWithSignatureMutation.isPending ? 'Saving...' : 'Save Document'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Document Confirmation Dialog */}
      <AlertDialog open={deleteDocumentDialogOpen} onOpenChange={setDeleteDocumentDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{documentToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDocumentToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteDocument}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteDocumentMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Notarization Upload Dialog (for clients to upload externally notarized documents) */}
      <Dialog open={notarizationUploadDialogOpen} onOpenChange={(open) => {
        setNotarizationUploadDialogOpen(open);
        if (!open) {
          setNotarizationUploadDocId(null);
          setNotarizedFile(null);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Notarized Document</DialogTitle>
            <DialogDescription>
              Upload the notarized version of this document. It will be reviewed by your project manager.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <input
              type="file"
              ref={notarizedFileInputRef}
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => {
                if (e.target.files) {
                  handleNotarizedFileUpload(e.target.files);
                }
              }}
            />
            {isUploadingNotarized ? (
              <div className="p-3 rounded-lg border bg-muted/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Uploading...</span>
                  <span className="text-sm font-semibold text-primary">{notarizedUploadProgress}%</span>
                </div>
                <Progress value={notarizedUploadProgress} className="h-2" />
              </div>
            ) : notarizedFile ? (
              <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/50">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span className="text-sm flex-1 truncate">{notarizedFile.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setNotarizedFile(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => notarizedFileInputRef.current?.click()}
                data-testid="button-select-notarized-file"
              >
                <Upload className="w-4 h-4 mr-2" />
                Select Notarized File
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setNotarizationUploadDialogOpen(false);
                setNotarizedFile(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (notarizationUploadDocId && notarizedFile) {
                  uploadNotarizedDocMutation.mutate({
                    documentId: notarizationUploadDocId,
                    notarizedFileUrl: notarizedFile.objectPath
                  });
                }
              }}
              disabled={!notarizedFile || uploadNotarizedDocMutation.isPending}
              data-testid="button-submit-notarized-doc"
            >
              {uploadNotarizedDocMutation.isPending ? 'Submitting...' : 'Submit for Approval'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Message Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Message</DialogTitle>
            <DialogDescription>
              Make changes to your message below.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder="Type your message..."
              data-testid="input-edit-message"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (editingMessage && editContent.trim()) {
                  editMessageMutation.mutate({ 
                    messageId: editingMessage.id, 
                    content: editContent.trim() 
                  });
                }
              }}
              disabled={editMessageMutation.isPending}
              data-testid="button-save-edit"
            >
              {editMessageMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Post Detail Dialog */}
      <Dialog open={postDetailOpen} onOpenChange={setPostDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0">
          {selectedPost && (
            <div className="flex flex-col md:flex-row h-full max-h-[90vh]">
              {/* Image Section */}
              <div className="relative bg-black flex-1 min-h-[300px] md:min-h-0">
                <img 
                  src={selectedPost.images?.[postImageIndex] || selectedPost.coverImage}
                  alt={selectedPost.title}
                  className="w-full h-full object-contain"
                />
                {selectedPost.images && selectedPost.images.length > 1 && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                      onClick={() => setPostImageIndex(prev => prev > 0 ? prev - 1 : selectedPost.images.length - 1)}
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                      onClick={() => setPostImageIndex(prev => prev < selectedPost.images.length - 1 ? prev + 1 : 0)}
                    >
                      <ChevronRight className="w-5 h-5" />
                    </Button>
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {selectedPost.images.map((_: any, idx: number) => (
                        <button
                          key={idx}
                          className={`w-2 h-2 rounded-full transition-colors ${idx === postImageIndex ? 'bg-white' : 'bg-white/50'}`}
                          onClick={() => setPostImageIndex(idx)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Details Section */}
              <div className="w-full md:w-[350px] flex flex-col bg-background">
                <div className="p-4 border-b">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback>{selectedPost.creatorName?.split(' ').map((n: string) => n[0]).join('') || 'MB'}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{selectedPost.creatorName}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(selectedPost.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <h3 className="font-bold text-lg mt-3">{selectedPost.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{selectedPost.caption}</p>
                </div>

                {/* Actions */}
                <div className="px-4 py-3 border-b flex items-center gap-4">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="gap-2"
                    onClick={() => toggleReactionMutation.mutate(selectedPost.id)}
                    data-testid="button-like-post"
                  >
                    <Heart className={`w-5 h-5 ${postReactions.length > 0 ? 'fill-red-500 text-red-500' : ''}`} />
                    <span>{postReactions.length}</span>
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="gap-2"
                    data-testid="button-comment-count"
                  >
                    <MessageCircle className="w-5 h-5" />
                    <span>{postComments.length}</span>
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="gap-2 ml-auto"
                    onClick={() => {
                      setReplyingToPost({ id: selectedPost.id, title: selectedPost.title, coverImage: selectedPost.coverImage });
                      setPostDetailOpen(false);
                      handleTabChange('messages');
                    }}
                    data-testid="button-reply-in-chat"
                  >
                    <Reply className="w-5 h-5" />
                    Reply
                  </Button>
                  {canEdit && !selectedPost.id.startsWith('demo-') && 
                   (user?.role === 'admin' || selectedPost.creatorId === user?.id) && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="gap-2 text-destructive hover:text-destructive"
                      onClick={() => handleDeletePost(selectedPost.id)}
                      data-testid="button-delete-post"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                {/* Comments */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[200px] md:max-h-none">
                  {postComments.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No comments yet</p>
                  ) : (
                    postComments.map((comment: any) => (
                      <div key={comment.id} className="flex gap-2">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="text-xs">{getInitials(comment.userName)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="text-sm">
                            <span className="font-semibold">{comment.userName}</span>{' '}
                            {comment.content}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(comment.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Add Comment */}
                <div className="p-4 border-t flex gap-2">
                  <Input
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newComment.trim()) {
                        addCommentMutation.mutate({ postId: selectedPost.id, content: newComment.trim() });
                      }
                    }}
                    data-testid="input-new-comment"
                  />
                  <Button 
                    size="sm"
                    disabled={!newComment.trim() || addCommentMutation.isPending}
                    onClick={() => {
                      if (newComment.trim()) {
                        addCommentMutation.mutate({ postId: selectedPost.id, content: newComment.trim() });
                      }
                    }}
                    data-testid="button-post-comment"
                  >
                    Post
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Post Modal */}
      <Dialog open={createPostOpen} onOpenChange={(open) => {
        setCreatePostOpen(open);
        if (!open) {
          setNewPostTitle("");
          setNewPostCaption("");
          setNewPostImages([]);
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Progress Post</DialogTitle>
            <DialogDescription>Share project updates with photos</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="post-title">Title</Label>
              <Input
                id="post-title"
                placeholder="e.g., Kitchen Framing Complete"
                value={newPostTitle}
                onChange={(e) => setNewPostTitle(e.target.value)}
                data-testid="input-post-title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="post-caption">Description</Label>
              <Textarea
                id="post-caption"
                placeholder="Describe the progress made..."
                value={newPostCaption}
                onChange={(e) => setNewPostCaption(e.target.value)}
                rows={3}
                data-testid="input-post-caption"
              />
            </div>

            <div className="space-y-2">
              <Label>Photos</Label>
              <input
                type="file"
                ref={postImageInputRef}
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handlePostImageUpload(e.target.files);
                    e.target.value = '';
                  }
                }}
              />
              
              {newPostImages.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {newPostImages.map((url, idx) => (
                    <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                      <img src={url} alt={`Upload ${idx + 1}`} className="w-full h-full object-cover" />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 w-6 h-6"
                        onClick={() => setNewPostImages(prev => prev.filter((_, i) => i !== idx))}
                        data-testid={`button-remove-image-${idx}`}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => postImageInputRef.current?.click()}
                data-testid="button-upload-post-images"
              >
                <Upload className="w-4 h-4 mr-2" />
                {newPostImages.length > 0 ? 'Add More Photos' : 'Upload Photos'}
              </Button>
              <p className="text-xs text-muted-foreground">Max 5MB per image. At least one photo required.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreatePostOpen(false)} data-testid="button-cancel-post">
              Cancel
            </Button>
            <Button 
              onClick={handleCreatePost}
              disabled={!newPostTitle.trim() || newPostImages.length === 0 || createPostMutation.isPending}
              data-testid="button-submit-post"
            >
              {createPostMutation.isPending ? 'Creating...' : 'Create Post'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Contractor Photo Modal */}
      <Dialog open={createContractorPhotoOpen} onOpenChange={(open) => {
        setCreateContractorPhotoOpen(open);
        if (!open) {
          setNewContractorPhotoTitle("");
          setNewContractorPhotoCaption("");
          setNewContractorPhotoImages([]);
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Contractor Photo</DialogTitle>
            <DialogDescription>Add internal photos for contractor documentation (not visible to clients)</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contractor-photo-title">Title</Label>
              <Input
                id="contractor-photo-title"
                placeholder="e.g., Behind Wall Documentation"
                value={newContractorPhotoTitle}
                onChange={(e) => setNewContractorPhotoTitle(e.target.value)}
                data-testid="input-contractor-photo-title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contractor-photo-caption">Description</Label>
              <Textarea
                id="contractor-photo-caption"
                placeholder="Add notes about what's documented..."
                value={newContractorPhotoCaption}
                onChange={(e) => setNewContractorPhotoCaption(e.target.value)}
                rows={3}
                data-testid="input-contractor-photo-caption"
              />
            </div>

            <div className="space-y-2">
              <Label>Photos</Label>
              <input
                type="file"
                ref={contractorPhotoInputRef}
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleContractorPhotoImageUpload(e.target.files);
                    e.target.value = '';
                  }
                }}
              />
              
              {newContractorPhotoImages.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {newContractorPhotoImages.map((url, idx) => (
                    <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                      <img src={url} alt={`Upload ${idx + 1}`} className="w-full h-full object-cover" />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 w-6 h-6"
                        onClick={() => setNewContractorPhotoImages(prev => prev.filter((_, i) => i !== idx))}
                        data-testid={`button-remove-contractor-image-${idx}`}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => contractorPhotoInputRef.current?.click()}
                data-testid="button-upload-contractor-photos"
              >
                <Upload className="w-4 h-4 mr-2" />
                {newContractorPhotoImages.length > 0 ? 'Add More Photos' : 'Upload Photos'}
              </Button>
              <p className="text-xs text-muted-foreground">Max 5MB per image. At least one photo required.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateContractorPhotoOpen(false)} data-testid="button-cancel-contractor-photo">
              Cancel
            </Button>
            <Button 
              onClick={handleCreateContractorPhoto}
              disabled={!newContractorPhotoTitle.trim() || newContractorPhotoImages.length === 0 || createContractorPhotoMutation.isPending}
              data-testid="button-submit-contractor-photo"
            >
              {createContractorPhotoMutation.isPending ? 'Adding...' : 'Add Photo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contractor Photo Detail Modal */}
      <Dialog open={contractorPhotoDetailOpen} onOpenChange={setContractorPhotoDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedContractorPhoto && (
            <>
              <DialogHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <Badge className="mb-2 bg-orange-500 text-white">Internal Only</Badge>
                    <DialogTitle>{selectedContractorPhoto.title}</DialogTitle>
                    <DialogDescription>
                      <div className="flex items-center gap-2 mt-1">
                        <Avatar className="w-5 h-5">
                          <AvatarFallback className="text-xs">{selectedContractorPhoto.creatorName?.split(' ').map((n: string) => n[0]).join('') || 'C'}</AvatarFallback>
                        </Avatar>
                        <span>{selectedContractorPhoto.creatorName}</span>
                        <span className="text-muted-foreground">•</span>
                        <span>{new Date(selectedContractorPhoto.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                    </DialogDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteContractorPhoto(selectedContractorPhoto.id)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    data-testid="button-delete-contractor-photo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </DialogHeader>
              
              <div className="space-y-4">
                {selectedContractorPhoto.caption && (
                  <p className="text-muted-foreground">{selectedContractorPhoto.caption}</p>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  {selectedContractorPhoto.images?.map((img: string, idx: number) => (
                    <div 
                      key={idx} 
                      className="aspect-video rounded-lg overflow-hidden bg-muted cursor-pointer"
                      onClick={() => {
                        setViewerImages(selectedContractorPhoto.images.map((url: string) => ({ url, title: selectedContractorPhoto.title })));
                        setViewerInitialIndex(idx);
                        setViewerOpen(true);
                      }}
                    >
                      <img 
                        src={img} 
                        alt={`${selectedContractorPhoto.title} - Image ${idx + 1}`} 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Inspiration Modal */}
      <Dialog open={createInspirationOpen} onOpenChange={(open) => {
        setCreateInspirationOpen(open);
        if (!open) {
          // Clean up blob URLs
          newInspirationImages.forEach(url => {
            if (url.startsWith('blob:')) {
              URL.revokeObjectURL(url);
            }
          });
          setNewInspirationTitle("");
          setNewInspirationCaption("");
          setNewInspirationCategory("");
          setNewInspirationImages([]);
          setInspirationFilesToUpload([]);
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Inspiration</DialogTitle>
            <DialogDescription>Share design ideas and material selections</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <input
              type="file"
              ref={inspirationFileInputRef}
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleInspirationFileSelect}
            />

            {newInspirationImages.length > 0 ? (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  {newInspirationImages.map((url, idx) => (
                    <div key={idx} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                      <img src={url} alt={`Upload ${idx + 1}`} className="w-full h-full object-cover" />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 w-6 h-6"
                        onClick={() => removeInspirationImage(idx)}
                        data-testid={`button-remove-inspiration-image-${idx}`}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => inspirationFileInputRef.current?.click()}
                  data-testid="button-add-more-inspiration-images"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Add More Photos
                </Button>
                <p className="text-xs text-muted-foreground">Max 5MB per image.</p>
              </div>
            ) : (
              <div
                className="aspect-video border-2 border-dashed border-muted-foreground/30 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => inspirationFileInputRef.current?.click()}
              >
                <ImageIcon className="w-10 h-10 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">Click to upload images</span>
                <span className="text-xs text-muted-foreground mt-1">You can select multiple photos</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="inspiration-title">Title</Label>
              <Input
                id="inspiration-title"
                placeholder="e.g., Kitchen Backsplash Idea"
                value={newInspirationTitle}
                onChange={(e) => setNewInspirationTitle(e.target.value)}
                data-testid="input-inspiration-title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="inspiration-category">Category <span className="text-destructive">*</span></Label>
              <Select value={newInspirationCategory} onValueChange={setNewInspirationCategory}>
                <SelectTrigger id="inspiration-category" data-testid="select-inspiration-category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Kitchen">Kitchen</SelectItem>
                  <SelectItem value="Bathroom">Bathroom</SelectItem>
                  <SelectItem value="Flooring">Flooring</SelectItem>
                  <SelectItem value="Exterior">Exterior</SelectItem>
                  <SelectItem value="Lighting">Lighting</SelectItem>
                  <SelectItem value="Living Room">Living Room</SelectItem>
                  <SelectItem value="Bedroom">Bedroom</SelectItem>
                  <SelectItem value="Outdoor">Outdoor</SelectItem>
                  <SelectItem value="Paint & Colors">Paint & Colors</SelectItem>
                  <SelectItem value="Materials">Materials</SelectItem>
                  <SelectItem value="Fixtures">Fixtures</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="inspiration-caption">Description (optional)</Label>
              <Textarea
                id="inspiration-caption"
                placeholder="Add notes about this design idea..."
                value={newInspirationCaption}
                onChange={(e) => setNewInspirationCaption(e.target.value)}
                rows={3}
                data-testid="input-inspiration-caption"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateInspirationOpen(false)} data-testid="button-cancel-inspiration">
              Cancel
            </Button>
            <Button 
              onClick={createInspiration}
              disabled={!newInspirationTitle.trim() || !newInspirationCategory || inspirationFilesToUpload.length === 0 || inspirationUploading || createInspirationMutation.isPending}
              data-testid="button-submit-inspiration"
            >
              {inspirationUploading ? 'Uploading...' : createInspirationMutation.isPending ? 'Adding...' : 'Add Inspiration'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inspiration Detail Modal */}
      <Dialog open={inspirationDetailOpen} onOpenChange={(open) => {
        setInspirationDetailOpen(open);
        if (!open) {
          setSelectedInspiration(null);
          setNewInspirationComment("");
          setInspirationImageIndex(0);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
          {/* Delete button positioned next to close button - uses same styling as DialogPrimitive.Close */}
          {selectedInspiration && canEdit && !String(selectedInspiration.id).startsWith('demo-') && (
            <button 
              tabIndex={-1}
              className="absolute right-12 top-4 z-50 rounded-sm p-1 ring-offset-background transition-all hover:bg-destructive/10 focus:outline-none text-destructive"
              onClick={() => {
                if (confirm('Delete this inspiration image?')) {
                  deleteInspirationMutation.mutate(selectedInspiration.id);
                }
              }}
              data-testid="button-delete-inspiration"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          {selectedInspiration && (
            <div className="flex flex-col md:flex-row h-full max-h-[90vh]">
              {/* Image Section with Carousel */}
              <div className="md:w-1/2 bg-black flex items-center justify-center relative">
                <img 
                  src={(selectedInspiration.images && selectedInspiration.images.length > 0) 
                    ? selectedInspiration.images[inspirationImageIndex] 
                    : (selectedInspiration.coverImage || selectedInspiration.imageUrl)}
                  alt={selectedInspiration.title}
                  className="w-full h-auto max-h-[50vh] md:max-h-[90vh] object-contain"
                />
                {/* Carousel Navigation */}
                {selectedInspiration.images && selectedInspiration.images.length > 1 && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                      onClick={() => setInspirationImageIndex(prev => prev > 0 ? prev - 1 : selectedInspiration.images.length - 1)}
                      data-testid="button-inspiration-prev-image"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                      onClick={() => setInspirationImageIndex(prev => prev < selectedInspiration.images.length - 1 ? prev + 1 : 0)}
                      data-testid="button-inspiration-next-image"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </Button>
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {selectedInspiration.images.map((_: any, idx: number) => (
                        <button
                          key={idx}
                          className={`w-2 h-2 rounded-full transition-colors ${idx === inspirationImageIndex ? 'bg-white' : 'bg-white/50'}`}
                          onClick={() => setInspirationImageIndex(idx)}
                          data-testid={`button-inspiration-dot-${idx}`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Details Section */}
              <div className="md:w-1/2 flex flex-col max-h-[40vh] md:max-h-[90vh]">
                {/* Header */}
                <div className="p-4 border-b flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>
                        {selectedInspiration.creatorName?.split(' ').map((n: string) => n[0]).join('') || 'DT'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{selectedInspiration.creatorName || 'Design Team'}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(selectedInspiration.createdAt).toLocaleDateString('en-US', { 
                          month: 'short', day: 'numeric', year: 'numeric' 
                        })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 border-b space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">{selectedInspiration.title}</h3>
                    {selectedInspiration.category && (
                      <Badge variant="secondary">{selectedInspiration.category}</Badge>
                    )}
                  </div>
                  {selectedInspiration.caption && (
                    <p className="text-sm text-muted-foreground">{selectedInspiration.caption}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="p-4 border-b flex items-center gap-4">
                  {!String(selectedInspiration.id).startsWith('demo-') && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="gap-2"
                      onClick={() => toggleInspirationReactionMutation.mutate(selectedInspiration.id)}
                      data-testid="button-like-inspiration-detail"
                    >
                      <Heart className={`w-4 h-4 ${inspirationReactions.some((r: any) => r.userName === (user?.name || 'You')) ? 'fill-red-500 text-red-500' : ''}`} />
                      {inspirationReactions.length > 0 && <span>{inspirationReactions.length}</span>}
                      Like
                    </Button>
                  )}
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="gap-2"
                    onClick={() => {
                      setPendingImageForChat({
                        src: selectedInspiration.imageUrl,
                        title: selectedInspiration.title,
                        category: selectedInspiration.category || 'Inspiration'
                      });
                      setInspirationDetailOpen(false);
                      setChatPickerOpen(true);
                    }}
                    data-testid="button-discuss-inspiration"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Discuss in Chat
                  </Button>
                </div>

                {/* Comments - only for real entries */}
                {!String(selectedInspiration.id).startsWith('demo-') ? (
                  <>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {inspirationComments.length > 0 ? (
                        inspirationComments.map((comment: any) => (
                          <div key={comment.id} className="flex gap-3">
                            <Avatar className="w-8 h-8">
                              <AvatarFallback className="text-xs">{comment.userAvatar || 'U'}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{comment.userName}</span>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(comment.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="text-sm">{comment.content}</p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">No comments yet</p>
                      )}
                    </div>

                    {/* Comment Input */}
                    <div className="p-4 border-t flex gap-2">
                      <Input
                        placeholder="Add a comment..."
                        value={newInspirationComment}
                        onChange={(e) => setNewInspirationComment(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newInspirationComment.trim()) {
                            addInspirationCommentMutation.mutate({ 
                              imageId: selectedInspiration.id, 
                              content: newInspirationComment.trim() 
                            });
                          }
                        }}
                        data-testid="input-inspiration-comment"
                      />
                      <Button 
                        size="sm"
                        disabled={!newInspirationComment.trim() || addInspirationCommentMutation.isPending}
                        onClick={() => {
                          if (newInspirationComment.trim()) {
                            addInspirationCommentMutation.mutate({ 
                              imageId: selectedInspiration.id, 
                              content: newInspirationComment.trim() 
                            });
                          }
                        }}
                        data-testid="button-post-inspiration-comment"
                      >
                        Post
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 p-4">
                    <p className="text-sm text-muted-foreground text-center py-4">
                      This is sample inspiration. Add your own to enable comments and likes.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Chat Picker Dialog */}
      <Dialog open={chatPickerOpen} onOpenChange={setChatPickerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Choose a Chat</DialogTitle>
            <DialogDescription>
              Select which chat to share this inspiration in
            </DialogDescription>
          </DialogHeader>
          
          {pendingImageForChat && (
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg mb-4">
              <img 
                src={pendingImageForChat.src} 
                alt={pendingImageForChat.title}
                className="w-16 h-16 object-cover rounded"
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{pendingImageForChat.title}</p>
                <p className="text-sm text-muted-foreground">{pendingImageForChat.category}</p>
              </div>
            </div>
          )}

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {projectChats.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No chats available for this project yet.
              </p>
            ) : (
              projectChats.map((chat: any) => {
                const chatName = chat.type === 'group' 
                  ? (chat.title || 'Team Chat')
                  : chat.participants?.find((p: any) => p.userId !== user?.id)?.user?.name || 'Chat';
                
                return (
                  <button
                    key={chat.id}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
                    onClick={() => {
                      setSelectedChatForMessage(chat.id);
                      setChatPickerOpen(false);
                      handleTabChange("messages");
                    }}
                    data-testid={`chat-picker-${chat.id}`}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className={chat.type === 'group' ? 'bg-primary/10' : ''}>
                        {chat.type === 'group' ? (
                          <Users className="w-4 h-4" />
                        ) : (
                          chatName.charAt(0).toUpperCase()
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{chatName}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {chat.type === 'group' ? `${chat.participants?.length || 0} members` : 'Direct message'}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setChatPickerOpen(false);
              setPendingImageForChat(null);
            }}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
