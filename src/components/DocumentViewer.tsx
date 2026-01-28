// src/components/DocumentViewer.tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  FileText, 
  Image as ImageIcon, 
  Download, 
  Eye, 
  AlertCircle,
  Loader2,
  X
} from "lucide-react";

export type DocumentType = 'pdf' | 'xml' | 'image';
export type DocumentBucket = 'carregamento-fotos' | 'carregamento-documentos' | 'estoque-documentos';

export interface DocumentViewerProps {
  url: string | null;
  type: DocumentType;
  bucket: DocumentBucket;
  title: string;
  description?: string;
  variant?: 'button' | 'card' | 'inline';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showPreview?: boolean;
  disabled?: boolean;
}

const getDocumentIcon = (type: DocumentType) => {
  switch (type) {
    case 'pdf':
      return <FileText className="h-4 w-4 text-red-600" />;
    case 'xml':
      return <FileText className="h-4 w-4 text-blue-600" />;
    case 'image':
      return <ImageIcon className="h-4 w-4 text-green-600" />;
    default:
      return <FileText className="h-4 w-4 text-gray-600" />;
  }
};

const getDocumentColor = (type: DocumentType) => {
  switch (type) {
    case 'pdf':
      return 'border-red-200 hover:border-red-300 hover:bg-red-50';
    case 'xml':
      return 'border-blue-200 hover:border-blue-300 hover:bg-blue-50';
    case 'image':
      return 'border-green-200 hover:border-green-300 hover:bg-green-50';
    default:
      return 'border-gray-200 hover:border-gray-300 hover:bg-gray-50';
  }
};

