import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download } from "lucide-react";

interface ImageViewerModalProps {
  images: { src: string; title?: string; description?: string }[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
}

export default function ImageViewerModal({ 
  images, 
  initialIndex = 0, 
  isOpen, 
  onClose 
}: ImageViewerModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    setCurrentIndex(initialIndex);
    setScale(1);
  }, [initialIndex, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft") {
        goToPrevious();
      } else if (e.key === "ArrowRight") {
        goToNext();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, currentIndex, images.length]);

  const goToNext = useCallback(() => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setScale(1);
    }
  }, [currentIndex, images.length]);

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setScale(1);
    }
  }, [currentIndex]);

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen || images.length === 0) return null;

  const currentImage = images[currentIndex];
  const hasMultipleImages = images.length > 1;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={handleBackdropClick}
      data-testid="modal-image-viewer"
    >
      {/* Close Button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 z-10 text-white hover:bg-white/20 h-10 w-10"
        onClick={onClose}
        data-testid="button-close-viewer"
      >
        <X className="h-6 w-6" />
      </Button>

      {/* Previous Button */}
      {hasMultipleImages && currentIndex > 0 && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20 h-12 w-12"
          onClick={goToPrevious}
          data-testid="button-previous-image"
        >
          <ChevronLeft className="h-8 w-8" />
        </Button>
      )}

      {/* Next Button */}
      {hasMultipleImages && currentIndex < images.length - 1 && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20 h-12 w-12"
          onClick={goToNext}
          data-testid="button-next-image"
        >
          <ChevronRight className="h-8 w-8" />
        </Button>
      )}

      {/* Image Container */}
      <div className="relative max-w-[90vw] max-h-[80vh] flex items-center justify-center">
        <img
          src={currentImage.src}
          alt={currentImage.title || "Image"}
          className="max-w-full max-h-[80vh] object-contain transition-transform duration-200"
          style={{ transform: `scale(${scale})` }}
          data-testid="img-viewer-current"
        />
      </div>

      {/* Bottom Info Bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          {/* Image Info */}
          <div className="text-white">
            {currentImage.title && (
              <h3 className="font-semibold text-lg" data-testid="text-viewer-title">
                {currentImage.title}
              </h3>
            )}
            {currentImage.description && (
              <p className="text-white/70 text-sm" data-testid="text-viewer-description">
                {currentImage.description}
              </p>
            )}
            <p className="text-white/50 text-sm mt-1" data-testid="text-viewer-counter">
              {currentIndex + 1} of {images.length}
            </p>
          </div>

          {/* Zoom Controls & Download */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={handleZoomOut}
              disabled={scale <= 0.5}
              data-testid="button-zoom-out"
            >
              <ZoomOut className="h-5 w-5" />
            </Button>
            <span className="text-white text-sm min-w-[4rem] text-center" data-testid="text-zoom-level">
              {Math.round(scale * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={handleZoomIn}
              disabled={scale >= 3}
              data-testid="button-zoom-in"
            >
              <ZoomIn className="h-5 w-5" />
            </Button>
            <div className="w-px h-6 bg-white/30 mx-2" />
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/20 gap-2"
              onClick={() => {
                const link = document.createElement('a');
                link.href = currentImage.src;
                link.download = currentImage.title || 'image';
                link.click();
              }}
              data-testid="button-download-image"
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
          </div>
        </div>
      </div>

      {/* Image Thumbnails (for multiple images) */}
      {hasMultipleImages && images.length <= 10 && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex gap-2">
          {images.map((img, index) => (
            <button
              key={index}
              className={`w-12 h-12 rounded border-2 overflow-hidden transition-all ${
                index === currentIndex 
                  ? 'border-white opacity-100' 
                  : 'border-transparent opacity-50 hover:opacity-75'
              }`}
              onClick={() => {
                setCurrentIndex(index);
                setScale(1);
              }}
              data-testid={`button-thumbnail-${index}`}
            >
              <img
                src={img.src}
                alt={`Thumbnail ${index + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
