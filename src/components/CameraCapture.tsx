import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { 
  Camera, 
  X, 
  RotateCcw, 
  Check, 
  Upload, 
  AlertCircle,
  Smartphone,
  Monitor
} from 'lucide-react';
import { compressImage, dataURLToBlob } from '@/utils/imageCompression';

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onCancel: () => void;
  isUploading?: boolean;
  disabled?: boolean;
  // 🆕 Nova prop para permitir seleção de arquivo
  allowFileSelection?: boolean;
}

export const CameraCapture = ({ 
  onCapture, 
  onCancel, 
  isUploading = false,
  disabled = false,
  allowFileSelection = true // 🆕 Padrão true
}: CameraCaptureProps) => {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [isStreaming, setIsStreaming] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [hasCamera, setHasCamera] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  // Detectar se é dispositivo móvel
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

  // 🆕 Função para abrir seletor de arquivo
  const handleFileSelect = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file) {
        onCapture(file);
      }
    };
    input.click();
  };

  // Inicializar câmera
  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      
      // Verificar suporte à câmera
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setHasCamera(false);
        setCameraError('Câmera não suportada neste navegador');
        return;
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsStreaming(true);
      }
    } catch (error) {
      console.error('Erro ao acessar câmera:', error);
      setHasCamera(false);
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          setCameraError('Permissão de câmera negada. Verifique as configurações do navegador.');
        } else if (error.name === 'NotFoundError') {
          setCameraError('Nenhuma câmera encontrada no dispositivo.');
        } else {
          setCameraError('Erro ao acessar a câmera. Tente usar o upload de arquivo.');
        }
      }
    }
  }, [facingMode]);

  // Parar câmera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  // Capturar foto
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // Definir dimensões do canvas
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Desenhar frame atual do vídeo
    ctx.drawImage(video, 0, 0);

    // Converter para data URL
    const dataURL = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedImage(dataURL);
    
    // Parar câmera após captura
    stopCamera();
  }, [stopCamera]);

  // Refazer foto
  const retakePhoto = useCallback(() => {
    setCapturedImage(null);
    startCamera();
  }, [startCamera]);

  // Confirmar e processar foto
  const confirmPhoto = useCallback(async () => {
    if (!capturedImage) return;

    try {
      // Converter dataURL para blob
      const blob = dataURLToBlob(capturedImage);
      
      // Comprimir imagem
      const compressedBlob = await compressImage(blob, {
        maxWidth: 1920,
        maxHeight: 1080,
        quality: 0.8,
        format: 'jpeg'
      });

      // Criar arquivo
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `foto-carregamento-${timestamp}.jpg`;
      const file = new File([compressedBlob], fileName, { type: 'image/jpeg' });

      onCapture(file);
    } catch (error) {
      console.error('Erro ao processar foto:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao processar foto',
        description: 'Tente novamente ou use o upload de arquivo.'
      });
    }
  }, [capturedImage, onCapture, toast]);

  // Alternar câmera (frente/traseira)
  const switchCamera = useCallback(() => {
    stopCamera();
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  }, [stopCamera]);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Auto-iniciar câmera
  useEffect(() => {
    if (!disabled && !capturedImage) {
      startCamera();
    }
  }, [startCamera, disabled, capturedImage, facingMode]);

  // Renderizar erro de câmera
  if (!hasCamera || cameraError) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <AlertCircle className="h-12 w-12 text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-amber-800 mb-2">
                Câmera não disponível
              </h3>
              <p className="text-sm text-amber-700 mb-4">
                {cameraError || 'Use o upload de arquivo para anexar uma foto.'}
              </p>
              
              {/* 🆕 Botões de ação quando câmera não funciona */}
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                {allowFileSelection && (
                  <Button 
                    variant="outline" 
                    onClick={handleFileSelect}
                    disabled={isUploading}
                    className="border-amber-300 text-amber-800 hover:bg-amber-100 hover:text-amber-900 hover:border-amber-400"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Selecionar Arquivo
                  </Button>
                )}
                <Button 
                  variant="ghost" 
                  onClick={onCancel}
                  disabled={isUploading}
                  className="text-amber-700 hover:bg-amber-100"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Capturar Foto</h3>
              {isMobile && (
                <Badge variant="secondary" className="text-xs">
                  <Smartphone className="h-3 w-3 mr-1" />
                  Mobile
                </Badge>
              )}
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onCancel}
              disabled={isUploading}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* 🆕 Botão "Selecionar Arquivo" no topo (apenas se permitido) */}
          {allowFileSelection && !capturedImage && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={handleFileSelect}
                disabled={isUploading}
                className="flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                Selecionar Arquivo
              </Button>
            </div>
          )}

          {/* Área de captura */}
          <div className="relative bg-black rounded-lg overflow-hidden">
            {!capturedImage ? (
              // Visualização da câmera
              <div className="relative">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-64 md:h-80 object-cover"
                />
                
                {/* Overlay com controles */}
                {isStreaming && (
                  <div className="absolute inset-0 flex items-end justify-center p-4">
                    <div className="flex items-center gap-4">
                      {/* Alternar câmera (apenas mobile) */}
                      {isMobile && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={switchCamera}
                          disabled={isUploading}
                          className="bg-black/50 hover:bg-black/70 text-white border-white/20"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                      
                      {/* Botão capturar */}
                      <Button
                        onClick={capturePhoto}
                        disabled={isUploading}
                        className="bg-white text-black hover:bg-gray-100 rounded-full w-16 h-16"
                      >
                        <Camera className="h-6 w-6" />
                      </Button>
                    </div>
                  </div>
                )}
                
                {/* Indicador de tipo de câmera */}
                {isStreaming && isMobile && (
                  <div className="absolute top-4 right-4">
                    <Badge variant="secondary" className="text-xs">
                      {facingMode === 'environment' ? 'Traseira' : 'Frontal'}
                    </Badge>
                  </div>
                )}
              </div>
            ) : (
              // Preview da foto capturada
              <div className="relative">
                <img
                  src={capturedImage}
                  alt="Foto capturada"
                  className="w-full h-64 md:h-80 object-cover"
                />
                
                {/* Overlay de confirmação */}
                <div className="absolute inset-0 bg-black/20 flex items-end justify-center p-4">
                  <div className="flex items-center gap-4">
                    <Button
                      variant="secondary"
                      onClick={retakePhoto}
                      disabled={isUploading}
                      className="bg-black/50 hover:bg-black/70 text-white border-white/20"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Refazer
                    </Button>
                    
                    <Button
                      onClick={confirmPhoto}
                      disabled={isUploading}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      {isUploading ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      ) : (
                        <Check className="h-4 w-4 mr-2" />
                      )}
                      Confirmar
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Canvas oculto para captura */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Instruções */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              {!capturedImage ? (
                isMobile ? (
                  <>Posicione o dispositivo e toque no botão para capturar</>
                ) : (
                  <>Posicione a câmera e clique no botão para capturar</>
                )
              ) : (
                <>Revise a foto e confirme para continuar</>
              )}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CameraCapture;
