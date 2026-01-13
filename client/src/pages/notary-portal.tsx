import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useLocation } from "wouter";

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
  const { user, loading, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [documents, setDocuments] = useState<NotaryDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Fetch documents when user is available
  useEffect(() => {
    if (user && !loading) {
      fetchDocuments(searchQuery);
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
      setLocation('/auth?tab=notary');
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">BuildVision Notary Portal</h1>
            <p className="text-sm text-gray-500">Document notarization management</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">Welcome, {user.name || user.username}</span>
            <button 
              onClick={handleLogout}
              className="px-4 py-2 border rounded hover:bg-gray-100"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Documents Requiring Notarization</h2>
          
          <div className="mb-6">
            <input
              type="text"
              placeholder="Search by project name, address, or document name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border rounded"
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
            <div className="text-center py-12 text-gray-500">
              <p>No documents found matching your criteria</p>
            </div>
          ) : (
            <div className="border rounded overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3 font-medium">Document</th>
                    <th className="text-left p-3 font-medium">Project</th>
                    <th className="text-left p-3 font-medium">Client</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Due Date</th>
                    <th className="text-right p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr key={doc.id} className="border-t hover:bg-gray-50">
                      <td className="p-3 font-medium">{doc.name}</td>
                      <td className="p-3">
                        <div>
                          <p className="font-medium">{doc.projectName}</p>
                          <p className="text-xs text-gray-500">{doc.projectAddress}</p>
                        </div>
                      </td>
                      <td className="p-3">{doc.clientName}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 text-xs rounded ${
                          doc.notarizationStatus === 'completed' 
                            ? 'bg-green-100 text-green-800'
                            : doc.notarizationStatus === 'awaiting_approval'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {doc.notarizationStatus || 'Pending'}
                        </span>
                      </td>
                      <td className="p-3 text-gray-600">{doc.notarizationDueDate || 'No due date'}</td>
                      <td className="p-3 text-right">
                        <a 
                          href={doc.fileUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-sm"
                        >
                          View Document
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
