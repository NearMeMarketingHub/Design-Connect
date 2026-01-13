import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Search, 
  FileText, 
  Building2,
  ExternalLink,
} from "lucide-react";

interface NotaryDocument {
  id: string;
  name: string;
  fileUrl: string;
  notarizationStatus: string;
  notarizationDueDate: string | null;
  notarizedFileUrl: string | null;
  projectId: string;
  projectName: string;
  projectAddress: string;
  clientName: string;
  contractorName: string;
  createdAt: string;
}

export default function NotaryPortal() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  const [searchQuery, setSearchQuery] = useState("");

  const { data: documents = [], isLoading: docsLoading } = useQuery<NotaryDocument[]>({
    queryKey: ['/api/notary/projects', searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      const res = await fetch(`/api/notary/projects?${params.toString()}`, {
        credentials: 'include'
      });
      if (!res.ok) {
        throw new Error('Failed to fetch documents');
      }
      return res.json();
    },
    enabled: !!user,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-300 bg-yellow-50">Pending</Badge>;
      case 'awaiting_approval':
        return <Badge variant="outline" className="text-blue-600 border-blue-300 bg-blue-50">Awaiting Approval</Badge>;
      case 'completed':
        return <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">Completed</Badge>;
      default:
        return <Badge variant="outline">{status || 'Unknown'}</Badge>;
    }
  };

  useEffect(() => {
    if (!loading && !user) {
      setLocation('/auth?tab=notary');
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST', credentials: 'include' });
      setLocation('/');
    } catch (e) {
      console.error('Logout error:', e);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Building2 className="w-8 h-8 text-primary" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">BuildVision Notary Portal</h1>
                <p className="text-sm text-muted-foreground">Document notarization management</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">Welcome, {user.name || user.username}</span>
              <Button variant="outline" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Documents Requiring Notarization
            </CardTitle>
            <CardDescription>
              Search for documents that need notarization and upload the notarized versions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by project name, address, or document name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-documents"
                />
              </div>
            </div>

            {docsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No documents found matching your criteria</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Document</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documents.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">{doc.name}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{doc.projectName}</p>
                            <p className="text-xs text-muted-foreground">{doc.projectAddress}</p>
                          </div>
                        </TableCell>
                        <TableCell>{doc.clientName}</TableCell>
                        <TableCell>{getStatusBadge(doc.notarizationStatus)}</TableCell>
                        <TableCell>{doc.notarizationDueDate || 'No due date'}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" asChild>
                            <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-4 h-4 mr-2" />
                              View
                            </a>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
