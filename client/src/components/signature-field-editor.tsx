import { useState, useRef, useEffect } from 'react';
import { Rnd } from 'react-rnd';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { PenLine, Type, Calendar, FileText, Trash2, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

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
  documentUrl: string;
  documentMimeType: string;
  fields: SignatureField[];
  onFieldsChange: (fields: SignatureField[]) => void;
}

const FIELD_COLORS = {
  signature: 'bg-blue-100 border-blue-400',
  initials: 'bg-green-100 border-green-400',
  date: 'bg-yellow-100 border-yellow-400',
  text: 'bg-purple-100 border-purple-400',
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
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageImageUrl, setPageImageUrl] = useState<string | null>(null);
  const [selectedFieldType, setSelectedFieldType] = useState<SignatureField['fieldType']>('signature');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadDocument = async () => {
      setIsLoading(true);
      
      if (documentMimeType === 'application/pdf') {
        try {
          const pdf = await pdfjsLib.getDocument(documentUrl).promise;
          setTotalPages(pdf.numPages);
          await renderPdfPage(pdf, currentPage);
        } catch (error) {
          console.error('Error loading PDF:', error);
          setPageImageUrl(null);
        }
      } else if (documentMimeType.startsWith('image/')) {
        setTotalPages(1);
        setPageImageUrl(documentUrl);
      } else {
        setPageImageUrl(null);
      }
      
      setIsLoading(false);
    };

    loadDocument();
  }, [documentUrl, documentMimeType, currentPage]);

  const renderPdfPage = async (pdf: pdfjsLib.PDFDocumentProxy, pageNum: number) => {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.5 });
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;
    
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    await page.render({
      canvasContext: context,
      viewport: viewport,
      canvas: canvas
    } as any).promise;
    
    setPageImageUrl(canvas.toDataURL());
  };

  useEffect(() => {
    const updateContainerSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };
    
    updateContainerSize();
    window.addEventListener('resize', updateContainerSize);
    return () => window.removeEventListener('resize', updateContainerSize);
  }, [pageImageUrl]);

  const addField = () => {
    const newField: SignatureField = {
      id: `field-${Date.now()}`,
      fieldType: selectedFieldType,
      pageNumber: currentPage,
      x: 10,
      y: 10,
      width: selectedFieldType === 'signature' ? 30 : 15,
      height: selectedFieldType === 'signature' ? 10 : 5,
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
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
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        </div>
        
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm">Page {currentPage} of {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
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
        className="relative border rounded-lg bg-gray-100 overflow-hidden"
        style={{ minHeight: '400px' }}
      >
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-muted-foreground">Loading document...</div>
          </div>
        ) : pageImageUrl ? (
          <>
            <img 
              src={pageImageUrl} 
              alt="Document page"
              className="max-w-full h-auto"
              onLoad={(e) => {
                const img = e.target as HTMLImageElement;
                setContainerSize({ width: img.width, height: img.height });
              }}
            />
            {currentPageFields.map((field) => {
              const Icon = FIELD_ICONS[field.fieldType];
              return (
                <Rnd
                  key={field.id}
                  position={{
                    x: (field.x / 100) * containerSize.width,
                    y: (field.y / 100) * containerSize.height,
                  }}
                  size={{
                    width: (field.width / 100) * containerSize.width,
                    height: (field.height / 100) * containerSize.height,
                  }}
                  onDragStop={(_, d) => {
                    updateField(field.id, {
                      x: (d.x / containerSize.width) * 100,
                      y: (d.y / containerSize.height) * 100,
                    });
                  }}
                  onResizeStop={(_, __, ref, ___, position) => {
                    updateField(field.id, {
                      width: (parseInt(ref.style.width) / containerSize.width) * 100,
                      height: (parseInt(ref.style.height) / containerSize.height) * 100,
                      x: (position.x / containerSize.width) * 100,
                      y: (position.y / containerSize.height) * 100,
                    });
                  }}
                  bounds="parent"
                  minWidth={50}
                  minHeight={25}
                  className={`${FIELD_COLORS[field.fieldType]} border-2 rounded cursor-move group`}
                >
                  <div className="flex items-center justify-between h-full px-2">
                    <div className="flex items-center gap-1 text-xs">
                      <Icon className="w-3 h-3" />
                      <span>{FIELD_LABELS[field.fieldType]}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeField(field.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-100 rounded"
                    >
                      <Trash2 className="w-3 h-3 text-red-500" />
                    </button>
                  </div>
                </Rnd>
              );
            })}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
            <div className="text-muted-foreground text-center mb-6">
              <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="font-medium">Word documents can't be previewed</p>
              <p className="text-sm mt-1">Use the controls above to add signature fields. They'll be placed at the bottom of the specified page.</p>
            </div>
            
            {/* Fallback form for non-previewable documents */}
            <div className="w-full max-w-md space-y-3">
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label className="text-xs">Field Type</Label>
                  <Select value={selectedFieldType} onValueChange={(v) => setSelectedFieldType(v as SignatureField['fieldType'])}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="signature">Signature</SelectItem>
                      <SelectItem value="initials">Initials</SelectItem>
                      <SelectItem value="date">Date</SelectItem>
                      <SelectItem value="text">Text</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-20">
                  <Label className="text-xs">Page</Label>
                  <input
                    type="number"
                    min="1"
                    value={currentPage}
                    onChange={(e) => setCurrentPage(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full h-10 px-3 border rounded-md text-sm"
                  />
                </div>
                <Button onClick={addField} data-testid="button-add-fallback-field">
                  <Plus className="w-4 h-4 mr-1" /> Add
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {fields.length > 0 && (
        <div className="p-3 bg-muted/50 rounded-lg">
          <Label className="text-sm font-medium">Fields Added: {fields.length}</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {fields.map((field) => {
              const Icon = FIELD_ICONS[field.fieldType];
              return (
                <div 
                  key={field.id}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${FIELD_COLORS[field.fieldType]}`}
                >
                  <Icon className="w-3 h-3" />
                  <span>{FIELD_LABELS[field.fieldType]} (Page {field.pageNumber})</span>
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
