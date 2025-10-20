import { useEffect, useRef, useState } from 'react';
import { Camera, RotateCcw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTranslation } from 'react-i18next';

interface ScannerProps {
  onCapture?: (imageData: string) => void;
}

export function Scanner({ onCapture }: ScannerProps) {
  const { t } = useTranslation('scan');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [capturedImage, setCapturedImage] = useState<string>('');
  const [isMobile, setIsMobile] = useState(false);

  // Check if device is mobile
  useEffect(() => {
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
  }, []);

  // Initialize camera
  useEffect(() => {
    if (!isMobile) return;

    const initCamera = async () => {
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

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }

        setIsLoading(false);
        setError('');
      } catch (err) {
        console.error('Camera error:', err);
        
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
      }
    };

    initCamera();

    // Cleanup: stop camera when component unmounts
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [isMobile]);

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

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

  const handleRetake = () => {
    setCapturedImage('');
    setIsLoading(true);
    
    // Restart camera
    if (isMobile) {
      navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })
        .then(stream => {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
          }
          setIsLoading(false);
        })
        .catch(err => {
          console.error('Camera restart error:', err);
          setError(t('errors.restartFailed'));
          setIsLoading(false);
        });
    }
  };

  // Show error state
  if (error && !capturedImage) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
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
        <div className="relative w-full bg-black rounded-lg overflow-hidden">
          <img 
            src={capturedImage} 
            alt="Captured product" 
            className="w-full h-auto"
          />
        </div>
        
        <div className="flex gap-4 mt-6 w-full max-w-sm">
          <Button
            onClick={handleRetake}
            variant="outline"
            className="flex-1"
            size="lg"
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
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto p-4">
      <div className="relative w-full bg-black rounded-lg overflow-hidden">
        {/* Video element */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-auto"
          data-testid="video-camera"
        />
        
        {/* Visual overlay to help frame the price tag */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-8 border-4 border-white/50 rounded-lg">
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary -translate-x-1 -translate-y-1"></div>
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary translate-x-1 -translate-y-1"></div>
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary -translate-x-1 translate-y-1"></div>
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary translate-x-1 translate-y-1"></div>
          </div>
          <div className="absolute bottom-4 left-0 right-0 text-center">
            <p className="text-white text-sm bg-black/50 inline-block px-3 py-1 rounded">
              {t('camera.frameGuide')}
            </p>
          </div>
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
  );
}
