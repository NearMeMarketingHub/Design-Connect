import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Shield, 
  Users, 
  UserPlus,
  ArrowLeft,
  Loader2,
  Check,
  X,
  Clock,
  Building2,
  ArrowUpDown
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { User, ContractorRequest } from "@shared/schema";

type SortField = "name" | "companyName" | "companyType" | "username";
type SortOrder = "asc" | "desc";

export default function ContractorManagement() {
  const [_, setLocation] = useLocation();
  const { user, loading: authLoading, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("active");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) {
      setLocation("/admin-login");
    }
  }, [user, authLoading, setLocation]);

  const { data: contractors = [], isLoading: contractorsLoading } = useQuery({
    queryKey: ["/api/admin/contractors"],
    queryFn: () => api.getContractors(),
    enabled: user?.role === "admin",
  });

  const { data: pendingContractors = [], isLoading: pendingLoading } = useQuery({
    queryKey: ["/api/admin/contractors/pending"],
    queryFn: () => api.getPendingContractors(),
    enabled: user?.role === "admin",
  });

  const { data: contractorRequests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ["/api/contractor-requests/pending"],
    queryFn: () => api.getPendingContractorRequests(),
    enabled: user?.role === "admin",
  });

  const approveContractorMutation = useMutation({
    mutationFn: (contractorId: string) => api.approveContractor(contractorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contractors/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contractors"] });
      toast({
        title: "Contractor Approved",
        description: "The contractor can now log in to their account.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Approval Failed",
        description: error.message || "Could not approve contractor",
        variant: "destructive",
      });
    },
  });

  const rejectContractorMutation = useMutation({
    mutationFn: (contractorId: string) => api.rejectContractor(contractorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contractors/pending"] });
      toast({
        title: "Contractor Rejected",
        description: "The contractor account has been removed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Rejection Failed",
        description: error.message || "Could not reject contractor",
        variant: "destructive",
      });
    },
  });

  const approveRequestMutation = useMutation({
    mutationFn: (requestId: string) => api.approveContractorRequest(requestId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contractor-requests/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contractors"] });
      toast({
        title: "Request Approved",
        description: `Contractor account created. Temporary password: ${data.tempPassword}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Approval Failed",
        description: error.message || "Could not approve request",
        variant: "destructive",
      });
    },
  });

  const rejectRequestMutation = useMutation({
    mutationFn: (requestId: string) => api.rejectContractorRequest(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contractor-requests/pending"] });
      toast({
        title: "Request Rejected",
        description: "The access request has been rejected.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Rejection Failed",
        description: error.message || "Could not reject request",
        variant: "destructive",
      });
    },
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return null;
  }

  const activeContractors = contractors.filter((c: Omit<User, "password">) => c.isApproved && !c.isSandbox);
  const totalPending = pendingContractors.length + contractorRequests.length;

  const sortedContractors = useMemo(() => {
    return [...activeContractors].sort((a, b) => {
      let aVal = "";
      let bVal = "";
      
      switch (sortField) {
        case "name":
          aVal = (a.name || "").toLowerCase();
          bVal = (b.name || "").toLowerCase();
          break;
        case "companyName":
          aVal = (a.companyName || "").toLowerCase();
          bVal = (b.companyName || "").toLowerCase();
          break;
        case "companyType":
          aVal = (a.companyType || "").toLowerCase();
          bVal = (b.companyType || "").toLowerCase();
          break;
        case "username":
          aVal = a.username.toLowerCase();
          bVal = b.username.toLowerCase();
          break;
      }
      
      if (sortOrder === "asc") {
        return aVal.localeCompare(bVal);
      } else {
        return bVal.localeCompare(aVal);
      }
    });
  }, [activeContractors, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/super-admin">
                <Button variant="ghost" size="sm" data-testid="btn-back-to-admin">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Contractor Management</h1>
                  <p className="text-sm text-muted-foreground">Manage contractors and access requests</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {totalPending > 0 && (
                <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                  {totalPending} pending
                </Badge>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <Users className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Contractors</p>
                  <h3 className="text-2xl font-bold text-foreground">{activeContractors.length}</h3>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <UserPlus className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Access Requests</p>
                  <h3 className="text-2xl font-bold text-foreground">{contractorRequests.length}</h3>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-100 rounded-lg">
                  <Clock className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending Approval</p>
                  <h3 className="text-2xl font-bold text-foreground">{pendingContractors.length}</h3>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="active" data-testid="tab-active-contractors">
              Active Contractors
            </TabsTrigger>
            <TabsTrigger value="requests" data-testid="tab-access-requests">
              Requests
              {totalPending > 0 && (
                <Badge variant="secondary" className="ml-2 bg-orange-100 text-orange-700">
                  {totalPending}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Active Contractors</CardTitle>
                    <CardDescription>All approved contractors in the system</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Sort by:</span>
                    <Select value={sortField} onValueChange={(value) => setSortField(value as SortField)}>
                      <SelectTrigger className="w-[150px]" data-testid="select-sort-field">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name">Name</SelectItem>
                        <SelectItem value="companyName">Company</SelectItem>
                        <SelectItem value="companyType">Type</SelectItem>
                        <SelectItem value="username">Username</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                      data-testid="btn-toggle-sort-order"
                    >
                      <ArrowUpDown className="w-4 h-4 mr-1" />
                      {sortOrder === "asc" ? "A-Z" : "Z-A"}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {contractorsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : activeContractors.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No active contractors</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort("name")}
                        >
                          <div className="flex items-center gap-1">
                            Name
                            {sortField === "name" && <ArrowUpDown className="w-3 h-3" />}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort("companyName")}
                        >
                          <div className="flex items-center gap-1">
                            Company
                            {sortField === "companyName" && <ArrowUpDown className="w-3 h-3" />}
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort("companyType")}
                        >
                          <div className="flex items-center gap-1">
                            Type
                            {sortField === "companyType" && <ArrowUpDown className="w-3 h-3" />}
                          </div>
                        </TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedContractors.map((contractor: Omit<User, "password">) => (
                        <TableRow key={contractor.id} data-testid={`row-contractor-${contractor.id}`}>
                          <TableCell className="font-medium">{contractor.name || "No name"}</TableCell>
                          <TableCell>{contractor.companyName || "-"}</TableCell>
                          <TableCell>
                            {contractor.companyType ? (
                              <Badge variant="outline">{contractor.companyType}</Badge>
                            ) : "-"}
                          </TableCell>
                          <TableCell>{contractor.email || "-"}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="bg-green-100 text-green-700">
                              Active
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="requests">
            <div className="space-y-6">
              {contractorRequests.length > 0 && (
                <Card className="border-blue-300">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <UserPlus className="w-5 h-5 text-blue-600" />
                      Access Requests
                    </CardTitle>
                    <CardDescription>New contractors requesting access to the platform</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Username</TableHead>
                          <TableHead>Company</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {contractorRequests.map((request: ContractorRequest) => (
                          <TableRow key={request.id} data-testid={`row-contractor-request-${request.id}`}>
                            <TableCell className="font-medium">{request.firstName} {request.lastName}</TableCell>
                            <TableCell>{request.username}</TableCell>
                            <TableCell>{request.companyName}</TableCell>
                            <TableCell>{request.companyType}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  className="border-green-500 text-green-600 hover:bg-green-50"
                                  onClick={() => approveRequestMutation.mutate(request.id)}
                                  disabled={approveRequestMutation.isPending}
                                  data-testid={`btn-approve-request-${request.id}`}
                                >
                                  <Check className="w-4 h-4 mr-1" />
                                  Approve
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  className="border-red-500 text-red-600 hover:bg-red-50"
                                  onClick={() => rejectRequestMutation.mutate(request.id)}
                                  disabled={rejectRequestMutation.isPending}
                                  data-testid={`btn-reject-request-${request.id}`}
                                >
                                  <X className="w-4 h-4 mr-1" />
                                  Reject
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {pendingContractors.length > 0 && (
                <Card className="border-orange-300">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-orange-600" />
                      Pending Approvals
                    </CardTitle>
                    <CardDescription>Contractors awaiting approval (registered accounts)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Username</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingContractors.map((contractor: Omit<User, "password">) => (
                          <TableRow key={contractor.id} data-testid={`row-pending-contractor-${contractor.id}`}>
                            <TableCell className="font-medium">{contractor.name || "No name"}</TableCell>
                            <TableCell>{contractor.username}</TableCell>
                            <TableCell>{contractor.email}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  className="border-green-500 text-green-600 hover:bg-green-50"
                                  onClick={() => approveContractorMutation.mutate(contractor.id)}
                                  disabled={approveContractorMutation.isPending}
                                  data-testid={`btn-approve-contractor-${contractor.id}`}
                                >
                                  <Check className="w-4 h-4 mr-1" />
                                  Approve
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  className="border-red-500 text-red-600 hover:bg-red-50"
                                  onClick={() => rejectContractorMutation.mutate(contractor.id)}
                                  disabled={rejectContractorMutation.isPending}
                                  data-testid={`btn-reject-contractor-${contractor.id}`}
                                >
                                  <X className="w-4 h-4 mr-1" />
                                  Reject
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {contractorRequests.length === 0 && pendingContractors.length === 0 && (
                <Card>
                  <CardContent className="py-12 text-center">
                    <UserPlus className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Pending Requests</h3>
                    <p className="text-muted-foreground">All contractor requests have been processed.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
