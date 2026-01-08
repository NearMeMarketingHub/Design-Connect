import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Send, Plus, ArrowLeft, Users, MessageSquare, Loader2, X, Image as ImageIcon } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface ImageReference {
  src: string;
  title: string;
  category: string;
}

interface ProjectClient {
  id: string;
  name: string | null;
  username: string;
  email: string | null;
  phone: string | null;
  profilePicture: string | null;
}

interface ChatPanelProps {
  projectId: string;
  currentUserId: string;
  currentUserRole: string;
  currentUserCompanyType?: string | null;
  initialChatId?: string | null;
  initialImageReference?: ImageReference | null;
  onImageReferenceSent?: () => void;
  projectClient?: ProjectClient | null;
}

interface ChatParticipant {
  id: string;
  userId: string;
  chatId: string;
  lastReadAt: string | null;
  user?: {
    id: string;
    name: string | null;
    username: string;
    profilePicture: string | null;
    companyName: string | null;
    companyType: string | null;
    role?: string;
  };
}

interface Chat {
  id: string;
  projectId: string;
  type: "direct" | "group";
  title: string | null;
  createdById: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  lastMessageSenderId: string | null;
  lastMessageSenderName: string | null;
  isDefault: boolean;
  participants: ChatParticipant[];
  unreadCount: number;
}

interface ChatMessage {
  id: string;
  chatId: string;
  projectId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  content: string;
  attachmentType: string | null;
  attachmentUrl: string | null;
  attachmentName: string | null;
  createdAt: string;
}

interface MessageRead {
  id: string;
  messageId: string;
  userId: string;
  readAt: string;
  user?: {
    id: string;
    name: string | null;
    username: string;
    profilePicture: string | null;
  };
}

interface TeamMember {
  id: string;
  projectId: string;
  contractorId: string;
  role: string | null;
  contractor?: {
    id: string;
    name: string | null;
    username: string;
    profilePicture: string | null;
    companyName: string | null;
    companyType: string | null;
  };
}

