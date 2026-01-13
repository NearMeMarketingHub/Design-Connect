import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
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

  // Only fetch when user is authenticated
  const { data: documents, isLoading: docsLoading, error } = useQuery<NotaryDocument[]>({
    queryKey: ['/api/notary/projects', searchQuery],
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        if (searchQuery) params.set('search', searchQuery);
        const res = await fetch(`/api/notary/projects?${params.toString()}`, {
          credentials: 'include'
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to fetch documents');
        }
        return res.json();
      } catch (err) {
        console.error('Error fetching documents:', err);
        throw err;
      }
    },
    enabled: !!user && !loading,
    retry: false,
  });

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

  const docList = documents || [];

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
              <p>Error loading documents. Please try again.</p>
            </div>
          ) : docsLoading ? (
            <div className="text-center py-12">
              <p>Loading documents...</p>
            </div>
          ) : docList.length === 0 ? (
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
                  {docList.map((doc) => (
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
