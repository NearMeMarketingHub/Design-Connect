import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  TestTube,
  Shield,
  ArrowLeft,
  Send,
  Paperclip
} from "lucide-react";
import { Link, useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Message } from "@shared/schema";
import { format } from "date-fns";

export default function SandboxMessages() {
  const [, params] = useRoute("/sandbox/project/:id/messages");
  const projectId = params?.id;
  const { user, loading: authLoading } = useAuth();
  const [newMessage, setNewMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: sandboxData, isLoading: sandboxLoading } = useQuery({
    queryKey: ["/api/sandbox/data"],
    queryFn: () => api.getSandboxData(),
    enabled: user?.role === "admin",
  });

  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ["/api/projects", projectId, "messages"],
    queryFn: () => api.getMessages(projectId!),
    enabled: !!projectId,
    refetchInterval: 3000,
  });

  const sendMutation = useMutation({
    mutationFn: (content: string) => api.createMessage(projectId!, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "messages"] });
      setNewMessage("");
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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
  const client = sandboxData.client;

  const handleSend = () => {
    if (newMessage.trim()) {
      sendMutation.mutate(newMessage.trim());
    }
  };

  const sortedMessages = [...messages].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
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

      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full p-4">
        <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg p-3 mb-4 flex items-start gap-3">
          <TestTube className="w-4 h-4 text-purple-600 mt-0.5" />
          <p className="text-xs text-purple-600 dark:text-purple-400">
            Sandbox messaging for "{project.name}". Messages sent here are isolated test data.
          </p>
        </div>

        <Card className="flex-1 flex flex-col">
          <CardHeader className="border-b py-3">
            <CardTitle className="text-lg">Project Messages</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0 flex flex-col">
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              {messagesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              ) : sortedMessages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No messages yet. Start the conversation!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {sortedMessages.map((msg: Message & { isOwn?: boolean }) => (
                    <div 
                      key={msg.id} 
                      className={`flex gap-3 ${msg.isOwn ? 'flex-row-reverse' : ''}`}
                    >
                      <Avatar className="w-8 h-8 shrink-0">
                        <AvatarFallback className={msg.isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted'}>
                          {msg.senderAvatar || msg.senderName?.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className={`flex flex-col ${msg.isOwn ? 'items-end' : 'items-start'} max-w-[70%]`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium">{msg.senderName}</span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(msg.timestamp), "h:mm a")}
                          </span>
                        </div>
                        <div className={`rounded-lg p-3 ${
                          msg.isOwn 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted'
                        }`}>
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        </div>
                        {msg.readAt && !msg.isOwn && (
                          <span className="text-xs text-muted-foreground mt-1">Read</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            <div className="p-4 border-t">
              <form 
                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                className="flex gap-2"
              >
                <Button type="button" variant="ghost" size="icon" disabled>
                  <Paperclip className="w-4 h-4" />
                </Button>
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1"
                  data-testid="input-message"
                />
                <Button 
                  type="submit" 
                  disabled={!newMessage.trim() || sendMutation.isPending}
                  data-testid="button-send"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
