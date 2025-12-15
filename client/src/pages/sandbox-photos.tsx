import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  TestTube,
  Shield,
  ArrowLeft,
  Image,
  Heart,
  MessageCircle,
  Calendar
} from "lucide-react";
import { Link, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { ProgressPost } from "@shared/schema";

export default function SandboxPhotos() {
  const [, params] = useRoute("/sandbox/project/:id/photos");
  const projectId = params?.id;
  const { user, loading: authLoading } = useAuth();

  const { data: sandboxData, isLoading: sandboxLoading } = useQuery({
    queryKey: ["/api/sandbox/data"],
    queryFn: () => api.getSandboxData(),
    enabled: user?.role === "admin",
  });

  const { data: posts = [], isLoading: postsLoading } = useQuery({
    queryKey: ["/api/projects", projectId, "posts"],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/posts`, {
        credentials: "include",
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!projectId,
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
          <Link href="/super-admin">
            <Button>Return to Admin</Button>
          </Link>
        </div>
      </div>
    );
  }

  const project = sandboxData.project;

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
          <Link href="/super-admin">
            <Button variant="outline" size="sm" className="gap-2" data-testid="button-exit-sandbox">
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">Exit to Admin</span>
            </Button>
          </Link>
        </div>
      </header>

      <main className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
        <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg p-3 flex items-start gap-3">
          <TestTube className="w-4 h-4 text-purple-600 mt-0.5" />
          <p className="text-xs text-purple-600 dark:text-purple-400">
            Sandbox progress photos for "{project.name}". This shows how the Instagram-style photo feed works.
          </p>
        </div>

        <div>
          <h1 className="text-2xl font-bold">Progress Photos</h1>
          <p className="text-muted-foreground">View construction updates and progress</p>
        </div>

        {postsLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : posts.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-12 text-center">
              <Image className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Progress Photos Yet</h3>
              <p className="text-muted-foreground mb-6">
                Progress photos will appear here as the contractor posts updates about the project.
              </p>
              <p className="text-sm text-muted-foreground">
                In the sandbox, you can test the photo posting feature from the contractor view (coming soon).
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {posts.map((post: ProgressPost) => (
              <Card key={post.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{post.title}</CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(post.createdAt).toLocaleDateString()}
                        <span>•</span>
                        <span>Posted by {post.creatorName}</span>
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="aspect-video bg-muted rounded-lg overflow-hidden mb-4">
                    <img 
                      src={post.coverImage} 
                      alt={post.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {post.caption && (
                    <p className="text-sm text-muted-foreground mb-4">{post.caption}</p>
                  )}
                  <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" className="gap-2">
                      <Heart className="w-4 h-4" />
                      Like
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-2">
                      <MessageCircle className="w-4 h-4" />
                      Comment
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
