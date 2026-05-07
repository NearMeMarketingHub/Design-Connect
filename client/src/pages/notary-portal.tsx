import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { useLocation } from "wouter";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/hooks/use-toast";

interface NotaryDocument {
  id: string;
  name: string;
  fileUrl: string;
  notarizationStatus: string;
  notarizationDueDate: string | null;
  notarizedFileUrl: string | null;
  notarizationRejectionReason: string | null;
  projectId: string;
  projectName: string;
  projectAddress: string;
  clientName: string;
  contractorName: string;
  createdAt: string;
}

export default function NotaryPortal() {
  const { user, loading, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [documents, setDocuments] = useState<NotaryDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  const fetchDocuments = useCallback(async (search: string) => {
    if (!user) return;
    
    setDocsLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const res = await fetch(`/api/notary/projects?${params.toString()}`, {
        credentials: 'include'
      });
      
      if (!res.ok) {
        throw new Error('Failed to fetch documents');
      }
      
      const data = await res.json();
      setDocuments(data);
    } catch (err) {
      console.error('Error fetching documents:', err);
      setError('Failed to load documents');
    } finally {
      setDocsLoading(false);
    }
  }, [user]);

  const handleUploadClick = (docId: string) => {
    setSelectedDocId(docId);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedDocId) return;

    setUploadingDocId(selectedDocId);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await fetch('/api/uploads/file', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!uploadRes.ok) {
        throw new Error('Failed to upload file');
      }

      const { objectPath } = await uploadRes.json();

      const updateRes = await fetch(`/api/notary/documents/${selectedDocId}/upload-notarized`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notarizedFileUrl: objectPath }),
        credentials: 'include',
      });

      if (!updateRes.ok) {
        throw new Error('Failed to update document');
      }

      toast({
        title: "Success",
        description: "Notarized document uploaded successfully",
      });

      fetchDocuments(searchQuery);
    } catch (err) {
      console.error('Upload error:', err);
      toast({
        title: "Error",
        description: "Failed to upload notarized document",
        variant: "destructive",
      });
    } finally {
      setUploadingDocId(null);
      setSelectedDocId(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Fetch documents when user is available (with small delay to let page render)
  useEffect(() => {
    if (user && !loading) {
      const timer = setTimeout(() => {
        fetchDocuments(searchQuery);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [user, loading]);

  // Debounced search
  useEffect(() => {
    if (!user || loading) return;
    
    const timer = setTimeout(() => {
      fetchDocuments(searchQuery);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      setLocation('/auth?tab=contractor');
    }
  }, [user, loading, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Redirecting...</p>
      </div>
    );
  }

  const handleLogout = async () => {
    try {
      await logout();
      setLocation('/');
    } catch (e) {
      console.error('Logout error:', e);
    }
  };

  // Check if user has notary role (contractorType='notary' in new architecture, or legacy role='notary')
  const isNotary = user.role === 'notary' || (user.role === 'contractor' && user.contractorType === 'notary');
  if (!isNotary && user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center p-8 bg-card rounded-lg shadow max-w-md">
          <h2 className="text-xl font-bold text-red-600 mb-4">Access Denied</h2>
          <p className="text-muted-foreground mb-4">
            The Notary Portal is only accessible to notary accounts.
          </p>
          <p className="text-muted-foreground mb-6">
            Please log out and sign in with a notary account to access this portal.
          </p>
          <button 
            onClick={handleLogout}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Log Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">BuildVision Notary Portal</h1>
            <p className="text-sm text-muted-foreground">Document notarization management</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">Welcome, {user.name || user.username}</span>
            <ThemeToggle />
            <button 
              onClick={handleLogout}
              className="px-4 py-2 border border-border rounded hover:bg-muted text-foreground"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-8">
        <div className="bg-card rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Documents Requiring Notarization</h2>
          
          <div className="mb-6">
            <input
              type="text"
              placeholder="Search by project name, address, or document name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-border rounded bg-background text-foreground placeholder:text-muted-foreground"
              data-testid="input-search-documents"
            />
          </div>

          {error ? (
            <div className="text-center py-12 text-red-500">
              <p>{error}</p>
              <button 
                onClick={() => fetchDocuments(searchQuery)}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Retry
              </button>
            </div>
          ) : docsLoading ? (
            <div className="text-center py-12">
              <p>Loading documents...</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No documents found matching your criteria</p>
            </div>
          ) : (
            <div className="border border-border rounded overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3 font-medium text-foreground">Document</th>
                    <th className="text-left p-3 font-medium text-foreground">Project</th>
                    <th className="text-left p-3 font-medium text-foreground">Client</th>
                    <th className="text-left p-3 font-medium text-foreground">Status</th>
                    <th className="text-left p-3 font-medium text-foreground">Due Date</th>
                    <th className="text-right p-3 font-medium text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr key={doc.id} className="border-t border-border hover:bg-muted/50">
                      <td className="p-3 font-medium text-foreground">{doc.name}</td>
                      <td className="p-3">
                        <div>
                          <p className="font-medium text-foreground">{doc.projectName}</p>
                          <p className="text-xs text-muted-foreground">{doc.projectAddress}</p>
                        </div>
                      </td>
                      <td className="p-3 text-foreground">{doc.clientName}</td>
                      <td className="p-3">
                        <div>
                          <span className={`px-2 py-1 text-xs rounded ${
                            doc.notarizationStatus === 'completed' 
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                              : doc.notarizationStatus === 'awaiting_approval'
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400'
                              : doc.notarizationRejectionReason
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'
                              : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400'
                          }`}>
                            {doc.notarizationRejectionReason ? 'Rejected' : (doc.notarizationStatus || 'Pending')}
                          </span>
                          {doc.notarizationRejectionReason && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1 max-w-xs">{doc.notarizationRejectionReason}</p>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-muted-foreground">{doc.notarizationDueDate || 'No due date'}</td>
                      <td className="p-3 text-right space-x-2">
                        <a 
                          href={doc.fileUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:underline text-sm"
                        >
                          View
                        </a>
                        {doc.notarizedFileUrl ? (
                          <a 
                            href={doc.notarizedFileUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-green-600 dark:text-green-400 hover:underline text-sm"
                          >
                            View Notarized
                          </a>
                        ) : (
                          <button
                            onClick={() => handleUploadClick(doc.id)}
                            disabled={uploadingDocId === doc.id}
                            className="px-3 py-1 bg-primary text-primary-foreground text-sm rounded hover:bg-primary/90 disabled:opacity-50"
                          >
                            {uploadingDocId === doc.id ? 'Uploading...' : 'Upload Notarized'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".pdf,.doc,.docx"
            className="hidden"
          />
        </div>
      </main>
    </div>
  );
}
