// src/hooks/useDocuments.ts
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { DocumentBucket } from '@/components/DocumentViewer';

export const useDocuments = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const generateSignedUrl = async (url: string, bucket: DocumentBucket): Promise<string> => {
    try {
      const fileName = url.split('/').pop();
      if (!fileName) {
        throw new Error('Nome do arquivo não encontrado na URL');
      }

      const { data: signedData, error: signedError } = await supabase.storage
        .from(bucket)
        .createSignedUrl(fileName, 3600);

      if (signedError) {
        console.warn('Fallback para URL pública:', signedError);
        return url;
      }

      return signedData.signedUrl;
    } catch (error) {
      console.error('Erro ao gerar URL assinada:', error);
      return url;
    }
  };

  const downloadDocument = async (url: string, bucket: DocumentBucket, title: string) => {
    setIsLoading(true);
    try {
      const signedUrl = await generateSignedUrl(url, bucket);
      window.open(signedUrl, '_blank');
      
      toast({
        title: "Download iniciado",
        description: `${title} será baixado em breve.`
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro no download",
        description: "Não foi possível baixar o documento."
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    generateSignedUrl,
    downloadDocument,
    isLoading
  };
};
