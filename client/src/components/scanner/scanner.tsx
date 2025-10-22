import { useEffect, useRef, useState } from 'react';
import { Camera, RotateCcw, AlertCircle, Scan, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTranslation } from 'react-i18next';
import { apiRequest } from '@/lib/queryClient';

interface ScannerProps {
  onCapture?: (imageData: string) => void;
}

export function Scanner({ onCapture }: ScannerProps) {
  const { t, ready, i18n } = useTranslation('scan');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Debug mode: only show detected text when explicitly enabled
  const isDebugMode = import.meta.env.VITE_DEBUG_MODE === 'true';

  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string>('');
  const [isMobile, setIsMobile] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanResult, setScanResult] = useState<{ 
    success: boolean; 
    message: string; 
    text?: string;
    product?: {
      productId: number;
      name: string;
      sku: string;
      rimiUrl: string | null;
      nutriScoreGrade: string | null;
    } | null;
  } | null>(null);

  // Check if device is mobile
  useEffect(() => {
    if (!ready) return;
    
    const checkMobile = () => {
      const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );
      setIsMobile(mobile);
      
      if (!mobile) {
        setError(t('errors.mobileOnly'));
        setIsLoading(false);
      }
    };

    checkMobile();
  }, [t, ready]);

  // Initialize camera
  const startCamera = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError(t('errors.notSupported'));
        setIsLoading(false);
        return;
      }

      // Request camera access with rear-facing preference
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Prefer rear camera
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;

      // Show camera UI immediately after getting stream
      setCameraReady(true);
      setIsLoading(false);

      // Wait a bit for the video element to be rendered
      await new Promise(resolve => setTimeout(resolve, 100));

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setError('');
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError(t('errors.permissionDenied'));
        } else if (err.name === 'NotFoundError') {
          setError(t('errors.notFound'));
        } else {
          setError(t('errors.generic'));
        }
      } else {
        setError(t('errors.generic'));
      }
      
      setIsLoading(false);
      setCameraReady(false);
    }
  };

  // Cleanup: stop camera when component unmounts
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Get actual video stream dimensions
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    
    // Get displayed video element dimensions
    const displayWidth = video.clientWidth;
    const displayHeight = video.clientHeight;
    
    // Calculate scale factors
    const scaleX = videoWidth / displayWidth;
    const scaleY = videoHeight / displayHeight;
    
    // Calculate 16:9 frame dimensions in CSS pixels
    const margin = 32; // 32px margin from edges
    const maxFrameWidth = displayWidth - (margin * 2);
    const maxFrameHeight = displayHeight - (margin * 2);
    
    // Calculate 16:9 aspect ratio frame that fits within available space
    let frameWidth, frameHeight;
    const targetAspect = 16 / 9;
    
    if (maxFrameWidth / maxFrameHeight > targetAspect) {
      // Height is limiting factor
      frameHeight = maxFrameHeight;
      frameWidth = frameHeight * targetAspect;
    } else {
      // Width is limiting factor
      frameWidth = maxFrameWidth;
      frameHeight = frameWidth / targetAspect;
    }
    
    // Calculate frame position (centered)
    const frameX = (displayWidth - frameWidth) / 2;
    const frameY = (displayHeight - frameHeight) / 2;
    
    // Convert to video stream pixels
    const cropX = frameX * scaleX;
    const cropY = frameY * scaleY;
    const cropWidth = frameWidth * scaleX;
    const cropHeight = frameHeight * scaleY;

    // Set canvas to cropped dimensions (16:9)
    canvas.width = cropWidth;
    canvas.height = cropHeight;

    // Draw only the cropped portion of the video frame
    context.drawImage(
      video,
      cropX, cropY, cropWidth, cropHeight,  // source rectangle (from video)
      0, 0, cropWidth, cropHeight            // destination rectangle (on canvas)
    );

    // Convert canvas to data URL
    const imageData = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(imageData);

    // Stop camera stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    // Call optional callback
    if (onCapture) {
      onCapture(imageData);
    }
  };

  const handleRetake = async () => {
    setCapturedImage('');
    setCameraReady(false);
    setScanResult(null);
    
    // Restart camera using the same logic as startCamera
    await startCamera();
  };

  const handleDetect = async () => {
    if (!capturedImage) return;

    setIsProcessing(true);
    setScanResult(null);
    setError('');

    try {
      const response = await apiRequest('POST', '/api/scan', { image: capturedImage });
      const data = await response.json() as { 
        success: boolean; 
        message: string; 
        text?: string;
        product?: any;
      };

      setScanResult({
        success: data.success,
        message: data.message,
        text: data.text,
        product: data.product
      });
    } catch (err) {
      console.error('Error detecting product:', err);
      setError(t('errors.uploadFailed'));
      setScanResult({
        success: false,
        message: t('detect.failure')
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Show loading while translations are loading
  if (!ready) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show error state
  if (error && !capturedImage) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        {isMobile && (
          <Button
            onClick={startCamera}
            size="lg"
            className="mt-4"
            data-testid="button-retry-camera"
          >
            <Camera className="mr-2 h-5 w-5" />
            {t('camera.start')}
          </Button>
        )}
      </div>
    );
  }

  // Show "Start Camera" button if camera not ready
  if (!cameraReady && isMobile && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-4">
        <Button
          onClick={startCamera}
          size="lg"
          data-testid="button-start-camera"
        >
          <Camera className="mr-2 h-5 w-5" />
          {t('camera.start')}
        </Button>
      </div>
    );
  }

  // Show loading state
  if (isLoading && !capturedImage) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="mt-4 text-muted-foreground">{t('camera.loading')}</p>
      </div>
    );
  }

  // Show captured image preview
  if (capturedImage) {
    return (
      <div className="flex flex-col items-center w-full max-w-2xl mx-auto p-4">
        <div className="relative w-full bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
          <img 
            src={capturedImage} 
            alt="Captured product" 
            className="w-full h-full object-cover"
          />
        </div>

        {/* Show result message if available */}
        {scanResult && (
          <div className="mt-4 w-full space-y-3">
            {!scanResult.success && (
              <Alert variant="destructive" className="max-w-full">
                <AlertDescription>{scanResult.message}</AlertDescription>
              </Alert>
            )}
            {scanResult.product && (
              <div className="bg-card border rounded-lg p-4 space-y-2">
                <h3 className="font-semibold text-sm text-primary">Matched Product:</h3>
                <p className="font-medium">{scanResult.product.name}</p>
                {scanResult.product.nutriScoreGrade && (
                  <p className="text-sm text-muted-foreground">
                    Nutri-Score: {scanResult.product.nutriScoreGrade}
                  </p>
                )}
                <a
                  href={`/${i18n.language}/product/${scanResult.product.productId}`}
                  className="inline-flex items-center text-sm text-primary hover:underline mt-2"
                  data-testid="link-view-product"
                >
                  View Product Details <ExternalLink className="ml-1 h-4 w-4" />
                </a>
              </div>
            )}
            {scanResult.text && isDebugMode && (
              <div className="bg-muted p-4 rounded-lg">
                <h3 className="font-semibold mb-2 text-sm">Detected Text:</h3>
                <p className="text-sm whitespace-pre-wrap font-mono">{scanResult.text}</p>
              </div>
            )}
          </div>
        )}

        {/* Show error message if upload failed */}
        {error && !scanResult && (
          <Alert variant="destructive" className="mt-4 max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <div className="flex flex-col gap-3 mt-6 w-full">
          <Button
            onClick={handleDetect}
            className="w-full"
            size="lg"
            disabled={isProcessing}
            data-testid="button-detect"
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                {t('detect.processing')}
              </>
            ) : (
              <>
                <Scan className="mr-2 h-5 w-5" />
                {t('detect.button')}
              </>
            )}
          </Button>
          <Button
            onClick={handleRetake}
            variant="outline"
            className="w-full"
            size="lg"
            disabled={isProcessing}
            data-testid="button-retake"
          >
            <RotateCcw className="mr-2 h-5 w-5" />
            {t('camera.retake')}
          </Button>
        </div>
      </div>
    );
  }

  // Show camera view
  return (
    <div className="flex flex-col items-center w-full h-full">
      <div className="relative w-full max-w-2xl mx-auto flex flex-col items-center justify-center px-4 py-2" style={{ minHeight: '60vh' }}>
        <div className="relative w-full bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
          {/* Video element */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            data-testid="video-camera"
            onLoadedMetadata={() => console.log('Video metadata loaded')}
            onCanPlay={() => console.log('Video can play')}
            onPlaying={() => console.log('Video is playing')}
          />
          
          {/* Visual overlay to help frame the price tag - 16:9 horizontal rectangle */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
            <div className="relative border-4 border-white/50 rounded-lg" style={{ aspectRatio: '16/9', width: '100%', maxWidth: 'calc(100% - 64px)', maxHeight: 'calc(100% - 64px)' }}>
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary -translate-x-1 -translate-y-1"></div>
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary translate-x-1 -translate-y-1"></div>
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary -translate-x-1 translate-y-1"></div>
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary translate-x-1 translate-y-1"></div>
            </div>
          </div>
          <div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none">
            <p className="text-white text-sm bg-black/50 inline-block px-3 py-1 rounded">
              {t('camera.frameGuide')}
            </p>
          </div>
          
          {/* Hidden canvas for capturing */}
          <canvas ref={canvasRef} className="hidden" />
        </div>
        
        {/* Capture button */}
        <div className="mt-6 w-full max-w-sm">
          <Button
            onClick={handleCapture}
            size="lg"
            className="w-full"
            data-testid="button-capture"
          >
            <Camera className="mr-2 h-5 w-5" />
            {t('camera.capture')}
          </Button>
        </div>
      </div>
    </div>
  );
}
