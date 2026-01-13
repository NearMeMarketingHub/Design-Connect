import { useAuth } from "@/lib/auth-context";
import { useLocation } from "wouter";
import { useEffect } from "react";

export default function NotaryPortal() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

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
        <p>Redirecting to login...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-2xl font-bold">BuildVision Notary Portal</h1>
      <p className="mt-4">Welcome, {user.name || user.username}!</p>
      <p className="mt-2 text-gray-600">This is a minimal test page.</p>
      <button 
        onClick={() => {
          fetch('/api/logout', { method: 'POST', credentials: 'include' })
            .then(() => setLocation('/'));
        }}
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
      >
        Logout
      </button>
    </div>
  );
}
