import { useState, useCallback, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import SignaturePad from '@/components/signature-pad';
import { PenLine, Type, Calendar, FileText, ChevronLeft, ChevronRight, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export interface SigningField {
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

export interface FieldCompletion {
  value: string;
  type: 'drawn' | 'typed';
  completedAt: Date;
}

interface PdfSigningSurfaceProps {
  documentUrl: string;
  fields: SigningField[];
  signerName: string;
  completedFields: Record<string, FieldCompletion>;
  onFieldComplete: (fieldId: string, value: string, type: 'drawn' | 'typed') => void;
}

const FIELD_COLORS = {
  signature: { pending: 'bg-blue-100 border-blue-500 hover:bg-blue-200', completed: 'bg-blue-500 border-blue-700' },
  initials: { pending: 'bg-green-100 border-green-500 hover:bg-green-200', completed: 'bg-green-500 border-green-700' },
  date: { pending: 'bg-yellow-100 border-yellow-500 hover:bg-yellow-200', completed: 'bg-yellow-500 border-yellow-700' },
  text: { pending: 'bg-purple-100 border-purple-500 hover:bg-purple-200', completed: 'bg-purple-500 border-purple-700' },
};

const FIELD_ICONS = {
  signature: PenLine,
  initials: Type,
  date: Calendar,
  text: FileText,
};

const FIELD_LABELS = {
  signature: 'Sign Here',
  initials: 'Initial Here',
  date: 'Date',
  text: 'Enter Text',
};

export function PdfSigningSurface({ 
  documentUrl, 
  fields, 
  signerName,
  completedFields,
  onFieldComplete 
}: PdfSigningSurfaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageSize, setPageSize] = useState({ width: 600, height: 800 });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeField, setActiveField] = useState<SigningField | null>(null);
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setTotalPages(numPages);
    setIsLoading(false);
    setError(null);
  }, []);

  const onDocumentLoadError = useCallback((err: Error) => {
    console.error('PDF load error:', err);
    setError('Failed to load document. Please try again.');
    setIsLoading(false);
  }, []);

  const onPageLoadSuccess = useCallback((page: any) => {
    const { width, height } = page;
    setPageSize({ width, height });
  }, []);

  const handleFieldClick = (field: SigningField) => {
    if (completedFields[field.id]) return;
    setActiveField(field);
    setSignatureDialogOpen(true);
  };

  const handleSignatureComplete = (signatureData: string, signatureType: 'drawn' | 'typed') => {
    if (activeField) {
      onFieldComplete(activeField.id, signatureData, signatureType);
      setSignatureDialogOpen(false);
      setActiveField(null);
    }
  };

  const currentPageFields = fields.filter(f => f.pageNumber === currentPage);

  const completedCount = Object.keys(completedFields).length;
  const requiredCount = fields.filter(f => f.isRequired).length;
  const requiredCompleted = fields.filter(f => f.isRequired && completedFields[f.id]).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">Progress:</span>
          <span className={cn(
            "px-2 py-1 rounded",
            requiredCompleted === requiredCount ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
          )}>
            {completedCount} of {fields.length} fields completed
            {requiredCount > 0 && ` (${requiredCompleted}/${requiredCount} required)`}
          </span>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      <div 
        ref={containerRef}
        className="relative border rounded-lg bg-gray-100 overflow-auto"
        style={{ height: '600px' }}
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
              <p className="text-sm text-muted-foreground">Loading document...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-red-500">
              <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>{error}</p>
            </div>
          </div>
        )}

        <div className="relative inline-block min-w-full">
          <Document
            file={documentUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={null}
          >
            <Page
              key={`page_${currentPage}`}
              pageNumber={currentPage}
              onLoadSuccess={onPageLoadSuccess}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              width={pageSize.width}
            />
          </Document>

          {currentPageFields.map((field) => {
            const isCompleted = !!completedFields[field.id];
            const fieldType = field.fieldType as keyof typeof FIELD_COLORS;
            const colorScheme = FIELD_COLORS[fieldType] || FIELD_COLORS.signature;
            const Icon = FIELD_ICONS[fieldType] || PenLine;
            const label = FIELD_LABELS[fieldType] || 'Sign';

            const left = (field.xPosition / 100) * pageSize.width;
            const top = (field.yPosition / 100) * pageSize.height;
            const width = (field.width / 100) * pageSize.width;
            const height = (field.height / 100) * pageSize.height;

            return (
              <button
                key={field.id}
                onClick={() => handleFieldClick(field)}
                disabled={isCompleted}
                className={cn(
                  "absolute border-2 rounded flex items-center justify-center gap-1 transition-all cursor-pointer",
                  isCompleted ? colorScheme.completed : colorScheme.pending,
                  isCompleted && "cursor-default"
                )}
                style={{
                  left: `${left}px`,
                  top: `${top}px`,
                  width: `${width}px`,
                  height: `${height}px`,
                }}
                data-testid={`signing-field-${field.id}`}
              >
                {isCompleted ? (
                  <>
                    <Check className="w-4 h-4 text-white" />
                    <span className="text-xs font-medium text-white">Signed</span>
                  </>
                ) : (
                  <>
                    <Icon className="w-4 h-4" />
                    <span className="text-xs font-medium">{label}</span>
                    {field.isRequired && (
                      <span className="text-red-500 text-xs">*</span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <Dialog open={signatureDialogOpen} onOpenChange={setSignatureDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {activeField?.fieldType === 'signature' ? 'Add Your Signature' : 
               activeField?.fieldType === 'initials' ? 'Add Your Initials' :
               activeField?.fieldType === 'date' ? 'Add Date' : 'Add Your Signature'}
            </DialogTitle>
          </DialogHeader>
          <SignaturePad
            onSignatureComplete={handleSignatureComplete}
            signerName={signerName}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