export const DocumentViewer = ({
  url,
  type,
  bucket,
  title,
  description,
  variant = 'button',
  size = 'md',
  className = '',
  showPreview = true,
  disabled = false
}: DocumentViewerProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Verificar se documento existe
  if (!url) {
    return (
      <div className={`p-3 border border-dashed rounded-md text-center ${className}`}>
        <div className="flex flex-col items-center gap-1">
          {getDocumentIcon(type)}
          <div className="text-xs text-muted-foreground">{title}</div>
          <div className="text-xs text-muted-foreground">Não disponível</div>
        </div>
      </div>
    );
  }

  // Função para gerar URL assinada
  const generateSignedUrl = async (): Promise<string> => {
    try {
      console.log(`🔍 [DEBUG] DocumentViewer - Gerando URL assinada para ${type}:`, url);
      
      // Extrair nome do arquivo da URL
      const fileName = url.split('/').pop();
      if (!fileName) {
        throw new Error('Nome do arquivo não encontrado na URL');
      }

      console.log(`🔍 [DEBUG] DocumentViewer - Nome do arquivo extraído:`, fileName);
      console.log(`🔍 [DEBUG] DocumentViewer - Bucket:`, bucket);

      // Tentar gerar URL assinada
      const { data: signedData, error: signedError } = await supabase.storage
        .from(bucket)
        .createSignedUrl(fileName, 3600); // 1 hora

      if (signedError) {
        console.error(`❌ [ERROR] DocumentViewer - Erro ao gerar URL assinada:`, signedError);
        
        // Fallback: tentar URL pública direta
        console.log(`🔍 [DEBUG] DocumentViewer - Tentando URL pública direta`);
        return url;
      }

      console.log(`✅ [SUCCESS] DocumentViewer - URL assinada gerada:`, signedData.signedUrl);
      return signedData.signedUrl;
    } catch (error) {
      console.error(`❌ [ERROR] DocumentViewer - Erro inesperado:`, error);
      // Fallback: retornar URL original
      return url;
    }
  };

  // Função para download direto
  const handleDownload = async () => {
    if (disabled) return;
    
    setIsLoading(true);
    try {
      const signedUrl = await generateSignedUrl();
      
      // Abrir em nova aba para download
      window.open(signedUrl, '_blank');
      
      toast({
        title: "Download iniciado",
        description: `${title} será baixado em breve.`
      });
    } catch (error) {
      console.error(`❌ [ERROR] DocumentViewer - Erro no download:`, error);
      toast({
        variant: "destructive",
        title: `Erro ao baixar ${type.toUpperCase()}`,
        description: "Não foi possível acessar o documento. Verifique suas permissões."
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Função para preview
  const handlePreview = async () => {
    if (disabled || !showPreview) {
      handleDownload();
      return;
    }

    setIsLoading(true);
    try {
      const signedUrl = await generateSignedUrl();
      setPreviewUrl(signedUrl);
      setPreviewOpen(true);
    } catch (error) {
      console.error(`❌ [ERROR] DocumentViewer - Erro no preview:`, error);
      toast({
        variant: "destructive",
        title: `Erro ao visualizar ${type.toUpperCase()}`,
        description: "Não foi possível carregar o preview. Tentando download direto."
      });
      // Fallback para download
      handleDownload();
    } finally {
      setIsLoading(false);
    }
  };

  // Renderização baseada na variante
  if (variant === 'card') {
    return (
      <>
        <div 
          className={`
            p-3 border rounded-md cursor-pointer transition-all
            ${getDocumentColor(type)}
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-sm'}
            ${className}
          `}
          onClick={handlePreview}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getDocumentIcon(type)}
              <div>
                <div className="text-sm font-medium">{title}</div>
                {description && (
                  <div className="text-xs text-muted-foreground">{description}</div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  {showPreview && type !== 'xml' && (
                    <Eye className="h-3 w-3" />
                  )}
                  <Download className="h-3 w-3" />
                </>
              )}
            </div>
          </div>
        </div>

        {/* Modal de Preview */}
        <DocumentPreviewModal
          isOpen={previewOpen}
          onClose={() => {
            setPreviewOpen(false);
            setPreviewUrl(null);
          }}
          url={previewUrl}
          type={type}
          title={title}
        />
      </>
    );
  }

  if (variant === 'inline') {
    return (
      <>
        <Badge 
          variant="secondary" 
          className={`cursor-pointer hover:bg-secondary/80 ${className}`}
          onClick={handlePreview}
        >
          {isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : (
            <>
              {getDocumentIcon(type)}
              <span className="ml-1">{title}</span>
            </>
          )}
        </Badge>

        {/* Modal de Preview */}
        <DocumentPreviewModal
          isOpen={previewOpen}
          onClose={() => {
            setPreviewOpen(false);
            setPreviewUrl(null);
          }}
          url={previewUrl}
          type={type}
          title={title}
        />
      </>
    );
  }

  // Variant 'button' (padrão)
  const sizeClasses = {
    sm: 'h-8 px-2 text-xs',
    md: 'h-auto p-3',
    lg: 'h-auto p-4'
  };

  return (
    <>
      <Button
        variant="outline"
        size={size === 'sm' ? 'sm' : undefined}
        className={`
          justify-start ${sizeClasses[size]} w-full
          ${getDocumentColor(type)}
          ${className}
        `}
        onClick={handlePreview}
        disabled={disabled || isLoading}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          getDocumentIcon(type)
        )}
        <div className="text-left flex-1 ml-2">
          <div className="text-sm font-medium">{title}</div>
          {description && size !== 'sm' && (
            <div className="text-xs text-muted-foreground">{description}</div>
          )}
        </div>
        {!isLoading && (
          <div className="flex items-center gap-1 ml-2">
            {showPreview && type !== 'xml' && (
              <Eye className="h-3 w-3" />
            )}
            <Download className="h-3 w-3" />
          </div>
        )}
      </Button>

      {/* Modal de Preview */}
      <DocumentPreviewModal
        isOpen={previewOpen}
        onClose={() => {
          setPreviewOpen(false);
          setPreviewUrl(null);
        }}
        url={previewUrl}
        type={type}
        title={title}
      />
    </>
  );
};
