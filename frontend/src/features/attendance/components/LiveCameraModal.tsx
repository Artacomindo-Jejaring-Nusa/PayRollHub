import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import {
  Camera,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  SwitchCamera,
  Sparkles,
  ShieldCheck,
  Lock,
} from 'lucide-react';

interface LiveCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File, previewUrl: string) => void;
  title?: string;
  description?: string;
  defaultFacingMode?: 'user' | 'environment';
  showFaceGuide?: boolean;
}

export const LiveCameraModal: React.FC<LiveCameraModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  title = 'Ambil Foto Selfie Kehadiran',
  description = 'Posisikan wajah Anda tepat di dalam lingkaran pemandu untuk absensi langsung.',
  defaultFacingMode = 'user',
  showFaceGuide = true,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>(defaultFacingMode);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [hasMultipleCameras, setHasMultipleCameras] = useState<boolean>(false);
  const [isFlashing, setIsFlashing] = useState<boolean>(false);

  // Stop camera tracks cleanly
  const stopStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      setStream(null);
    }
  }, [stream]);

  // Check available video devices
  useEffect(() => {
    if (!isOpen) return;
    if (navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => {
          const videoDevices = devices.filter((d) => d.kind === 'videoinput');
          setHasMultipleCameras(videoDevices.length > 1);
        })
        .catch(() => {
          setHasMultipleCameras(false);
        });
    }
  }, [isOpen]);

  // Start live camera stream
  const startCamera = useCallback(
    async (mode: 'user' | 'environment') => {
      setIsInitializing(true);
      setCameraError(null);

      // Stop previous stream first
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }

      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Browser Anda tidak mendukung akses live kamera (getUserMedia). Pastikan Anda membuka situs ini melalui koneksi HTTPS yang aman.');
        }

        let mediaStream: MediaStream;
        try {
          // Tahap 1: Coba resolusi ideal HD
          mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              facingMode: { ideal: mode },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          });
        } catch (firstErr) {
          console.warn('HD camera constraint failed, attempting fallback to standard video:', firstErr);
          try {
            // Tahap 2: Coba dengan facingMode saja tanpa batasan resolusi
            mediaStream = await navigator.mediaDevices.getUserMedia({
              audio: false,
              video: { facingMode: mode },
            });
          } catch (secondErr) {
            console.warn('FacingMode camera constraint failed, attempting default video:', secondErr);
            // Tahap 3: Coba default video paling fleksibel (misal webcam eksternal PC)
            mediaStream = await navigator.mediaDevices.getUserMedia({
              audio: false,
              video: true,
            });
          }
        }

        setStream(mediaStream);

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(() => {});
        }
      } catch (err: any) {
        console.error('Camera access error:', err);
        let errorMsg = 'Gagal mengakses kamera perangkat.';
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          errorMsg =
            'Izin kamera ditolak. Silakan klik ikon gembok di bilah alamat browser Anda dan ubah izin kamera menjadi "Izinkan" (Allow).';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          errorMsg = 'Perangkat kamera / webcam tidak ditemukan di laptop atau komputer Anda.';
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          errorMsg = 'Kamera sedang digunakan oleh aplikasi lain (misal Zoom atau browser lain).';
        } else if (err.message) {
          errorMsg = err.message;
        }
        setCameraError(errorMsg);
      } finally {
        setIsInitializing(false);
      }
    },
    [stream]
  );

  // Initialize camera when modal opens
  useEffect(() => {
    if (isOpen) {
      setCapturedBlob(null);
      setCapturedPreview(null);
      startCamera(facingMode);
    } else {
      stopStream();
      if (capturedPreview && capturedPreview.startsWith('blob:')) {
        URL.revokeObjectURL(capturedPreview);
      }
      setCapturedPreview(null);
      setCapturedBlob(null);
    }
    return () => {
      stopStream();
    };
  }, [isOpen]);

  // Attach stream to video ref if changed
  useEffect(() => {
    if (videoRef.current && stream && !capturedPreview) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream, capturedPreview]);

  // Toggle Front / Back Camera
  const handleToggleCamera = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // Shutter Snap
  const handleSnap = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    // Visual Flash Effect
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 200);

    // Kompresi sisi klien: Batasi resolusi maksimal 640px (sangat tajam untuk selfie tapi hemat storage ~40-60 KB)
    let targetWidth = video.videoWidth;
    let targetHeight = video.videoHeight;
    const maxDim = 640;
    if (targetWidth > maxDim || targetHeight > maxDim) {
      if (targetWidth >= targetHeight) {
        targetHeight = Math.round((targetHeight / targetWidth) * maxDim);
        targetWidth = maxDim;
      } else {
        targetWidth = Math.round((targetWidth / targetHeight) * maxDim);
        targetHeight = maxDim;
      }
    }

    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Mirror horizontally if using front/user camera for natural selfie orientation
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setCapturedBlob(blob);
        const previewUrl = URL.createObjectURL(blob);
        setCapturedPreview(previewUrl);
        // Pause video while previewing
        video.pause();
      },
      'image/jpeg',
      0.72 // Kualitas 72% -> menghasilkan file ukuran ~40-60 KB
    );
  };

  // Retake photo
  const handleRetake = () => {
    if (capturedPreview && capturedPreview.startsWith('blob:')) {
      URL.revokeObjectURL(capturedPreview);
    }
    setCapturedPreview(null);
    setCapturedBlob(null);
    if (videoRef.current && stream) {
      videoRef.current.play().catch(() => {});
    } else {
      startCamera(facingMode);
    }
  };

  // Confirm photo and submit to parent
  const handleConfirm = () => {
    if (!capturedBlob || !capturedPreview) return;
    const filename = `selfie_live_${Date.now()}.jpg`;
    const file = new File([capturedBlob], filename, { type: 'image/jpeg' });
    stopStream();
    onCapture(file, capturedPreview);
    onClose();
  };

  const handleCloseModal = () => {
    stopStream();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCloseModal}
      title={title}
      maxWidth="lg"
    >
      <div className="space-y-3 sm:space-y-4">
        {/* Petunjuk Penggunaan & Live Sensor Badge */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="p-2 sm:p-2.5 rounded-xl bg-amber-50/90 border border-amber-200/90 text-amber-900 text-[11.5px] sm:text-xs flex items-center gap-2 flex-1">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Arahkan wajah ke lingkaran hijau, lalu <strong>tekan tombol kamera di bawah</strong> untuk mengambil foto.
            </span>
          </div>
          <div className="flex items-center gap-1.5 self-start sm:self-auto shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Live Sensor
            </span>
          </div>
        </div>

        {/* Viewfinder Area (Tinggi fleksibel adaptif untuk layar HP) */}
        <div className="relative w-full h-[45vh] sm:h-[380px] max-h-[380px] min-h-[220px] bg-slate-950 rounded-2xl overflow-hidden shadow-inner border border-slate-800 flex items-center justify-center">
          {/* Hidden Canvas for capture processing */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Flash Effect Overlay */}
          {isFlashing && (
            <div className="absolute inset-0 bg-white z-30 transition-opacity duration-150 pointer-events-none opacity-90" />
          )}

          {/* Error State */}
          {cameraError ? (
            <div className="p-6 text-center text-rose-200 max-w-md mx-auto space-y-3 z-10">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/30">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="font-semibold text-sm text-white">Kamera Tidak Dapat Dibuka</div>
                <div className="text-xs text-rose-300/90 leading-relaxed">{cameraError}</div>
              </div>
              <div className="pt-2 flex flex-col items-center justify-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => startCamera(facingMode)}
                  className="w-full sm:w-auto text-xs bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1" /> Coba Sambungkan Kamera Lagi
                </Button>
                <div className="text-[11.5px] text-rose-300/80 flex items-center gap-1.5 mt-1">
                  <Lock className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                  <span>Sistem mewajibkan foto kamera langsung (upload galeri/file dilarang)</span>
                </div>
              </div>
            </div>
          ) : isInitializing ? (
            <div className="flex flex-col items-center justify-center gap-2 text-slate-400 text-xs z-10">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              <span>Menghubungkan ke sensor kamera...</span>
            </div>
          ) : capturedPreview ? (
            /* Result Preview Screen */
            <div className="relative w-full h-full flex items-center justify-center bg-black">
              <img
                src={capturedPreview}
                alt="Hasil Foto Live"
                className="w-full h-full object-cover"
              />
              <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-700 text-[11px] font-semibold text-emerald-400 flex items-center gap-1.5 shadow-md">
                <CheckCircle2 className="w-3.5 h-3.5" /> Foto Berhasil Ditangkap
              </div>
            </div>
          ) : (
            /* Live Camera Stream View */
            <div className="relative w-full h-full">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${
                  facingMode === 'user' ? 'scale-x-[-1]' : ''
                }`}
              />

              {/* Face Guide Oval Overlay (for selfie attendance) */}
              {showFaceGuide && facingMode === 'user' && (
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                  <div className="w-36 h-48 sm:w-48 sm:h-60 rounded-[50%] border-2 border-dashed border-emerald-400/80 shadow-[0_0_20px_rgba(16,185,129,0.25)] flex items-center justify-center">
                    <div className="w-3 h-3 rounded-full bg-emerald-400/40 animate-ping"></div>
                  </div>
                  <span className="mt-2 text-[10px] sm:text-[10.5px] font-medium text-white/90 bg-slate-950/70 backdrop-blur-xs px-2.5 py-0.5 rounded-full border border-white/10">
                    Posisikan wajah di dalam garis oval
                  </span>
                </div>
              )}

              {/* Switch Camera Button (if device has front & back camera) */}
              {hasMultipleCameras && (
                <button
                  type="button"
                  onClick={handleToggleCamera}
                  className="absolute top-2.5 right-2.5 p-2 rounded-xl bg-slate-900/80 backdrop-blur-md text-white hover:bg-slate-800 border border-slate-700 transition-colors shadow-md cursor-pointer group z-20"
                  title="Putar Kamera (Depan / Belakang)"
                >
                  <SwitchCamera className="w-4 h-4 group-hover:rotate-180 transition-transform duration-300" />
                </button>
              )}

              {/* Mode indicator */}
              <div className="absolute top-2.5 left-2.5 bg-slate-900/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-700 text-[10.5px] font-medium text-slate-200 flex items-center gap-1.5 z-20">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                <span>{facingMode === 'user' ? 'Kamera Depan (Selfie)' : 'Kamera Belakang'}</span>
              </div>

              {/* FLOATING CIRCULAR SHUTTER BUTTON INSIDE VIEWFINDER (Pasti terlihat di semua layar HP!) */}
              <div className="absolute bottom-2.5 inset-x-0 flex flex-col items-center justify-center gap-1 z-20 pointer-events-auto">
                <button
                  type="button"
                  onClick={handleSnap}
                  className="w-13 h-13 sm:w-15 sm:h-15 rounded-full bg-white hover:bg-emerald-50 active:scale-95 border-4 border-emerald-500 shadow-2xl flex items-center justify-center transition-all cursor-pointer group ring-4 ring-emerald-400/30"
                  title="Klik untuk mengambil foto selfie"
                >
                  <Camera className="w-6 h-6 text-emerald-600 group-hover:scale-110 transition-transform" />
                </button>
                <span className="text-[10px] sm:text-[11px] font-bold text-white bg-slate-950/85 backdrop-blur-xs px-2.5 py-0.5 rounded-full border border-white/20 shadow-md">
                  📸 Tekan Untuk Jepret Foto
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Control Footer */}
        <div className="pt-1 flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3">
          {/* Security Badge */}
          <div className="order-2 sm:order-1 text-[11px] text-text-muted flex items-center gap-1.5 font-medium">
            <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Kamera Live Depan Wajib • Dilarang Upload Galeri</span>
          </div>

          {/* Action Buttons */}
          <div className="order-1 sm:order-2 w-full sm:w-auto flex items-center justify-end gap-2">
            {capturedPreview ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleRetake}
                  className="flex-1 sm:flex-initial px-4 py-2.5 text-xs font-semibold h-auto min-h-10 whitespace-nowrap cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5 shrink-0" /> Ambil Ulang
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirm}
                  className="flex-1 sm:flex-initial px-4 py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white h-auto min-h-10 whitespace-nowrap shadow-md cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 shrink-0" /> Gunakan Foto Ini
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseModal}
                  className="px-4 py-2.5 text-xs h-auto min-h-10 whitespace-nowrap cursor-pointer font-medium"
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  onClick={handleSnap}
                  disabled={isInitializing || !!cameraError}
                  className="flex-1 sm:flex-initial px-5 py-2.5 text-xs font-bold bg-primary hover:bg-primary-hover text-white shadow-md inline-flex items-center justify-center gap-2 whitespace-nowrap h-auto min-h-10 cursor-pointer"
                >
                  <Camera className="w-4 h-4 shrink-0" />
                  <span>Ambil Foto Sekarang (Jepret)</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