export function ChatPanel({ 
  projectId, 
  currentUserId, 
  currentUserRole, 
  currentUserCompanyType,
  initialChatId,
  initialImageReference,
  onImageReferenceSent,
  projectClient
}: ChatPanelProps) {
  const [selectedChatId, setSelectedChatId] = useState<string | null>(initialChatId || null);
  const [messageInput, setMessageInput] = useState("");
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [newChatTitle, setNewChatTitle] = useState("");
  const [imageReference, setImageReference] = useState<ImageReference | null>(initialImageReference || null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const lastMessageCount = useRef(0);
  const hasProcessedInitialRef = useRef(false);

  const isAdminOrPM = currentUserRole === 'admin' || currentUserCompanyType === 'Project Manager';

  // Handle initial chat ID and image reference from props
  useEffect(() => {
    if (initialChatId && !hasProcessedInitialRef.current) {
      hasProcessedInitialRef.current = true;
      setSelectedChatId(initialChatId);
    }
    if (initialImageReference) {
      setImageReference(initialImageReference);
    }
  }, [initialChatId, initialImageReference]);

  // Fetch chats for the project
  const { data: chats = [], isLoading: chatsLoading } = useQuery<Chat[]>({
    queryKey: ['/api/projects', projectId, 'chats'],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/projects/${projectId}/chats`);
      return res.json();
    },
  });

  // Fetch messages for selected chat
  const { data: messages = [], isLoading: messagesLoading } = useQuery<ChatMessage[]>({
    queryKey: ['/api/chats', selectedChatId, 'messages'],
    queryFn: async () => {
      if (!selectedChatId) return [];
      const res = await apiRequest("GET", `/api/chats/${selectedChatId}/messages`);
      return res.json();
    },
    enabled: !!selectedChatId,
  });

  // Fetch read receipts for selected chat
  const { data: readReceipts = [] } = useQuery<MessageRead[]>({
    queryKey: ['/api/chats', selectedChatId, 'read-receipts'],
    queryFn: async () => {
      if (!selectedChatId) return [];
      const res = await apiRequest("GET", `/api/chats/${selectedChatId}/read-receipts`);
      return res.json();
    },
    enabled: !!selectedChatId,
  });

  // Fetch team members for new chat dialog
  const { data: teamMembers = [] } = useQuery<TeamMember[]>({
    queryKey: ['/api/projects', projectId, 'team'],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/projects/${projectId}/team`);
      return res.json();
    },
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (data: { content: string; imageRef?: ImageReference | null }) => {
      const payload: any = { content: data.content };
      if (data.imageRef) {
        payload.replyToImageUrl = data.imageRef.src;
        payload.replyToImageTitle = data.imageRef.title;
      }
      const res = await apiRequest("POST", `/api/chats/${selectedChatId}/messages`, payload);
      return res.json();
    },
    onSuccess: () => {
      setMessageInput("");
      setImageReference(null);
      if (onImageReferenceSent) {
        onImageReferenceSent();
      }
      queryClient.invalidateQueries({ queryKey: ['/api/chats', selectedChatId, 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'chats'] });
    },
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/chats/${selectedChatId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'chats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/chats', selectedChatId, 'read-receipts'] });
    },
  });

  // Create chat mutation
  const createChatMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/chats`, {
        participantIds: [...selectedParticipants, currentUserId],
        title: newChatTitle || null,
        type: selectedParticipants.length > 1 ? 'group' : 'direct',
      });
      return res.json();
    },
    onSuccess: (chat) => {
      setShowNewChatDialog(false);
      setSelectedParticipants([]);
      setNewChatTitle("");
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'chats'] });
      setSelectedChatId(chat.id);
    },
  });

  // Get the selected chat object
  const selectedChat = chats.find((c: Chat) => c.id === selectedChatId);
  const isParticipant = selectedChat?.participants.some((p: ChatParticipant) => p.userId === currentUserId);

  // No auto-selection - show chat list by default when user opens Messages tab

  // Mark messages as read when viewing a chat - only if user is participant
  // Fire when new messages arrive (message count changes)
  useEffect(() => {
    if (selectedChatId && messages.length > 0 && isParticipant) {
      if (messages.length !== lastMessageCount.current) {
        lastMessageCount.current = messages.length;
        markAsReadMutation.mutate();
      }
    }
  }, [selectedChatId, messages.length, isParticipant]);

  // Reset the message count when switching chats
  useEffect(() => {
    lastMessageCount.current = 0;
  }, [selectedChatId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if ((messageInput.trim() || imageReference) && !sendMessageMutation.isPending) {
      sendMessageMutation.mutate({ 
        content: messageInput.trim() || `Discussing: ${imageReference?.title}`, 
        imageRef: imageReference 
      });
    }
  };

  const getChatDisplayName = (chat: Chat): string => {
    if (chat.type === 'group') {
      return chat.title || 'Team Chat';
    }
    const otherParticipant = chat.participants.find(p => p.userId !== currentUserId);
    return otherParticipant?.user?.name || otherParticipant?.user?.username || 'Chat';
  };

  const getChatAvatar = (chat: Chat): { initials: string; src?: string } => {
    if (chat.type === 'group') {
      return { initials: 'TC' };
    }
    const otherParticipant = chat.participants.find(p => p.userId !== currentUserId);
    const name = otherParticipant?.user?.name || otherParticipant?.user?.username || 'U';
    return { 
      initials: name.charAt(0).toUpperCase(),
      src: otherParticipant?.user?.profilePicture || undefined
    };
  };

  // Get read receipts for the last message (excluding current user)
  const getLastMessageReads = (): MessageRead[] => {
    if (messages.length === 0) return [];
    const lastMessage = messages[messages.length - 1];
    return readReceipts.filter((r: MessageRead) => r.messageId === lastMessage.id && r.userId !== currentUserId);
  };

  // Get selectable participants for new chat (team members + client for contractors, excluding current user)
  type SelectableParticipant = {
    id: string;
    name: string | null;
    username: string;
    profilePicture: string | null;
    role?: string;
    isClient?: boolean;
  };
  
  const getSelectableParticipants = (): SelectableParticipant[] => {
    const participants: SelectableParticipant[] = [];
    
    // Add team members (contractors)
    teamMembers
      .filter(member => member.contractorId !== currentUserId)
      .forEach(member => {
        if (member.contractor) {
          participants.push({
            id: member.contractorId,
            name: member.contractor.name,
            username: member.contractor.username,
            profilePicture: member.contractor.profilePicture,
            role: member.role || undefined,
            isClient: false
          });
        }
      });
    
    // Add the project client for contractors/admins (if not the current user)
    if (currentUserRole !== 'client' && projectClient && projectClient.id !== currentUserId) {
      participants.push({
        id: projectClient.id,
        name: projectClient.name,
        username: projectClient.username,
        profilePicture: projectClient.profilePicture,
        isClient: true
      });
    }
    
    return participants;
  };

  // Check if a chat is internal (only contractors, no clients)
  const isInternalChat = (chat: Chat): boolean => {
    if (!chat.participants || chat.participants.length === 0) return false;
    return chat.participants.every(p => p.user?.role !== 'client');
  };

  if (chatsLoading) {
    return (
      <Card className="flex flex-col items-center justify-center" style={{ height: 'calc(100vh - 280px)' }}>
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        <p className="mt-2 text-muted-foreground">Loading chats...</p>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col" style={{ height: 'calc(100vh - 280px)' }}>
      <CardHeader className="border-b border-border py-4 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg">Messages</CardTitle>
          <CardDescription>Chat with your project team</CardDescription>
        </div>
        {!selectedChatId && (teamMembers.length > 0 || (currentUserRole !== 'client' && projectClient)) && (
          <Dialog open={showNewChatDialog} onOpenChange={setShowNewChatDialog}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-new-chat">
                <Plus className="w-4 h-4 mr-2" />
                New Chat
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Start New Conversation</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Select Participants</label>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {getSelectableParticipants().map((participant) => (
                      <div key={participant.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={participant.id}
                          checked={selectedParticipants.includes(participant.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedParticipants([...selectedParticipants, participant.id]);
                            } else {
                              setSelectedParticipants(selectedParticipants.filter(id => id !== participant.id));
                            }
                          }}
                        />
                        <label htmlFor={participant.id} className="text-sm cursor-pointer flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={participant.profilePicture || undefined} />
                            <AvatarFallback className="text-xs">
                              {(participant.name || participant.username || 'U').charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span>{participant.name || participant.username}</span>
                          {participant.isClient && <Badge variant="secondary" className="text-xs">Client</Badge>}
                          {participant.role && <span className="text-muted-foreground">({participant.role})</span>}
                        </label>
                      </div>
                    ))}
                  </div>
                  {getSelectableParticipants().length === 0 && (
                    <p className="text-sm text-muted-foreground">No participants available to chat with.</p>
                  )}
                </div>
                {selectedParticipants.length > 1 && (
                  <div>
                    <label className="text-sm font-medium mb-2 block">Group Name (Optional)</label>
                    <Input
                      placeholder="e.g., Kitchen Remodel Discussion"
                      value={newChatTitle}
                      onChange={(e) => setNewChatTitle(e.target.value)}
                    />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button 
                  onClick={() => createChatMutation.mutate()}
                  disabled={selectedParticipants.length === 0 || createChatMutation.isPending}
                  data-testid="button-create-chat"
                >
                  {createChatMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</>
                  ) : 'Start Chat'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0 flex">
        {!selectedChatId ? (
          // Chat list view
          <div className="w-full">
            {chats.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 p-4">
                <MessageSquare className="w-12 h-12 text-muted-foreground/50" />
                <p className="text-muted-foreground text-center">
                  No conversations yet. Your team will reach out when the project starts.
                </p>
              </div>
            ) : (
              <ScrollArea className="h-full">
                <div className="divide-y divide-border">
                  {chats.map((chat: Chat) => {
                    const chatName = getChatDisplayName(chat);
                    const chatAvatar = getChatAvatar(chat);
                    const hasUnread = chat.unreadCount > 0;
                    
                    return (
                      <div
                        key={chat.id}
                        className="flex items-center gap-3 p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => setSelectedChatId(chat.id)}
                        data-testid={`chat-item-${chat.id}`}
                      >
                        <div className="relative">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={chatAvatar.src} />
                            <AvatarFallback className={chat.type === 'group' ? 'bg-primary/10' : ''}>
                              {chat.type === 'group' ? <Users className="w-5 h-5" /> : chatAvatar.initials}
                            </AvatarFallback>
                          </Avatar>
                          {hasUnread && (
                            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                              {chat.unreadCount > 9 ? '9+' : chat.unreadCount}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className={`font-medium truncate ${hasUnread ? 'font-bold' : ''}`}>
                              {chatName}
                            </span>
                            {chat.lastMessageAt && (
                              <span className="text-xs text-muted-foreground">
                                {new Date(chat.lastMessageAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          {chat.lastMessagePreview && (
                            <p className={`text-sm truncate ${hasUnread ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                              {chat.lastMessageSenderName && (
                                <span className="font-medium">{chat.lastMessageSenderName}: </span>
                              )}
                              {chat.lastMessagePreview}
                            </p>
                          )}
                          <div className="flex items-center gap-1 mt-1 flex-wrap">
                            {isInternalChat(chat) && currentUserRole !== 'client' && (
                              <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                                Internal
                              </Badge>
                            )}
                            {chat.type === 'group' && (
                              <Badge variant="secondary" className="text-xs">
                                {chat.participants.length} members
                              </Badge>
                            )}
                            {isAdminOrPM && !chat.participants.some(p => p.userId === currentUserId) && (
                              <Badge variant="outline" className="text-xs">
                                Viewing as {currentUserRole === 'admin' ? 'Admin' : 'PM'}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        ) : (
          // Chat window view
          <div className="w-full flex flex-col h-full">
            {/* Chat header */}
            <div className="flex items-center gap-3 p-3 border-b">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedChatId(null)}
                data-testid="button-back-to-chats"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              {selectedChat && (
                <>
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={getChatAvatar(selectedChat).src} />
                    <AvatarFallback>
                      {selectedChat.type === 'group' ? <Users className="w-4 h-4" /> : getChatAvatar(selectedChat).initials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{getChatDisplayName(selectedChat)}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedChat.participants.length} participant{selectedChat.participants.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              {messagesLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground">No messages yet. Start the conversation!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg: ChatMessage, index: number) => {
                    const isOwn = msg.senderId === currentUserId;
                    const isLastMessage = index === messages.length - 1;
                    const lastMessageReads = isLastMessage ? getLastMessageReads() : [];
                    
                    return (
                      <div key={msg.id} className={`flex gap-3 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                        {!isOwn && (
                          <Avatar className="h-8 w-8 flex-shrink-0">
                            <AvatarImage src={msg.senderAvatar || undefined} />
                            <AvatarFallback>
                              {msg.senderName.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div className={`flex flex-col max-w-[70%] ${isOwn ? 'items-end' : 'items-start'}`}>
                          <div className={`p-3 rounded-lg ${
                            isOwn 
                              ? 'bg-primary text-primary-foreground rounded-br-none' 
                              : 'bg-muted rounded-bl-none'
                          }`}>
                            <p className="text-sm">{msg.content}</p>
                          </div>
                          <div className={`flex items-center gap-1 mt-1 text-xs text-muted-foreground ${isOwn ? 'justify-end' : ''}`}>
                            {!isOwn && <span>{msg.senderName}</span>}
                            {!isOwn && <span>•</span>}
                            <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          {/* Read receipts for last message */}
                          {isLastMessage && lastMessageReads.length > 0 && (
                            <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : ''}`}>
                              {lastMessageReads.slice(0, 5).map((read: MessageRead) => (
                                <Avatar key={read.userId} className="h-4 w-4">
                                  <AvatarImage src={read.user?.profilePicture || undefined} />
                                  <AvatarFallback className="text-[8px]">
                                    {(read.user?.name || read.user?.username || 'U').charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                              ))}
                              {lastMessageReads.length > 5 && (
                                <span className="text-xs text-muted-foreground">
                                  +{lastMessageReads.length - 5}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Message input */}
            {isParticipant ? (
              <form onSubmit={handleSendMessage} className="p-4 border-t">
                {/* Image reference preview */}
                {imageReference && (
                  <div className="flex items-center gap-3 p-2 mb-2 bg-muted rounded-lg border border-border">
                    <img 
                      src={imageReference.src} 
                      alt={imageReference.title}
                      className="w-12 h-12 object-cover rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{imageReference.title}</p>
                      <p className="text-xs text-muted-foreground">{imageReference.category}</p>
                    </div>
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setImageReference(null)}
                      data-testid="button-remove-image-reference"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    placeholder={imageReference ? `Add a comment about "${imageReference.title}"...` : "Type a message..."}
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    className="flex-1"
                    data-testid="input-message"
                  />
                  <Button 
                    type="submit" 
                    disabled={(!messageInput.trim() && !imageReference) || sendMessageMutation.isPending}
                    data-testid="button-send-message"
                  >
                    {sendMessageMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </form>
            ) : isAdminOrPM ? (
              <div className="p-4 border-t bg-muted/50">
                <p className="text-sm text-muted-foreground text-center">
                  You are viewing this chat as {currentUserRole === 'admin' ? 'an Admin' : 'a Project Manager'}
                </p>
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
