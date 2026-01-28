// src/components/DocumentViewer.tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  FileText, 
  Image as ImageIcon, 
  Download, 
  Loader2
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
  disabled = false
}: DocumentViewerProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

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

  // Função para gerar URL assinada e abrir documento
  const handleOpenDocument = async () => {
    if (disabled) return;
    
    setIsLoading(true);
    try {
      console.log(`🔍 [DEBUG] DocumentViewer - Abrindo ${type}:`, url);
      
      // Extrair nome do arquivo da URL
      const fileName = url.split('/').pop();
      if (!fileName) {
        throw new Error('Nome do arquivo não encontrado na URL');
      }

      console.log(`🔍 [DEBUG] DocumentViewer - Nome do arquivo:`, fileName);
      console.log(`🔍 [DEBUG] DocumentViewer - Bucket:`, bucket);

      // Tentar gerar URL assinada
      const { data: signedData, error: signedError } = await supabase.storage
        .from(bucket)
        .createSignedUrl(fileName, 3600); // 1 hora

      if (signedError) {
        console.warn(`⚠️ [WARN] DocumentViewer - Erro ao gerar URL assinada, usando URL pública:`, signedError);
        // Fallback: usar URL pública direta
        window.open(url, '_blank');
      } else {
        console.log(`✅ [SUCCESS] DocumentViewer - URL assinada gerada`);
        window.open(signedData.signedUrl, '_blank');
      }
      
      toast({
        title: "Documento aberto",
        description: `${title} foi aberto em uma nova aba.`
      });
    } catch (error) {
      console.error(`❌ [ERROR] DocumentViewer - Erro ao abrir documento:`, error);
      toast({
        variant: "destructive",
        title: `Erro ao abrir ${type.toUpperCase()}`,
        description: "Não foi possível acessar o documento. Verifique suas permissões."
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Renderização baseada na variante
  if (variant === 'card') {
    return (
      <div 
        className={`
          p-3 border rounded-md cursor-pointer transition-all
          ${getDocumentColor(type)}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-sm'}
          ${className}
        `}
        onClick={handleOpenDocument}
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
              <Download className="h-3 w-3" />
            )}
          </div>
        </div>
      </div>
    );
  }

  // Variant 'button' (padrão)
  const sizeClasses = {
    sm: 'h-8 px-2 text-xs',
    md: 'h-auto p-3',
    lg: 'h-auto p-4'
  };

  return (
    <Button
      variant="outline"
      size={size === 'sm' ? 'sm' : undefined}
      className={`
        justify-start ${sizeClasses[size]} w-full
        ${getDocumentColor(type)}
        ${className}
      `}
      onClick={handleOpenDocument}
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
        <Download className="h-3 w-3 ml-2" />
      )}
    </Button>
  );
};
