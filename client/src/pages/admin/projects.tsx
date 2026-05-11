import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { parseErrorMessage } from "@/lib/queryClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { SuperAdminLayout } from "@/components/super-admin-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "wouter";
import {
  FolderOpen,
  Search,
  Eye,
  UserPlus,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { Project } from "@shared/schema";

const PAGE_SIZE = 25;

export default function AdminProjects() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [projectsPage, setProjectsPage] = useState(1);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedContractorId, setSelectedContractorId] = useState<string>("");

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ["/api/admin/projects"],
    queryFn: () => api.getAdminProjects(),
    enabled: user?.role === "admin",
  });

  const { data: contractors = [] } = useQuery({
    queryKey: ["/api/admin/contractors"],
    queryFn: () => api.getContractors(),
    enabled: user?.role === "admin",
  });

  const assignMutation = useMutation({
    mutationFn: ({ projectId, contractorId }: { projectId: string; contractorId: string }) =>
      api.assignContractor(projectId, contractorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/projects"] });
      toast({ title: "Contractor Assigned" });
      setAssignDialogOpen(false);
      setSelectedContractorId("");
    },
    onError: (error: Error) =>
      toast({
        title: "Assignment Failed",
        description: parseErrorMessage(error),
        variant: "destructive",
      }),
  });

  const realProjects = projects.filter((p) => !p.isSandbox);
  const filteredProjects = realProjects.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.clientName?.toLowerCase() || "").includes(searchQuery.toLowerCase())
  );

  const projectsTotalPages = Math.max(1, Math.ceil(filteredProjects.length / PAGE_SIZE));
  const projectsStart = (projectsPage - 1) * PAGE_SIZE;
  const projectsEnd = Math.min(projectsStart + PAGE_SIZE, filteredProjects.length);
  const pagedProjects = filteredProjects.slice(projectsStart, projectsEnd);

  return (
    <SuperAdminLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-blue-600" />
            <h1 className="text-2xl font-bold text-foreground">Platform Projects</h1>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setProjectsPage(1);
              }}
              data-testid="input-search-projects"
            />
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            {projectsLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredProjects.length === 0 ? (
              <p className="text-muted-foreground text-center py-10">No projects found</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Contractor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedProjects.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell className="font-medium">{project.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {project.companyName || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {project.clientName || "—"}
                      </TableCell>
                      <TableCell>
                        {!project.contractorId ? (
                          <Badge
                            variant="outline"
                            className="border-amber-500 text-amber-600 text-xs"
                          >
                            Unassigned
                          </Badge>
                        ) : (
                          <span className="text-sm">
                            {project.contractorName || "Assigned"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={project.status === "completed" ? "secondary" : "default"}
                          className={`text-xs ${
                            project.status === "in_progress"
                              ? "bg-blue-500"
                              : project.status === "active"
                              ? "bg-green-500"
                              : project.status === "planning"
                              ? "bg-purple-500"
                              : ""
                          }`}
                        >
                          {project.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <Link href={`/admin/project/${project.id}`}>
                            <Button size="sm" variant="ghost">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedProject(project);
                              setAssignDialogOpen(true);
                            }}
                          >
                            <UserPlus className="w-4 h-4 mr-1" />
                            Assign
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {filteredProjects.length > PAGE_SIZE && (
              <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
                <span data-testid="projects-pagination-info">
                  Showing {projectsStart + 1}–{projectsEnd} of {filteredProjects.length}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setProjectsPage((p) => Math.max(1, p - 1))}
                    disabled={projectsPage === 1}
                    data-testid="button-projects-prev"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </Button>
                  <span className="px-3 text-xs font-medium">
                    Page {projectsPage} of {projectsTotalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setProjectsPage((p) => Math.min(projectsTotalPages, p + 1))
                    }
                    disabled={projectsPage === projectsTotalPages}
                    data-testid="button-projects-next"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={assignDialogOpen}
        onOpenChange={(open) => {
          setAssignDialogOpen(open);
          if (!open) setSelectedContractorId("");
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Assign Contractor</DialogTitle>
            <DialogDescription>
              Assign a contractor to{" "}
              <span className="font-medium">{selectedProject?.name}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Select value={selectedContractorId} onValueChange={setSelectedContractorId}>
              <SelectTrigger data-testid="select-assign-contractor">
                <SelectValue placeholder="Select a contractor" />
              </SelectTrigger>
              <SelectContent>
                {contractors.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name || c.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                selectedProject &&
                selectedContractorId &&
                assignMutation.mutate({
                  projectId: selectedProject.id,
                  contractorId: selectedContractorId,
                })
              }
              disabled={!selectedContractorId || assignMutation.isPending}
              data-testid="button-confirm-assign"
            >
              {assignMutation.isPending ? "Assigning…" : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SuperAdminLayout>
  );
}
