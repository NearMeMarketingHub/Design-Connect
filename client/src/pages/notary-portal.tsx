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

  useEffect(() => {
    if (!loading && !user) {
      setLocation('/auth?tab=notary');
    }
  }, [user, loading]);

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
      await fetch('/api/logout', { method: 'POST', credentials: 'include' });
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
            />
          </div>

          {docsLoading ? (
            <div className="text-center py-12">
              <p>Loading documents...</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No documents found matching your criteria</p>
            </div>
          ) : (
            <div className="border rounded">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3">Document</th>
                    <th className="text-left p-3">Project</th>
                    <th className="text-left p-3">Client</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Due Date</th>
                    <th className="text-right p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr key={doc.id} className="border-t">
                      <td className="p-3 font-medium">{doc.name}</td>
                      <td className="p-3">
                        <div>
                          <p className="font-medium">{doc.projectName}</p>
                          <p className="text-xs text-gray-500">{doc.projectAddress}</p>
                        </div>
                      </td>
                      <td className="p-3">{doc.clientName}</td>
                      <td className="p-3">
                        <span className="px-2 py-1 text-sm rounded bg-yellow-100 text-yellow-800">
                          {doc.notarizationStatus || 'Unknown'}
                        </span>
                      </td>
                      <td className="p-3">{doc.notarizationDueDate || 'No due date'}</td>
                      <td className="p-3 text-right">
                        <a 
                          href={doc.fileUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          View
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
