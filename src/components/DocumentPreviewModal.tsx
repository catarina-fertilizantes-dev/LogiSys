// src/components/DocumentPreviewModal.tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Download, AlertCircle, X } from "lucide-react";
import { DocumentType } from "./DocumentViewer";

interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string | null;
  type: DocumentType;
  title: string;
}

export const DocumentPreviewModal = ({
  isOpen,
  onClose,
  url,
  type,
  title
}: DocumentPreviewModalProps) => {
  if (!url) return null;

  const handleDownload = () => {
    window.open(url, '_blank');
  };

  const renderPreviewContent = () => {
    switch (type) {
      case 'pdf':
        return (
          <div className="w-full h-[70vh] border rounded-md overflow-hidden">
            <iframe
              src={`${url}#toolbar=1&navpanes=1&scrollbar=1`}
              className="w-full h-full"
              title={title}
              onError={() => {
                console.error('❌ [ERROR] Erro ao carregar PDF no iframe');
              }}
            />
          </div>
        );

      case 'image':
        return (
          <div className="w-full max-h-[70vh] flex items-center justify-center border rounded-md overflow-hidden bg-muted/30">
            <img
              src={url}
              alt={title}
              className="max-w-full max-h-full object-contain"
              onError={(e) => {
                console.error('❌ [ERROR] Erro ao carregar imagem');
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        );

      case 'xml':
        return (
          <div className="w-full h-[70vh] border rounded-md overflow-hidden bg-muted/30 flex items-center justify-center">
            <div className="text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
              <div>
                <p className="font-medium">Preview não disponível para XML</p>
                <p className="text-sm text-muted-foreground">
                  Clique em "Baixar" para visualizar o arquivo
                </p>
              </div>
              <Button onClick={handleDownload} className="mt-4">
                <Download className="h-4 w-4 mr-2" />
                Baixar XML
              </Button>
            </div>
          </div>
        );

      default:
        return (
          <div className="w-full h-[70vh] border rounded-md overflow-hidden bg-muted/30 flex items-center justify-center">
            <div className="text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
              <div>
                <p className="font-medium">Preview não disponível</p>
                <p className="text-sm text-muted-foreground">
                  Tipo de arquivo não suportado para preview
                </p>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <span>{title}</span>
              <span className="text-xs bg-muted px-2 py-1 rounded uppercase">
                {type}
              </span>
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
              >
                <Download className="h-4 w-4 mr-2" />
                Baixar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <div className="mt-4">
          {renderPreviewContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
};
