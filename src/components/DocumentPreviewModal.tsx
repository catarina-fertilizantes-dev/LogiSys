// src/components/DocumentPreviewModal.tsx
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Download, AlertCircle, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DocumentType, DocumentBucket } from "./DocumentViewer";

interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string | null;
  type: DocumentType;
  bucket: DocumentBucket;
  title: string;
}

// Função para formatar XML com indentação básica
const formatXML = (xmlString: string): string => {
  const PADDING = '  '; // 2 espaços para indentação
  const reg = /(>)(<)(\/*)/g;
  let formatted = xmlString.replace(reg, '$1\n$2$3');
  
  let pad = 0;
  return formatted.split('\n').map((line) => {
    let indent = 0;
    if (line.match(/.+<\/\w[^>]*>$/)) {
      indent = 0;
    } else if (line.match(/^<\/\w/) && pad > 0) {
      pad -= 1;
    } else if (line.match(/^<\w[^>]*[^\/]>.*$/)) {
      indent = 1;
    } else {
      indent = 0;
    }
    
    const padding = PADDING.repeat(pad);
    pad += indent;
    return padding + line;
  }).join('\n');
};

export const DocumentPreviewModal = ({
  isOpen,
  onClose,
  url,
  type,
  bucket,
  title
}: DocumentPreviewModalProps) => {
  const { toast } = useToast();
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [xmlContent, setXmlContent] = useState<string | null>(null);

  // Gerar URL assinada quando modal abrir
  useEffect(() => {
    if (isOpen && url) {
      generateSignedUrl();
    } else {
      // Limpar estado quando modal fechar
      setSignedUrl(null);
      setError(null);
      setXmlContent(null);
    }
  }, [isOpen, url]);

  const generateSignedUrl = async () => {
    if (!url) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`🔍 [DEBUG] DocumentPreviewModal - Gerando URL assinada para:`, url);
      
      // Extrair nome do arquivo da URL
      const fileName = url.split('/').pop();
      if (!fileName) {
        throw new Error('Nome do arquivo não encontrado na URL');
      }

      console.log(`🔍 [DEBUG] DocumentPreviewModal - Nome do arquivo:`, fileName);
      console.log(`🔍 [DEBUG] DocumentPreviewModal - Bucket:`, bucket);

      // Gerar URL assinada
      const { data: signedData, error: signedError } = await supabase.storage
        .from(bucket)
        .createSignedUrl(fileName, 3600); // 1 hora

      if (signedError) {
        console.warn(`⚠️ [WARN] DocumentPreviewModal - Erro ao gerar URL assinada, usando URL pública:`, signedError);
        setSignedUrl(url);
      } else {
        console.log(`✅ [SUCCESS] DocumentPreviewModal - URL assinada gerada`);
        setSignedUrl(signedData.signedUrl);
      }

      // Se for XML, buscar conteúdo para preview
      if (type === 'xml' && (signedData?.signedUrl || url)) {
        try {
          const response = await fetch(signedData?.signedUrl || url);
          const xmlText = await response.text();
          const formattedXml = formatXML(xmlText);
          setXmlContent(formattedXml);
        } catch (xmlError) {
          console.warn('⚠️ [WARN] Erro ao buscar conteúdo XML:', xmlError);
          setXmlContent(null);
        }
      }
    } catch (error) {
      console.error(`❌ [ERROR] DocumentPreviewModal - Erro ao gerar URL assinada:`, error);
      setError('Erro ao carregar documento para preview');
      setSignedUrl(url);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      if (signedUrl) {
        window.open(signedUrl, '_blank');
      } else if (url) {
        window.open(url, '_blank');
      }
      
      toast({
        title: "Download iniciado",
        description: `${title} foi aberto em uma nova aba.`
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro no download",
        description: "Não foi possível abrir o documento."
      });
    }
  };

  const renderPreviewContent = () => {
    if (isLoading) {
      return (
        <div className="w-full h-[70vh] flex items-center justify-center border rounded-md bg-muted/30">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">Carregando preview...</p>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="w-full h-[70vh] flex items-center justify-center border rounded-md bg-muted/30">
          <div className="text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <div>
              <p className="font-medium text-destructive">Erro ao carregar preview</p>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
            </div>
            <Button onClick={handleDownload} variant="outline">
              <ExternalLink className="h-4 w-4 mr-2" />
              Abrir em Nova Aba
            </Button>
          </div>
        </div>
      );
    }

    if (!signedUrl) {
      return (
        <div className="w-full h-[70vh] flex items-center justify-center border rounded-md bg-muted/30">
          <div className="text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
            <p className="font-medium">URL não disponível</p>
          </div>
        </div>
      );
    }

    switch (type) {
      case 'pdf':
        return (
          <div className="w-full h-[70vh] border rounded-md overflow-hidden bg-white">
            <iframe
              src={`${signedUrl}#toolbar=1&navpanes=1&scrollbar=1&view=FitH`}
              className="w-full h-full"
              title={title}
              onError={() => {
                console.error('❌ [ERROR] Erro ao carregar PDF no iframe');
                setError('Erro ao carregar PDF. Tente fazer o download.');
              }}
              onLoad={() => {
                console.log('✅ [SUCCESS] PDF carregado no iframe');
              }}
            />
          </div>
        );

      case 'image':
        return (
          <div className="w-full max-h-[70vh] flex items-center justify-center border rounded-md overflow-hidden bg-muted/30">
            <img
              src={signedUrl}
              alt={title}
              className="max-w-full max-h-full object-contain rounded"
              onError={() => {
                console.error('❌ [ERROR] Erro ao carregar imagem');
                setError('Erro ao carregar imagem. Tente fazer o download.');
              }}
              onLoad={() => {
                console.log('✅ [SUCCESS] Imagem carregada');
              }}
            />
          </div>
        );

      case 'xml':
        return (
          <div className="w-full h-[70vh] border rounded-md overflow-hidden bg-white">
            {xmlContent ? (
              <div className="h-full overflow-auto">
                <div className="sticky top-0 bg-gray-100 px-4 py-2 border-b text-sm font-medium text-gray-700">
                  📄 Conteúdo XML - {title}
                </div>
                <div className="p-4">
                  <pre className="text-xs font-mono whitespace-pre-wrap break-words bg-gray-50 p-4 rounded border leading-relaxed">
                    <code 
                      className="language-xml text-gray-800"
                      style={{
                        color: '#374151',
                        lineHeight: '1.6'
                      }}
                    >
                      {xmlContent}
                    </code>
                  </pre>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center bg-muted/30">
                <div className="text-center space-y-4">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
                  <div>
                    <p className="font-medium">Conteúdo XML não disponível</p>
                    <p className="text-sm text-muted-foreground">
                      Não foi possível carregar o conteúdo para preview
                    </p>
                  </div>
                  <Button onClick={handleDownload} className="mt-4">
                    <Download className="h-4 w-4 mr-2" />
                    Baixar XML
                  </Button>
                </div>
              </div>
            )}
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
              <Button onClick={handleDownload} variant="outline">
                <ExternalLink className="h-4 w-4 mr-2" />
                Abrir em Nova Aba
              </Button>
            </div>
          </div>
        );
    }
  };

  if (!url) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{title}</DialogTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Baixar
            </Button>
          </div>
        </DialogHeader>
        
        <div className="mt-4">
          {renderPreviewContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
};
