import { Button } from "@/components/ui/button";
import { X, Download, FileText } from "lucide-react";

interface DocumentViewerModalProps {
  document: { src: string; name: string; type: 'image' | 'file' } | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function DocumentViewerModal({ 
  document, 
  isOpen, 
  onClose 
}: DocumentViewerModalProps) {
  if (!isOpen || !document) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleDownload = () => {
    const link = window.document.createElement('a');
    link.href = document.src;
    link.download = document.name;
    link.click();
  };

  const isPdf = document.name.toLowerCase().endsWith('.pdf');
  const isImage = document.type === 'image';

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={handleBackdropClick}
      data-testid="modal-document-viewer"
    >
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-3 text-white">
          <FileText className="h-5 w-5" />
          <span className="font-medium truncate max-w-md">{document.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/20 gap-2"
            onClick={handleDownload}
            data-testid="button-download-document"
          >
            <Download className="h-4 w-4" />
            Download
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20 h-10 w-10"
            onClick={onClose}
            data-testid="button-close-document-viewer"
          >
            <X className="h-6 w-6" />
          </Button>
        </div>
      </div>

      {/* Content Area */}
      <div className="w-full h-full flex items-center justify-center pt-16 pb-4 px-4">
        {isImage ? (
          <img
            src={document.src}
            alt={document.name}
            className="max-w-full max-h-full object-contain"
            data-testid="img-document-viewer"
          />
        ) : isPdf ? (
          <iframe
            src={document.src}
            className="w-full max-w-4xl h-[85vh] bg-white rounded-lg"
            title={document.name}
            data-testid="iframe-pdf-viewer"
          />
        ) : (
          <div className="text-center text-white">
            <FileText className="h-24 w-24 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">{document.name}</p>
            <p className="text-white/70 mb-4">Preview not available for this file type</p>
            <Button onClick={handleDownload} variant="secondary">
              <Download className="h-4 w-4 mr-2" />
              Download File
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
