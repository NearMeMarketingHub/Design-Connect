import { useState, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Send, FileText, Users, Calendar, AlertCircle } from 'lucide-react';
import { SignatureFieldEditor, SignatureField } from '@/components/signature-field-editor';
import { useToast } from '@/hooks/use-toast';

interface TeamMember {
  id: string;
  userId: string;
  name: string;
  email: string | null;
  role: string;
  companyName?: string;
}

interface ProjectDocument {
  id: string;
  name: string;
  fileUrl: string;
  mimeType: string;
  type: string;
}

export default function SignatureSetup() {
  const [, params] = useRoute('/contractor/project/:projectId/signature-setup/:documentId');
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const projectId = params?.projectId;
  const documentId = params?.documentId;
  
  const [dueDate, setDueDate] = useState('');
  const [message, setMessage] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [signatureFields, setSignatureFields] = useState<SignatureField[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { data: project } = useQuery({
    queryKey: ['/api/projects', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}`, { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!projectId,
  });

  const { data: document } = useQuery<ProjectDocument>({
    queryKey: ['/api/projects', projectId, 'documents', documentId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/documents`, { credentials: 'include' });
      if (!res.ok) return null;
      const docs = await res.json();
      return docs.find((d: any) => d.id === documentId);
    },
    enabled: !!projectId && !!documentId,
  });

  const { data: teamMembers = [] } = useQuery<TeamMember[]>({
    queryKey: ['/api/projects', projectId, 'team'],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/team`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!projectId,
  });

  const { data: projectClient } = useQuery({
    queryKey: ['/api/projects', projectId, 'client'],
    queryFn: async () => {
      if (!project?.clientId) return null;
      const res = await fetch(`/api/users/${project.clientId}`, { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!project?.clientId,
  });

  const allRecipients = [
    ...(projectClient ? [{
      id: projectClient.id,
      name: projectClient.name || projectClient.username,
      email: projectClient.email,
      role: 'client',
      label: `${projectClient.name || projectClient.username} (Client)`
    }] : []),
    ...teamMembers.map(m => ({
      id: m.userId,
      name: m.name,
      email: m.email,
      role: m.role,
      label: `${m.name}${m.companyName ? ` - ${m.companyName}` : ''} (${m.role === 'contractor' ? 'Contractor' : m.role})`
    }))
  ].filter((r, i, arr) => arr.findIndex(x => x.id === r.id) === i && r.id !== user?.id);

  const sendForSignatureMutation = useMutation({
    mutationFn: async () => {
      if (!dueDate) throw new Error('Due date is required');
      if (selectedRecipients.length === 0) throw new Error('Please select at least one recipient');
      if (signatureFields.length === 0) throw new Error('Please add at least one signature field');

      const recipients = selectedRecipients.map(id => {
        const recipient = allRecipients.find(r => r.id === id);
        return {
          name: recipient?.name || 'Unknown',
          email: recipient?.email || '',
          role: 'signer' as const
        };
      }).filter(r => r.email);

      if (recipients.length === 0) {
        throw new Error('Selected recipients must have email addresses');
      }

      const res = await fetch(`/api/projects/${projectId}/signing-packets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          documentId,
          title: document?.name || 'Document',
          message: message || undefined,
          dueDate,
          recipients,
          fields: signatureFields.map(f => ({
            type: f.fieldType,
            pageNumber: f.pageNumber,
            x: f.x,
            y: f.y,
            width: f.width,
            height: f.height
          }))
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to send for signature');
      }

      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Signature Request Sent',
        description: 'Recipients will receive an email with a link to sign the document.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'documents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'signing-packets'] });
      setLocation(`/contractor/project/${projectId}/action-center`);
    },
    onError: (err: Error) => {
      setError(err.message);
    }
  });

  const toggleRecipient = (id: string) => {
    setSelectedRecipients(prev => 
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  if (!document) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold">Document not found</h2>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => setLocation(`/contractor/project/${projectId}/action-center`)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Action Center
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto py-4 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setLocation(`/contractor/project/${projectId}/action-center`)}
              >
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
              </Button>
              <div>
                <h1 className="text-xl font-semibold">Set Up Signature Request</h1>
                <p className="text-sm text-muted-foreground">{document.name}</p>
              </div>
            </div>
            <Button 
              onClick={() => sendForSignatureMutation.mutate()}
              disabled={sendForSignatureMutation.isPending || selectedRecipients.length === 0 || !dueDate || signatureFields.length === 0}
              data-testid="button-send-for-signature"
            >
              {sendForSignatureMutation.isPending ? 'Sending...' : (
                <>
                  <Send className="h-4 w-4 mr-2" /> Send for Signature
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto py-6 px-4">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={() => setError(null)} className="ml-auto">
              Dismiss
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Place Signature Fields</CardTitle>
                <CardDescription>
                  Drag and drop signature fields onto the document where recipients should sign
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SignatureFieldEditor
                  documentId={document.id}
                  documentUrl={document.fileUrl}
                  documentMimeType={document.mimeType}
                  fields={signatureFields}
                  onFieldsChange={setSignatureFields}
                />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Recipients
                </CardTitle>
                <CardDescription>
                  Select who needs to sign this document
                </CardDescription>
              </CardHeader>
              <CardContent>
                {allRecipients.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No team members or client assigned to this project
                  </p>
                ) : (
                  <div className="space-y-3">
                    {allRecipients.map((recipient) => (
                      <div 
                        key={recipient.id}
                        className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                        onClick={() => toggleRecipient(recipient.id)}
                      >
                        <Checkbox
                          checked={selectedRecipients.includes(recipient.id)}
                          onCheckedChange={() => toggleRecipient(recipient.id)}
                          data-testid={`checkbox-recipient-${recipient.id}`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{recipient.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{recipient.email || 'No email'}</p>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            recipient.role === 'client' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {recipient.role === 'client' ? 'Client' : 'Contractor'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {selectedRecipients.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-3">
                    {selectedRecipients.length} recipient{selectedRecipients.length > 1 ? 's' : ''} selected
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Due Date
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="due-date">When should this be signed by? *</Label>
                  <Input
                    id="due-date"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    required
                    data-testid="input-due-date"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Message (Optional)</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Add a message to include in the signature request email..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  data-testid="textarea-message"
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
