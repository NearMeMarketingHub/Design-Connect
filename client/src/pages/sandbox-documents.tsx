import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  TestTube,
  Shield,
  ArrowLeft,
  FileText,
  FolderOpen,
  Download
} from "lucide-react";
import { Link, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function SandboxDocuments() {
  const [, params] = useRoute("/sandbox/project/:id/documents");
  const projectId = params?.id;
  const { user, loading: authLoading } = useAuth();

  const { data: sandboxData, isLoading: sandboxLoading } = useQuery({
    queryKey: ["/api/sandbox/data"],
    queryFn: () => api.getSandboxData(),
    enabled: user?.role === "admin",
  });

  if (authLoading || sandboxLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!sandboxData?.project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Sandbox not initialized</p>
          <Link href="/admin/dashboard">
            <Button>Return to Admin</Button>
          </Link>
        </div>
      </div>
    );
  }

  const project = sandboxData.project;

  const sampleDocuments = [
    { id: "1", name: "Project Contract.pdf", category: "Contracts", size: "2.4 MB", date: "Jan 15, 2025" },
    { id: "2", name: "Floor Plans v2.pdf", category: "Plans", size: "5.1 MB", date: "Jan 20, 2025" },
    { id: "3", name: "Material Specifications.pdf", category: "Specifications", size: "1.8 MB", date: "Jan 22, 2025" },
    { id: "4", name: "Permit Application.pdf", category: "Permits", size: "890 KB", date: "Feb 1, 2025" },
  ];

  const categories = ["All", "Contracts", "Plans", "Specifications", "Permits"];

  return (
    <div className="min-h-screen bg-background">
      <header className="h-16 border-b bg-card px-4 md:px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Link href={`/sandbox/project/${projectId}`}>
            <Button variant="ghost" size="sm" className="gap-2" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back to Project</span>
            </Button>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-purple-600 text-purple-600">
            <TestTube className="w-3 h-3 mr-1" />
            Test Mode
          </Badge>
          <Link href="/admin/dashboard">
            <Button variant="outline" size="sm" className="gap-2" data-testid="button-exit-sandbox">
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">Exit to Admin</span>
            </Button>
          </Link>
        </div>
      </header>

      <main className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg p-3 flex items-start gap-3">
          <TestTube className="w-4 h-4 text-purple-600 mt-0.5" />
          <p className="text-xs text-purple-600 dark:text-purple-400">
            Sandbox documents for "{project.name}". These are sample files for testing the document viewer.
          </p>
        </div>

        <div>
          <h1 className="text-2xl font-bold">Documents</h1>
          <p className="text-muted-foreground">View and download project files</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {categories.map((cat) => (
            <Button 
              key={cat} 
              variant={cat === "All" ? "default" : "outline"} 
              size="sm"
            >
              {cat}
            </Button>
          ))}
        </div>

        <div className="grid gap-4">
          {sampleDocuments.map((doc) => (
            <Card key={doc.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-muted rounded-lg">
                    <FileText className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">{doc.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {doc.category} • {doc.size} • {doc.date}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" disabled>
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              This is a sandbox demo. Document upload and management features would appear here.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
