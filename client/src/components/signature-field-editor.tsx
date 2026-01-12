import { useState, useRef, useEffect } from 'react';
import { Rnd } from 'react-rnd';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { PenLine, Type, Calendar, FileText, Trash2, Plus } from 'lucide-react';

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
  onDocumentConverted?: (pdfUrl: string) => void;
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
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
  const [selectedFieldType, setSelectedFieldType] = useState<SignatureField['fieldType']>('signature');

  useEffect(() => {
    const updateContainerSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width || 800, height: rect.height || 600 });
      }
    };
    
    updateContainerSize();
    window.addEventListener('resize', updateContainerSize);
    return () => window.removeEventListener('resize', updateContainerSize);
  }, []);

  const addField = () => {
    const newField: SignatureField = {
      id: `field-${Date.now()}`,
      fieldType: selectedFieldType,
      pageNumber: 1,
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
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="border rounded-lg overflow-hidden bg-gray-100" style={{ height: '500px' }}>
          {documentMimeType === 'application/pdf' ? (
            <iframe 
              src={documentUrl}
              className="w-full h-full border-0"
              title="Document Preview"
            />
          ) : documentMimeType.startsWith('image/') ? (
            <img 
              src={documentUrl} 
              alt="Document preview"
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Document preview not available</p>
              </div>
            </div>
          )}
        </div>

        <div 
          ref={containerRef}
          className="relative border rounded-lg bg-white overflow-hidden"
          style={{ height: '500px' }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-gray-100">
            <div className="p-4 border-b bg-white/80">
              <p className="text-sm font-medium text-gray-700">Signature Field Placement</p>
              <p className="text-xs text-muted-foreground">Drag fields to position them on the document</p>
            </div>
            
            <div className="relative" style={{ height: 'calc(100% - 60px)' }}>
              {fields.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                  <div className="text-center p-4">
                    <PenLine className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Add signature fields using the controls above</p>
                    <p className="text-xs mt-1">Fields will appear here for positioning</p>
                  </div>
                </div>
              ) : (
                fields.map((field) => {
                  const Icon = FIELD_ICONS[field.fieldType];
                  return (
                    <Rnd
                      key={field.id}
                      default={{
                        x: (field.x / 100) * (containerSize.width - 32),
                        y: (field.y / 100) * (containerSize.height - 100),
                        width: (field.width / 100) * (containerSize.width - 32),
                        height: Math.max(40, (field.height / 100) * (containerSize.height - 100)),
                      }}
                      onDragStop={(_, d) => {
                        const maxWidth = containerSize.width - 32;
                        const maxHeight = containerSize.height - 100;
                        updateField(field.id, {
                          x: Math.max(0, Math.min(100, (d.x / maxWidth) * 100)),
                          y: Math.max(0, Math.min(100, (d.y / maxHeight) * 100)),
                        });
                      }}
                      onResizeStop={(_, __, ref, ___, position) => {
                        const maxWidth = containerSize.width - 32;
                        const maxHeight = containerSize.height - 100;
                        updateField(field.id, {
                          width: (parseInt(ref.style.width) / maxWidth) * 100,
                          height: (parseInt(ref.style.height) / maxHeight) * 100,
                          x: (position.x / maxWidth) * 100,
                          y: (position.y / maxHeight) * 100,
                        });
                      }}
                      bounds="parent"
                      minWidth={80}
                      minHeight={35}
                      className={`${FIELD_COLORS[field.fieldType]} border-2 rounded cursor-move group shadow-sm`}
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
                })
              )}
            </div>
          </div>
        </div>
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
                  <span>{FIELD_LABELS[field.fieldType]}</span>
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
