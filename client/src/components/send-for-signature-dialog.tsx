import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Send, FileText, CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Recipient {
  id: string;
  name: string;
  email: string;
}

interface SendForSignatureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  document?: {
    id: string;
    name: string;
  } | null;
}

export default function SendForSignatureDialog({
  open,
  onOpenChange,
  projectId,
  document,
}: SendForSignatureDialogProps) {
  const [title, setTitle] = useState(document?.name || "");
  const [message, setMessage] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [recipients, setRecipients] = useState<Recipient[]>([
    { id: crypto.randomUUID(), name: "", email: "" },
  ]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const sendMutation = useMutation({
    mutationFn: async (data: {
      documentId?: string;
      title: string;
      message: string;
      dueDate?: Date;
      recipients: { name: string; email: string }[];
    }) => {
      const response = await fetch(`/api/projects/${projectId}/signing-packets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to send for signature");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sent for Signature",
        description: "The document has been sent for signature.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/signing-packets`] });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setTitle(document?.name || "");
    setMessage("");
    setDueDate(undefined);
    setRecipients([{ id: crypto.randomUUID(), name: "", email: "" }]);
  };

  const addRecipient = () => {
    setRecipients([...recipients, { id: crypto.randomUUID(), name: "", email: "" }]);
  };

  const removeRecipient = (id: string) => {
    if (recipients.length > 1) {
      setRecipients(recipients.filter((r) => r.id !== id));
    }
  };

  const updateRecipient = (id: string, field: "name" | "email", value: string) => {
    setRecipients(
      recipients.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const canSend =
    title.trim() &&
    recipients.every((r) => r.name.trim() && r.email.trim() && r.email.includes("@"));

  const handleSend = () => {
    if (!canSend) return;

    sendMutation.mutate({
      documentId: document?.id,
      title: title.trim(),
      message: message.trim(),
      dueDate,
      recipients: recipients.map((r) => ({ name: r.name.trim(), email: r.email.trim() })),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send for Signature
          </DialogTitle>
          <DialogDescription>
            Send this document to recipients for electronic signature.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {document && (
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="font-medium text-sm">{document.name}</p>
                <p className="text-xs text-muted-foreground">Document to be signed</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="title">Subject / Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a title for this signing request"
              data-testid="input-signing-title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message (Optional)</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a personal message for the recipients..."
              rows={3}
              data-testid="input-signing-message"
            />
          </div>

          <div className="space-y-2">
            <Label>Due Date (Optional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dueDate && "text-muted-foreground"
                  )}
                  data-testid="button-due-date"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, "PPP") : "Select a due date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  disabled={(date) => date < new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Recipients</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addRecipient}
                className="gap-1 text-xs"
                data-testid="button-add-recipient"
              >
                <Plus className="h-3 w-3" />
                Add Recipient
              </Button>
            </div>

            <div className="space-y-3">
              {recipients.map((recipient, index) => (
                <div
                  key={recipient.id}
                  className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Full Name"
                      value={recipient.name}
                      onChange={(e) => updateRecipient(recipient.id, "name", e.target.value)}
                      data-testid={`input-recipient-name-${index}`}
                    />
                    <Input
                      type="email"
                      placeholder="email@example.com"
                      value={recipient.email}
                      onChange={(e) => updateRecipient(recipient.id, "email", e.target.value)}
                      data-testid={`input-recipient-email-${index}`}
                    />
                  </div>
                  {recipients.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRecipient(recipient.id)}
                      className="h-9 w-9 text-destructive hover:text-destructive"
                      data-testid={`button-remove-recipient-${index}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={!canSend || sendMutation.isPending}
            className="gap-2"
            data-testid="button-send-signature"
          >
            <Send className="h-4 w-4" />
            {sendMutation.isPending ? "Sending..." : "Send for Signature"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
