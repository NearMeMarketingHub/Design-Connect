import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import SignaturePad from "@/components/signature-pad";
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
  Download,
  ExternalLink 
} from "lucide-react";
import { format } from "date-fns";

interface SigningField {
  id: string;
  fieldType: string;
  pageNumber: number;
  xPosition: number;
  yPosition: number;
  width: number;
  height: number;
  isRequired: boolean;
  label?: string;
}

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

export default function SignDocumentPage() {
  const { token } = useParams<{ token: string }>();
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const { toast } = useToast();

  const { data, isLoading, error, isError } = useQuery<SigningData>({
    queryKey: ["/api/sign", token],
    queryFn: async () => {
      const response = await fetch(`/api/sign/${token}`);
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
      const response = await fetch(`/api/sign/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  const handleSignatureComplete = (signatureData: string, signatureType: 'drawn' | 'typed') => {
    signMutation.mutate({ signatureData, signatureType });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">Loading signing request...</p>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Unable to Load Document</CardTitle>
            <CardDescription>
              {error instanceof Error ? error.message : "This signing link may be invalid or expired."}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground">
              If you believe this is an error, please contact the sender for a new signing link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (data.participant.status === "signed" || isComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle>Document Signed</CardTitle>
            <CardDescription>
              Thank you, {data.participant.name}! Your signature has been recorded.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                You will receive a copy of the signed document via email once all parties have signed.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4" />
              <span>Secured by Near Me Construct</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Near Me Construct</h1>
              <p className="text-sm text-muted-foreground">Document Signing</p>
            </div>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{data.packet.title}</CardTitle>
            {data.packet.message && (
              <CardDescription className="whitespace-pre-wrap">
                {data.packet.message}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="font-medium">Signing as:</span>
                <span>{data.participant.name} ({data.participant.email})</span>
              </div>
              {data.packet.dueDate && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Due: {format(new Date(data.packet.dueDate), "PPP")}</span>
                </div>
              )}
            </div>

            {data.document && (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted p-3 flex items-center justify-between border-b">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">{data.document.name}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      data-testid="button-view-document"
                    >
                      <a href={data.document.fileUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-1" />
                        View
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      data-testid="button-download-document"
                    >
                      <a href={data.document.fileUrl} download>
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </a>
                    </Button>
                  </div>
                </div>
                
                {data.document.mimeType?.includes("pdf") ? (
                  <iframe
                    src={data.document.fileUrl}
                    className="w-full h-[500px] border-0"
                    title="Document Preview"
                  />
                ) : data.document.mimeType?.includes("image") ? (
                  <div className="p-4 flex justify-center">
                    <img
                      src={data.document.fileUrl}
                      alt="Document"
                      className="max-w-full max-h-[500px] object-contain"
                    />
                  </div>
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Preview not available. Please download the document to view.</p>
                  </div>
                )}
              </div>
            )}

            {data.fields && data.fields.length > 0 && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Required Fields</h4>
                <div className="flex flex-wrap gap-2">
                  {data.fields.map((field, index) => (
                    <span 
                      key={field.id} 
                      className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded"
                    >
                      {field.fieldType === 'signature' ? 'Signature' : 
                       field.fieldType === 'initials' ? 'Initials' : 
                       field.fieldType === 'date' ? 'Date' : 'Text'} 
                      {' '}(Page {field.pageNumber})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sign Document</CardTitle>
            <CardDescription>
              Please review the document above before signing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!showSignaturePad ? (
              <>
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertTitle>Legal Agreement</AlertTitle>
                  <AlertDescription>
                    By signing this document, you agree that your electronic signature is the legal 
                    equivalent of your manual/handwritten signature on this document.
                  </AlertDescription>
                </Alert>

                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="agree"
                    checked={agreedToTerms}
                    onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
                    data-testid="checkbox-agree-terms"
                  />
                  <Label htmlFor="agree" className="text-sm leading-relaxed cursor-pointer">
                    I have read and understand the document above. I agree to sign this document 
                    electronically and consent to use electronic records and signatures.
                  </Label>
                </div>

                <Button
                  onClick={() => setShowSignaturePad(true)}
                  disabled={!agreedToTerms}
                  className="w-full"
                  data-testid="button-start-signing"
                >
                  Continue to Sign
                </Button>
              </>
            ) : (
              <SignaturePad
                onSignatureComplete={handleSignatureComplete}
                signerName={data.participant.name}
              />
            )}

            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-4 border-t">
              <Shield className="h-3 w-3" />
              <span>Your signature is secured with end-to-end encryption</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
