import { useState, useRef, useEffect } from 'react';
import { Rnd } from 'react-rnd';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { PenLine, Type, Calendar, FileText, Trash2, Plus, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

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
  documentMimeType: string;
  fields: SignatureField[];
  onFieldsChange: (fields: SignatureField[]) => void;
}

const FIELD_COLORS = {
  signature: 'bg-blue-200/80 border-blue-500',
  initials: 'bg-green-200/80 border-green-500',
  date: 'bg-yellow-200/80 border-yellow-500',
  text: 'bg-purple-200/80 border-purple-500',
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

export function SignatureFieldEditor({ documentId, documentMimeType, fields, onFieldsChange }: SignatureFieldEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageImageUrl, setPageImageUrl] = useState<string | null>(null);
  const [selectedFieldType, setSelectedFieldType] = useState<SignatureField['fieldType']>('signature');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPageCount = async () => {
      try {
        const res = await fetch(`/api/documents/${documentId}/page-count`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setTotalPages(data.pageCount || 1);
        }
      } catch (err) {
        console.error('Error fetching page count:', err);
      }
    };
    fetchPageCount();
  }, [documentId]);

  useEffect(() => {
    const loadPageImage = async () => {
      setIsLoading(true);
      setError(null);
      
      if (documentMimeType !== 'application/pdf') {
        setError('Only PDF documents are supported for signature placement');
        setIsLoading(false);
        return;
      }

      try {
        const imageUrl = `/api/documents/${documentId}/pages/${currentPage}/image`;
        const res = await fetch(imageUrl, { credentials: 'include' });
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          setPageImageUrl(url);
        } else {
          setError('Failed to load document page');
        }
      } catch (err) {
        console.error('Error loading page image:', err);
        setError('Error loading document');
      }
      
      setIsLoading(false);
    };

    loadPageImage();

    return () => {
      if (pageImageUrl) {
        URL.revokeObjectURL(pageImageUrl);
      }
    };
  }, [documentId, currentPage, documentMimeType]);

  useEffect(() => {
    const updateContainerSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setContainerSize({ width: rect.width, height: rect.height });
        }
      }
    };
    
    updateContainerSize();
    window.addEventListener('resize', updateContainerSize);
    
    const observer = new ResizeObserver(updateContainerSize);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    
    return () => {
      window.removeEventListener('resize', updateContainerSize);
      observer.disconnect();
    };
  }, [pageImageUrl]);

  const addField = () => {
    const newField: SignatureField = {
      id: `field-${Date.now()}`,
      fieldType: selectedFieldType,
      pageNumber: currentPage,
      x: 10,
      y: 10,
      width: selectedFieldType === 'signature' ? 25 : 15,
      height: selectedFieldType === 'signature' ? 8 : 5,
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
        className="relative border rounded-lg bg-gray-100 overflow-hidden"
        style={{ height: '600px' }}
      >
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
              <p className="text-sm text-muted-foreground">Loading document...</p>
            </div>
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-red-500">
              <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>{error}</p>
            </div>
          </div>
        ) : pageImageUrl ? (
          <div className="relative w-full h-full flex items-center justify-center">
            <div className="relative">
              <img 
                src={pageImageUrl} 
                alt={`Page ${currentPage}`}
                className="max-w-full max-h-full object-contain shadow-lg"
                style={{ maxHeight: '580px' }}
              />
              
              <div className="absolute inset-0">
                {currentPageFields.map((field) => {
                  const Icon = FIELD_ICONS[field.fieldType];
                  const imgWidth = containerRef.current?.querySelector('img')?.clientWidth || containerSize.width;
                  const imgHeight = containerRef.current?.querySelector('img')?.clientHeight || containerSize.height;
                  
                  return (
                    <Rnd
                      key={field.id}
                      position={{
                        x: (field.x / 100) * imgWidth,
                        y: (field.y / 100) * imgHeight,
                      }}
                      size={{
                        width: (field.width / 100) * imgWidth,
                        height: Math.max(35, (field.height / 100) * imgHeight),
                      }}
                      onDragStop={(_, d) => {
                        updateField(field.id, {
                          x: Math.max(0, Math.min(100, (d.x / imgWidth) * 100)),
                          y: Math.max(0, Math.min(100, (d.y / imgHeight) * 100)),
                        });
                      }}
                      onResizeStop={(_, __, ref, ___, position) => {
                        updateField(field.id, {
                          width: (parseInt(ref.style.width) / imgWidth) * 100,
                          height: (parseInt(ref.style.height) / imgHeight) * 100,
                          x: (position.x / imgWidth) * 100,
                          y: (position.y / imgHeight) * 100,
                        });
                      }}
                      bounds="parent"
                      minWidth={80}
                      minHeight={35}
                      className={`${FIELD_COLORS[field.fieldType]} border-2 rounded cursor-move group shadow-md`}
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
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No document loaded</p>
            </div>
          </div>
        )}
      </div>

      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Tip:</strong> Click "Add to Page" to add a signature field, then drag it to position on the document. 
          Use the page navigation to place fields on different pages.
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
