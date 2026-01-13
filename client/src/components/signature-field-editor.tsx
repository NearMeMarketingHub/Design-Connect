import { useState, useRef, useEffect, useCallback } from 'react';
import { Rnd } from 'react-rnd';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { PenLine, Type, Calendar, FileText, Trash2, Plus, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export interface SignatureField {
  id: string;
  fieldType: 'signature' | 'initials' | 'date' | 'text';
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SignatureFieldEditorProps {
  documentId: string;
  documentUrl: string;
  documentMimeType: string;
  fields: SignatureField[];
  onFieldsChange: (fields: SignatureField[]) => void;
}

const FIELD_COLORS = {
  signature: 'bg-blue-200/90 border-blue-500',
  initials: 'bg-green-200/90 border-green-500',
  date: 'bg-yellow-200/90 border-yellow-500',
  text: 'bg-purple-200/90 border-purple-500',
};

const FIELD_ICONS = {
  signature: PenLine,
  initials: Type,
  date: Calendar,
  text: FileText,
};

const FIELD_LABELS = {
  signature: 'Signature',
  initials: 'Initials',
  date: 'Date',
  text: 'Text',
};

export function SignatureFieldEditor({ documentUrl, documentMimeType, fields, onFieldsChange }: SignatureFieldEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageSize, setPageSize] = useState({ width: 600, height: 800 });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedFieldType, setSelectedFieldType] = useState<SignatureField['fieldType']>('signature');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const getDefaultFieldSize = (fieldType: SignatureField['fieldType']) => {
    switch (fieldType) {
      case 'signature':
        return { width: 25, height: 8 };
      case 'initials':
        return { width: 10, height: 5 };
      case 'date':
        return { width: 15, height: 5 };
      case 'text':
        return { width: 30, height: 12 };
      default:
        return { width: 20, height: 6 };
    }
  };

  const addField = () => {
    const size = getDefaultFieldSize(selectedFieldType);
    const newField: SignatureField = {
      id: `field-${Date.now()}`,
      fieldType: selectedFieldType,
      pageNumber: currentPage,
      x: 10,
      y: 10,
      width: size.width,
      height: size.height,
    };
    onFieldsChange([...fields, newField]);
  };

  const updateField = (id: string, updates: Partial<SignatureField>) => {
    onFieldsChange(fields.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const removeField = (id: string) => {
    onFieldsChange(fields.filter(f => f.id !== id));
  };

  const currentPageFields = fields.filter(f => f.pageNumber === currentPage);

  if (documentMimeType !== 'application/pdf') {
    return (
      <div className="flex items-center justify-center h-96 border rounded-lg bg-gray-50">
        <div className="text-center text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>Only PDF documents are supported for signature placement</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Label>Add Field:</Label>
          <Select value={selectedFieldType} onValueChange={(v) => setSelectedFieldType(v as SignatureField['fieldType'])}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="signature">Signature</SelectItem>
              <SelectItem value="initials">Initials</SelectItem>
              <SelectItem value="date">Date</SelectItem>
              <SelectItem value="text">Text</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={addField} data-testid="button-add-visual-field">
            <Plus className="w-4 h-4 mr-1" /> Add to Page
          </Button>
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

        <div className="flex justify-center p-4">
          <div className="relative inline-block shadow-lg">
            <Document
              file={documentUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={null}
            >
              <Page
                pageNumber={currentPage}
                width={600}
                onLoadSuccess={onPageLoadSuccess}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            </Document>

            <div 
              className="absolute inset-0 pointer-events-none"
              style={{ width: pageSize.width, height: pageSize.height }}
            >
              {currentPageFields.map((field) => {
                const Icon = FIELD_ICONS[field.fieldType];
                const fieldWidth = (field.width / 100) * pageSize.width;
                const fieldHeight = Math.max(35, (field.height / 100) * pageSize.height);
                const fieldX = (field.x / 100) * pageSize.width;
                const fieldY = (field.y / 100) * pageSize.height;

                return (
                  <Rnd
                    key={field.id}
                    position={{ x: fieldX, y: fieldY }}
                    size={{ width: fieldWidth, height: fieldHeight }}
                    onDragStop={(_, d) => {
                      updateField(field.id, {
                        x: Math.max(0, Math.min(100, (d.x / pageSize.width) * 100)),
                        y: Math.max(0, Math.min(100, (d.y / pageSize.height) * 100)),
                      });
                    }}
                    onResizeStop={(_, __, ref, ___, position) => {
                      updateField(field.id, {
                        width: (parseInt(ref.style.width) / pageSize.width) * 100,
                        height: (parseInt(ref.style.height) / pageSize.height) * 100,
                        x: (position.x / pageSize.width) * 100,
                        y: (position.y / pageSize.height) * 100,
                      });
                    }}
                    bounds="parent"
                    minWidth={80}
                    minHeight={35}
                    enableResizing={{
                      bottom: true,
                      right: true,
                      bottomRight: true,
                    }}
                    className={`${FIELD_COLORS[field.fieldType]} border-2 rounded cursor-move group shadow-md pointer-events-auto`}
                    style={{ zIndex: 10 }}
                  >
                    <div className="flex items-center justify-between h-full px-2">
                      <div className="flex items-center gap-1 text-xs font-medium">
                        <Icon className="w-4 h-4" />
                        <span>{FIELD_LABELS[field.fieldType]}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeField(field.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-100 rounded"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </Rnd>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Tip:</strong> Click "Add to Page" to add a signature field, then drag it to position on the document. 
          Resize fields by dragging the edges. Use the page navigation for multi-page documents.
        </p>
      </div>

      {fields.length > 0 && (
        <div className="p-3 bg-muted/50 rounded-lg">
          <Label className="text-sm font-medium">All Fields ({fields.length})</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {fields.map((field) => {
              const Icon = FIELD_ICONS[field.fieldType];
              return (
                <div 
                  key={field.id}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${FIELD_COLORS[field.fieldType]}`}
                >
                  <Icon className="w-3 h-3" />
                  <span>{FIELD_LABELS[field.fieldType]} (p.{field.pageNumber})</span>
                  <button onClick={() => removeField(field.id)} className="ml-1 hover:text-red-500">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
