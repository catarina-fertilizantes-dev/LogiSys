import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Camera, Upload, Smartphone, Monitor } from 'lucide-react';
import CameraCapture from './CameraCapture';

interface PhotoCaptureMethodProps {
  onFileSelect: (file: File) => void;
  onCancel: () => void;
  isUploading?: boolean;
  disabled?: boolean;
  accept?: string;
}

export const PhotoCaptureMethod = ({
  onFileSelect,
  onCancel,
  isUploading = false,
  disabled = false,
  accept = "image/*"
}: PhotoCaptureMethodProps) => {
  const [method, setMethod] = useState<'select' | 'camera'>('select');

  // Detectar se é dispositivo móvel
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

  // Verificar suporte à câmera
  const hasCameraSupport = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

  // 🆕 Função para abrir seletor de arquivo diretamente
  const handleFileSelect = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file) {
        onFileSelect(file);
      }
    };
    input.click();
  };

  if (method === 'camera') {
    return (
      <CameraCapture
        onCapture={onFileSelect}
        onCancel={() => setMethod('select')}
        isUploading={isUploading}
        disabled={disabled}
      />
    );
  }

  // Seleção de método
  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="text-center">
            <h3 className="font-semibold mb-2">Como deseja adicionar a foto?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Escolha entre capturar uma nova foto ou selecionar um arquivo
            </p>
            
            {/* �� Informações sobre formatos aceitos */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-xs text-blue-700">
                <strong>Formatos aceitos:</strong> JPG, PNG, WebP (máx. 10MB)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Opção Câmera */}
            {hasCameraSupport && (
              <Button
                variant="outline"
                onClick={() => setMethod('camera')}
                disabled={isUploading || disabled}
                className="h-auto p-4 flex flex-col gap-2"
              >
                <Camera className="h-8 w-8 text-primary" />
                <div className="text-center">
                  <div className="font-medium">Tirar Foto</div>
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    {isMobile ? (
                      <>
                        <Smartphone className="h-3 w-3" />
                        Câmera do celular
                      </>
                    ) : (
                      <>
                        <Monitor className="h-3 w-3" />
                        Webcam
                      </>
                    )}
                  </div>
                </div>
              </Button>
            )}

            {/* 🆕 Opção Upload - vai direto para seletor de arquivo */}
            <Button
              variant="outline"
              onClick={handleFileSelect}
              disabled={isUploading || disabled}
              className="h-auto p-4 flex flex-col gap-2"
            >
              <Upload className="h-8 w-8 text-primary" />
              <div className="text-center">
                <div className="font-medium">Selecionar Arquivo</div>
                <div className="text-xs text-muted-foreground">
                  Escolher da galeria
                </div>
              </div>
            </Button>
          </div>

          <div className="text-center">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onCancel}
              disabled={isUploading}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PhotoCaptureMethod;
