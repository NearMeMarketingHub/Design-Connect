import { useState, useCallback, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import SignaturePad from '@/components/signature-pad';
import { PenLine, Type, Calendar, FileText, ChevronLeft, ChevronRight, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

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
  fieldType: string;
  completedAt: Date;
}

interface PdfSigningSurfaceProps {
  documentUrl: string;
  fields: SigningField[];
  signerName: string;
  completedFields: Record<string, FieldCompletion>;
  onFieldComplete: (fieldId: string, value: string, type: 'drawn' | 'typed', fieldType: string) => void;
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

const COMPLETED_LABELS = {
  signature: 'Signed',
  initials: 'Initialed',
  date: 'Dated',
  text: 'Filled',
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
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const [initialsValue, setInitialsValue] = useState('');
  const [dateValue, setDateValue] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [textValue, setTextValue] = useState('');

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
    
    if (field.fieldType === 'initials') {
      const nameParts = signerName.split(' ');
      const defaultInitials = nameParts.map(p => p[0]?.toUpperCase() || '').join('');
      setInitialsValue(defaultInitials);
    } else if (field.fieldType === 'date') {
      setDateValue(format(new Date(), 'yyyy-MM-dd'));
    } else if (field.fieldType === 'text') {
      setTextValue('');
    }
    
    setDialogOpen(true);
  };

  const handleSignatureComplete = (signatureData: string, signatureType: 'drawn' | 'typed') => {
    if (activeField) {
      onFieldComplete(activeField.id, signatureData, signatureType, 'signature');
      closeDialog();
    }
  };

  const handleInitialsSubmit = () => {
    if (activeField && initialsValue.trim()) {
      onFieldComplete(activeField.id, initialsValue.trim().toUpperCase(), 'typed', 'initials');
      closeDialog();
    }
  };

  const handleDateSubmit = () => {
    if (activeField && dateValue) {
      const formattedDate = format(new Date(dateValue), 'MM/dd/yyyy');
      onFieldComplete(activeField.id, formattedDate, 'typed', 'date');
      closeDialog();
    }
  };

  const handleTextSubmit = () => {
    if (activeField && textValue.trim()) {
      onFieldComplete(activeField.id, textValue.trim(), 'typed', 'text');
      closeDialog();
    }
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setActiveField(null);
    setInitialsValue('');
    setTextValue('');
  };

  const currentPageFields = fields.filter(f => f.pageNumber === currentPage);

  const completedCount = Object.keys(completedFields).length;
  const requiredCount = fields.filter(f => f.isRequired).length;
  const requiredCompleted = fields.filter(f => f.isRequired && completedFields[f.id]).length;

  const renderFieldContent = (field: SigningField, isCompleted: boolean) => {
    const fieldType = field.fieldType as keyof typeof FIELD_ICONS;
    const Icon = FIELD_ICONS[fieldType] || PenLine;
    const completedLabel = COMPLETED_LABELS[fieldType] || 'Done';
    const pendingLabel = FIELD_LABELS[fieldType] || 'Click';

    if (isCompleted) {
      const completion = completedFields[field.id];
      if (fieldType === 'date' || fieldType === 'text' || fieldType === 'initials') {
        return (
          <span className="text-xs font-medium text-white truncate px-1">
            {completion.value}
          </span>
        );
      }
      return (
        <>
          <Check className="w-4 h-4 text-white shrink-0" />
          <span className="text-xs font-medium text-white">{completedLabel}</span>
        </>
      );
    }

    return (
      <>
        <Icon className="w-4 h-4 shrink-0" />
        <span className="text-xs font-medium">{pendingLabel}</span>
        {field.isRequired && (
          <span className="text-red-500 text-xs">*</span>
        )}
      </>
    );
  };

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
                  "absolute border-2 rounded flex items-center justify-center gap-1 transition-all cursor-pointer overflow-hidden",
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
                {renderFieldContent(field, isCompleted)}
              </button>
            );
          })}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className={activeField?.fieldType === 'signature' ? "max-w-2xl" : "max-w-md"}>
          <DialogHeader>
            <DialogTitle>
              {activeField?.fieldType === 'signature' ? 'Add Your Signature' : 
               activeField?.fieldType === 'initials' ? 'Add Your Initials' :
               activeField?.fieldType === 'date' ? 'Select Date' : 
               activeField?.fieldType === 'text' ? 'Enter Text' : 'Complete Field'}
            </DialogTitle>
          </DialogHeader>

          {activeField?.fieldType === 'signature' && (
            <SignaturePad
              onSignatureComplete={handleSignatureComplete}
              signerName={signerName}
            />
          )}

          {activeField?.fieldType === 'initials' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="initials">Your Initials</Label>
                <Input
                  id="initials"
                  value={initialsValue}
                  onChange={(e) => setInitialsValue(e.target.value.slice(0, 4).toUpperCase())}
                  placeholder="e.g., JD"
                  className="text-2xl font-bold text-center uppercase tracking-widest"
                  maxLength={4}
                  autoFocus
                  data-testid="input-initials"
                />
                <p className="text-xs text-muted-foreground text-center">
                  Enter your initials (up to 4 characters)
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeDialog}>Cancel</Button>
                <Button 
                  onClick={handleInitialsSubmit} 
                  disabled={!initialsValue.trim()}
                  data-testid="button-submit-initials"
                >
                  Apply Initials
                </Button>
              </DialogFooter>
            </div>
          )}

          {activeField?.fieldType === 'date' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={dateValue}
                  onChange={(e) => setDateValue(e.target.value)}
                  className="text-lg"
                  autoFocus
                  data-testid="input-date"
                />
                <p className="text-xs text-muted-foreground">
                  Today's date has been pre-filled. Adjust if needed.
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeDialog}>Cancel</Button>
                <Button 
                  onClick={handleDateSubmit} 
                  disabled={!dateValue}
                  data-testid="button-submit-date"
                >
                  Apply Date
                </Button>
              </DialogFooter>
            </div>
          )}

          {activeField?.fieldType === 'text' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="text">Enter Text</Label>
                <Textarea
                  id="text"
                  value={textValue}
                  onChange={(e) => setTextValue(e.target.value)}
                  placeholder="Type your text here..."
                  className="min-h-[100px] resize-none"
                  autoFocus
                  data-testid="input-text"
                />
                <p className="text-xs text-muted-foreground">
                  Enter the required information in the field above.
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeDialog}>Cancel</Button>
                <Button 
                  onClick={handleTextSubmit} 
                  disabled={!textValue.trim()}
                  data-testid="button-submit-text"
                >
                  Apply Text
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
