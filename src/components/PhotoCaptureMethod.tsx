import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  const [method, setMethod] = useState<'select' | 'camera' | 'upload'>('select');

  // Detectar se é dispositivo móvel
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

  // Verificar suporte à câmera
  const hasCameraSupport = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
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

  if (method === 'upload') {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Upload de Arquivo</h3>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setMethod('select')}
                disabled={isUploading}
              >
                Voltar
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="file-upload">Selecionar arquivo de imagem</Label>
              <Input
                id="file-upload"
                type="file"
                accept={accept}
                onChange={handleFileUpload}
                disabled={isUploading || disabled}
                className="cursor-pointer"
              />
              <p className="text-xs text-muted-foreground">
                Formatos aceitos: JPG, PNG, WebP (máx. 10MB)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Seleção de método
  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="text-center">
            <h3 className="font-semibold mb-2">Como deseja adicionar a foto?</h3>
            <p className="text-sm text-muted-foreground">
              Escolha entre capturar uma nova foto ou fazer upload de um arquivo
            </p>
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

            {/* Opção Upload */}
            <Button
              variant="outline"
              onClick={() => setMethod('upload')}
              disabled={isUploading || disabled}
              className="h-auto p-4 flex flex-col gap-2"
            >
              <Upload className="h-8 w-8 text-primary" />
              <div className="text-center">
                <div className="font-medium">Upload de Arquivo</div>
                <div className="text-xs text-muted-foreground">
                  Selecionar da galeria
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
