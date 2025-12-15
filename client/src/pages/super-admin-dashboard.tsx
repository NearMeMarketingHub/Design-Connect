import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  TableRow 
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
  Shield, 
  Users, 
  FolderOpen, 
  Eye,
  UserPlus,
  Building2,
  Search,
  LogOut,
  HardHat
} from "lucide-react";
import { Link } from "wouter";

const DEMO_PROJECTS = [
  { id: "jenkins", name: "Jenkins Residence", client: "Sarah Jenkins", contractor: "Mike Builder", status: "In Progress", type: "Renovation" },
  { id: "miller", name: "Miller Kitchen", client: "John Miller", contractor: "Unassigned", status: "Planning", type: "Remodel" },
  { id: "westlake", name: "West Lake Build", client: "Lake Properties LLC", contractor: "Tom Construction", status: "Active", type: "New Construction" },
  { id: "downtown", name: "Downtown Loft", client: "Urban Developers", contractor: "Jane Builders", status: "Completed", type: "Commercial" },
];

const DEMO_CONTRACTORS = [
  { id: 1, name: "Mike Builder", company: "Builder Bros", projects: 3, status: "Active" },
  { id: 2, name: "Tom Construction", company: "TC Homes", projects: 2, status: "Active" },
  { id: 3, name: "Jane Builders", company: "JB Construction", projects: 1, status: "Active" },
  { id: 4, name: "Sam Renovate", company: "SR Renovations", projects: 0, status: "Available" },
];

export default function SuperAdminDashboard() {
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<typeof DEMO_PROJECTS[0] | null>(null);
  const [selectedContractor, setSelectedContractor] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  const handleAssignContractor = (project: typeof DEMO_PROJECTS[0]) => {
    setSelectedProject(project);
    setAssignDialogOpen(true);
  };

  const filteredProjects = DEMO_PROJECTS.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.client.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="h-16 border-b border-slate-700 bg-slate-800 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-heading font-bold text-xl text-white tracking-tight">BuildVision Admin</h1>
            <p className="text-xs text-slate-400">System Administration</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="border-green-500 text-green-400">
            Admin Mode
          </Badge>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-slate-400 hover:text-white"
            onClick={() => window.location.href = '/'}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="p-6 max-w-7xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Dashboard Overview</h2>
          <p className="text-slate-400 mt-1">Manage projects, contractors, and system settings</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/20 rounded-lg">
                  <FolderOpen className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">Total Projects</p>
                  <h3 className="text-2xl font-bold text-white">12</h3>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-500/20 rounded-lg">
                  <HardHat className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">Active Contractors</p>
                  <h3 className="text-2xl font-bold text-white">8</h3>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-500/20 rounded-lg">
                  <Users className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">Total Clients</p>
                  <h3 className="text-2xl font-bold text-white">24</h3>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-500/20 rounded-lg">
                  <Building2 className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">In Progress</p>
                  <h3 className="text-2xl font-bold text-white">7</h3>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="bg-slate-800 border-slate-700 lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white">All Projects</CardTitle>
                  <CardDescription className="text-slate-400">Manage and assign contractors to projects</CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input 
                    placeholder="Search projects..." 
                    className="pl-9 bg-slate-900 border-slate-600 text-white placeholder:text-slate-500"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700 hover:bg-transparent">
                    <TableHead className="text-slate-400">Project</TableHead>
                    <TableHead className="text-slate-400">Client</TableHead>
                    <TableHead className="text-slate-400">Contractor</TableHead>
                    <TableHead className="text-slate-400">Status</TableHead>
                    <TableHead className="text-slate-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProjects.map((project) => (
                    <TableRow key={project.id} className="border-slate-700 hover:bg-slate-700/50">
                      <TableCell className="font-medium text-white">{project.name}</TableCell>
                      <TableCell className="text-slate-300">{project.client}</TableCell>
                      <TableCell>
                        {project.contractor === "Unassigned" ? (
                          <Badge variant="outline" className="border-amber-500 text-amber-400">Unassigned</Badge>
                        ) : (
                          <span className="text-slate-300">{project.contractor}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={project.status === "Completed" ? "secondary" : "default"}
                          className={
                            project.status === "In Progress" ? "bg-blue-500" :
                            project.status === "Active" ? "bg-green-500" :
                            project.status === "Planning" ? "bg-purple-500" :
                            ""
                          }
                        >
                          {project.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Link href={`/project/${project.id}`}>
                            <Button size="sm" variant="ghost" className="text-slate-400 hover:text-white">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="border-slate-600 text-slate-300 hover:text-white hover:bg-slate-700"
                            onClick={() => handleAssignContractor(project)}
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
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Quick Actions</CardTitle>
              <CardDescription className="text-slate-400">Test different app views</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/dashboard">
                <Button className="w-full justify-start" variant="outline">
                  <Eye className="w-4 h-4 mr-2" />
                  View as Client
                </Button>
              </Link>
              <Link href="/admin-dashboard">
                <Button className="w-full justify-start" variant="outline">
                  <HardHat className="w-4 h-4 mr-2" />
                  View as Contractor
                </Button>
              </Link>
              <div className="pt-4 border-t border-slate-700">
                <h4 className="text-sm font-medium text-white mb-3">Available Contractors</h4>
                <div className="space-y-2">
                  {DEMO_CONTRACTORS.map((contractor) => (
                    <div 
                      key={contractor.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-900/50"
                    >
                      <div>
                        <p className="text-sm font-medium text-white">{contractor.name}</p>
                        <p className="text-xs text-slate-400">{contractor.company}</p>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={contractor.status === "Available" ? "border-green-500 text-green-400" : "border-slate-500 text-slate-400"}
                      >
                        {contractor.projects} projects
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Assign Contractor</DialogTitle>
            <DialogDescription className="text-slate-400">
              Select a contractor to assign to {selectedProject?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedContractor} onValueChange={setSelectedContractor}>
              <SelectTrigger className="bg-slate-900 border-slate-600 text-white">
                <SelectValue placeholder="Select a contractor" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {DEMO_CONTRACTORS.map((contractor) => (
                  <SelectItem 
                    key={contractor.id} 
                    value={contractor.name}
                    className="text-white focus:bg-slate-700"
                  >
                    {contractor.name} - {contractor.company}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAssignDialogOpen(false)} className="text-slate-400">
              Cancel
            </Button>
            <Button 
              onClick={() => {
                setAssignDialogOpen(false);
                setSelectedContractor("");
              }}
              disabled={!selectedContractor}
            >
              Assign Contractor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
