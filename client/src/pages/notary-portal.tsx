import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
import { 
  Search, 
  FileText, 
  Upload, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  ArrowUpDown,
  Filter,
  Building2,
  User,
  X,
  ExternalLink
} from "lucide-react";
import { format } from "date-fns";

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
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("dueDate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<NotaryDocument | null>(null);
  const [notarizedFile, setNotarizedFile] = useState<{ name: string; objectPath: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: documents = [], isLoading } = useQuery<NotaryDocument[]>({
    queryKey: ['/api/notary/projects', searchQuery, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await fetch(`/api/notary/projects?${params.toString()}`, {
        credentials: 'include'
      });
      if (!res.ok) {
        throw new Error('Failed to fetch documents');
      }
      return res.json();
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (data: { documentId: string; notarizedFileUrl: string }) => {
      const res = await fetch(`/api/notary/documents/${data.documentId}/upload-notarized`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ notarizedFileUrl: data.notarizedFileUrl })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to upload document');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notary/projects'] });
      setUploadDialogOpen(false);
      setSelectedDocument(null);
      setNotarizedFile(null);
    },
    onError: (error: Error) => {
      alert(error.message || 'Failed to upload notarized document');
    }
  });

  const handleFileUpload = async (files: FileList) => {
    const file = files[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);

      setUploadProgress(10);

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

      setNotarizedFile({
        name: file.name,
        objectPath: response.objectPath
      });
    } catch (error) {
      console.error('Upload error:', error);
      alert(error instanceof Error ? error.message : 'Failed to upload file');
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
    }
  };

  const sortedDocuments = [...documents].sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case 'dueDate':
        const aDate = a.notarizationDueDate ? new Date(a.notarizationDueDate).getTime() : Infinity;
        const bDate = b.notarizationDueDate ? new Date(b.notarizationDueDate).getTime() : Infinity;
        comparison = aDate - bDate;
        break;
      case 'projectName':
        comparison = a.projectName.localeCompare(b.projectName);
        break;
      case 'documentName':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'status':
        comparison = a.notarizationStatus.localeCompare(b.notarizationStatus);
        break;
      default:
        comparison = 0;
    }
    return sortOrder === 'asc' ? comparison : -comparison;
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
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  useEffect(() => {
    if (!user) {
      setLocation('/auth?tab=notary');
    }
  }, [user, setLocation]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

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
              <Button variant="outline" onClick={() => {
                fetch('/api/logout', { method: 'POST', credentials: 'include' })
                  .then(() => setLocation('/'));
              }}>
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
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[160px]">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="awaiting_approval">Awaiting Approval</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[160px]">
                    <ArrowUpDown className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dueDate">Due Date</SelectItem>
                    <SelectItem value="projectName">Project Name</SelectItem>
                    <SelectItem value="documentName">Document Name</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  data-testid="button-toggle-sort"
                >
                  <ArrowUpDown className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
              </div>
            ) : sortedDocuments.length === 0 ? (
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
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedDocuments.map((doc) => (
                      <TableRow key={doc.id} data-testid={`row-document-${doc.id}`}>
                        <TableCell>
                          <div className="font-medium">{doc.name}</div>
                          <a 
                            href={doc.fileUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                          >
                            View original <ExternalLink className="w-3 h-3" />
                          </a>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{doc.projectName}</div>
                          <div className="text-xs text-muted-foreground">{doc.projectAddress}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3 text-muted-foreground" />
                            <span className="text-sm">{doc.clientName}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {doc.notarizationDueDate ? (
                            <div className={`flex items-center gap-1 ${isOverdue(doc.notarizationDueDate) && doc.notarizationStatus === 'pending' ? 'text-red-600' : ''}`}>
                              {isOverdue(doc.notarizationDueDate) && doc.notarizationStatus === 'pending' && (
                                <AlertTriangle className="w-4 h-4" />
                              )}
                              <Clock className="w-4 h-4" />
                              <span className="text-sm">{format(new Date(doc.notarizationDueDate), 'MMM d, yyyy')}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">No due date</span>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(doc.notarizationStatus)}</TableCell>
                        <TableCell className="text-right">
                          {doc.notarizationStatus === 'pending' ? (
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedDocument(doc);
                                setUploadDialogOpen(true);
                              }}
                              data-testid={`button-upload-${doc.id}`}
                            >
                              <Upload className="w-4 h-4 mr-1" />
                              Upload
                            </Button>
                          ) : doc.notarizedFileUrl ? (
                            <a 
                              href={doc.notarizedFileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-600 hover:underline"
                            >
                              View Notarized
                            </a>
                          ) : null}
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

      <Dialog open={uploadDialogOpen} onOpenChange={(open) => {
        setUploadDialogOpen(open);
        if (!open) {
          setSelectedDocument(null);
          setNotarizedFile(null);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Notarized Document</DialogTitle>
            <DialogDescription>
              {selectedDocument && (
                <>
                  Upload the notarized version of "{selectedDocument.name}" for project "{selectedDocument.projectName}".
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => {
                if (e.target.files) {
                  handleFileUpload(e.target.files);
                }
              }}
            />
            {isUploading ? (
              <div className="p-3 rounded-lg border bg-muted/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Uploading...</span>
                  <span className="text-sm font-semibold text-primary">{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
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
                onClick={() => fileInputRef.current?.click()}
                data-testid="button-select-file"
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
                setUploadDialogOpen(false);
                setNotarizedFile(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedDocument && notarizedFile) {
                  uploadMutation.mutate({
                    documentId: selectedDocument.id,
                    notarizedFileUrl: notarizedFile.objectPath
                  });
                }
              }}
              disabled={!notarizedFile || uploadMutation.isPending}
              data-testid="button-submit-notarized"
            >
              {uploadMutation.isPending ? 'Submitting...' : 'Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
