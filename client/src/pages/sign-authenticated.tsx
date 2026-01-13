import { useState, useCallback } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PdfSigningSurface, SigningField, FieldCompletion } from "@/components/pdf-signing-surface";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Shield,
  ArrowLeft,
  Send
} from "lucide-react";
import { format } from "date-fns";

interface SigningData {
  packet: {
    id: string;
    title: string;
    message?: string;
    dueDate?: string;
  };
  participant: {
    id: string;
    name: string;
    email: string;
    status: string;
  };
  document?: {
    name: string;
    fileUrl: string;
    mimeType?: string;
  } | null;
  fields?: SigningField[];
}

export default function SignAuthenticatedPage() {
  const { packetId } = useParams<{ packetId: string }>();
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [completedFields, setCompletedFields] = useState<Record<string, FieldCompletion>>({});
  const { toast } = useToast();

  const { data, isLoading, error, isError } = useQuery<SigningData>({
    queryKey: ["/api/signing-packets", packetId, "sign"],
    queryFn: async () => {
      const response = await fetch(`/api/signing-packets/${packetId}/sign`, {
        credentials: 'include'
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Failed to load signing request");
      }
      return response.json();
    },
    retry: false,
  });

  const signMutation = useMutation({
    mutationFn: async (payload: { signatureData: string; signatureType: string }) => {
      const response = await fetch(`/api/signing-packets/${packetId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Failed to sign document");
      }
      return response.json();
    },
    onSuccess: () => {
      setIsComplete(true);
      toast({
        title: "Document Signed",
        description: "Your signature has been recorded successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFieldComplete = useCallback((fieldId: string, value: string, type: 'drawn' | 'typed') => {
    setCompletedFields(prev => ({
      ...prev,
      [fieldId]: { value, type, completedAt: new Date() }
    }));
    toast({
      title: "Field Signed",
      description: "Click on remaining fields to complete signing.",
    });
  }, [toast]);

  const handleSubmitSignatures = () => {
    const firstSignature = Object.values(completedFields)[0];
    if (firstSignature) {
      signMutation.mutate({
        signatureData: firstSignature.value,
        signatureType: firstSignature.type
      });
    }
  };

  const fields = data?.fields || [];
  const requiredFields = fields.filter(f => f.isRequired);
  const allRequiredComplete = requiredFields.every(f => completedFields[f.id]);
  const hasAnySignature = Object.keys(completedFields).length > 0;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
              <p className="text-muted-foreground">Loading document...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {error?.message || "Failed to load signing request"}
              </AlertDescription>
            </Alert>
            <Button 
              className="w-full mt-4" 
              variant="outline"
              onClick={() => window.history.back()}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-50 to-slate-100 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-10 w-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-green-800">Document Signed!</h2>
              <p className="text-muted-foreground">
                Your signature has been recorded. You will receive a confirmation email shortly.
              </p>
              <div className="flex gap-3 mt-4">
                <Button variant="outline" onClick={() => window.history.back()}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Return to Project
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-4">
      <div className="max-w-5xl mx-auto space-y-6">
        <Button 
          variant="ghost" 
          onClick={() => window.history.back()}
          className="mb-2"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Project
        </Button>

        <Card>
          <CardHeader className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-t-lg">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              <span className="text-sm font-medium">BuildVision Secure Signing</span>
            </div>
            <CardTitle className="text-2xl">{data?.packet.title}</CardTitle>
            <CardDescription className="text-slate-300">
              Click on each highlighted field to add your signature
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6 pt-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Signing as</p>
                <p className="font-medium">{data?.participant.name}</p>
                <p className="text-sm text-muted-foreground">{data?.participant.email}</p>
              </div>
              {data?.packet.dueDate && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Due Date</p>
                  <div className="flex items-center gap-2 text-orange-600">
                    <Clock className="h-4 w-4" />
                    <span className="font-medium">
                      {format(new Date(data.packet.dueDate), "MMMM d, yyyy")}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {data?.packet.message && (
              <Alert>
                <AlertDescription className="italic">
                  "{data.packet.message}"
                </AlertDescription>
              </Alert>
            )}

            {data?.document && data.document.mimeType === 'application/pdf' && fields.length > 0 ? (
              <div className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <FileText className="h-6 w-6 text-blue-500" />
                  <div>
                    <p className="font-medium">{data.document.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Click on the highlighted areas below to sign
                    </p>
                  </div>
                </div>
                
                <PdfSigningSurface
                  documentUrl={data.document.fileUrl}
                  fields={fields}
                  signerName={data.participant.name}
                  completedFields={completedFields}
                  onFieldComplete={handleFieldComplete}
                />
              </div>
            ) : data?.document ? (
              <div className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-blue-500" />
                    <div>
                      <p className="font-medium">{data.document.name}</p>
                      <p className="text-sm text-muted-foreground">PDF Document</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <a href={data.document.fileUrl} target="_blank" rel="noopener noreferrer">
                      View Document
                    </a>
                  </Button>
                </div>
                <p className="text-sm text-amber-600">
                  No signature fields have been placed on this document. Please contact the sender.
                </p>
              </div>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Document</AlertTitle>
                <AlertDescription>
                  No document is attached to this signing request.
                </AlertDescription>
              </Alert>
            )}

            <div className="border-t pt-6 space-y-4">
              <h3 className="font-semibold">Legal Agreement</h3>
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="terms"
                  checked={agreedToTerms}
                  onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
                />
                <Label htmlFor="terms" className="text-sm leading-relaxed">
                  I agree that by submitting my signatures below, I am providing my electronic signature, 
                  which I intend to be legally binding in accordance with the Electronic Signatures in 
                  Global and National Commerce Act (ESIGN) and the Uniform Electronic Transactions Act (UETA).
                </Label>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-4">
              <Button variant="outline" onClick={() => window.history.back()}>
                Cancel
              </Button>
              <Button 
                onClick={handleSubmitSignatures}
                disabled={!agreedToTerms || !allRequiredComplete || !hasAnySignature || signMutation.isPending}
              >
                {signMutation.isPending ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Submit Signatures
                  </>
                )}
              </Button>
            </div>

            {!allRequiredComplete && hasAnySignature && (
              <p className="text-sm text-amber-600 text-center">
                Please complete all required signature fields before submitting.
              </p>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          This document is being signed securely through BuildVision.
          Your signature is legally binding and will be recorded with a timestamp.
        </p>
      </div>
    </div>
  );
}
