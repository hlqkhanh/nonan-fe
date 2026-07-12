import { Camera, Check, ImagePlus, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type CameraCaptureProps = {
  onCapture: (file: File) => void;
  onSkip: () => void;
};

export function CameraCapture({ onCapture, onSkip }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingCapture, setPendingCapture] = useState<{ file: File; url: string } | null>(null);

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  useEffect(() => {
    let cancelled = false;

    async function start() {
      stopStream();
      setReady(false);
      setError(null);

      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Trình duyệt không hỗ trợ camera. Hãy chọn ảnh từ thư viện.");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: false });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setReady(true);
      } catch {
        if (!cancelled) {
          setError("Không thể mở camera (có thể do quyền truy cập bị từ chối). Hãy chọn ảnh từ thư viện.");
        }
      }
    }

    if (!pendingCapture) void start();

    return () => {
      cancelled = true;
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode, pendingCapture]);

  useEffect(() => {
    return () => {
      if (pendingCapture) URL.revokeObjectURL(pendingCapture.url);
    };
  }, [pendingCapture]);

  function showPreview(file: File) {
    setPendingCapture((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return { file, url: URL.createObjectURL(file) };
    });
    stopStream();
  }

  function retake() {
    setPendingCapture((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
  }

  function confirmCapture() {
    if (!pendingCapture) return;
    onCapture(pendingCapture.file);
    URL.revokeObjectURL(pendingCapture.url);
  }

  function capture() {
    const video = videoRef.current;
    if (!video || !ready) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 900;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        showPreview(new File([blob], `bill-${Date.now()}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.9
    );
  }

  function handleLibraryFile(file?: File) {
    if (!file) return;
    showPreview(file);
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-[4/5] overflow-hidden rounded-[12px] border border-white/10 bg-black">
        {pendingCapture ? (
          <img className="h-full w-full object-cover" src={pendingCapture.url} alt="Ảnh bill vừa chụp" />
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
            <Camera className="h-10 w-10 text-white/30" />
            <p className="text-sm text-white/60">{error}</p>
          </div>
        ) : (
          <video ref={videoRef} className="h-full w-full object-cover" playsInline muted autoPlay />
        )}

        {pendingCapture ? (
          <div className="absolute inset-x-0 bottom-0 grid grid-cols-2 gap-3 bg-gradient-to-t from-black/85 to-transparent p-4">
            <button
              type="button"
              className="flex h-12 items-center justify-center gap-2 rounded-full border border-white/18 bg-black/35 text-sm font-semibold text-mist backdrop-blur transition hover:bg-white/10"
              onClick={retake}
            >
              <X className="h-4 w-4" />
              Chụp lại
            </button>
            <button
              type="button"
              className="flex h-12 items-center justify-center gap-2 rounded-full bg-mist text-sm font-semibold text-ink shadow-lg shadow-black/20 transition active:scale-95"
              onClick={confirmCapture}
            >
              <Check className="h-4 w-4" />
              Dùng ảnh
            </button>
          </div>
        ) : (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-black/80 to-transparent p-4">
            <label
              className="grid h-11 w-11 cursor-pointer place-items-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25"
              title="Chọn từ thư viện"
            >
              <ImagePlus className="h-5 w-5" />
              <input className="hidden" type="file" accept="image/*" onChange={(event) => handleLibraryFile(event.target.files?.[0])} />
            </label>

            {!error ? (
              <button
                type="button"
                className="grid h-16 w-16 place-items-center rounded-full border-4 border-white bg-white/10 transition active:scale-95 disabled:opacity-40"
                onClick={capture}
                disabled={!ready}
                title="Chụp ảnh"
              >
                <span className="h-12 w-12 rounded-full bg-white" />
              </button>
            ) : (
              <div className="h-16 w-16" />
            )}

            {!error ? (
              <button
                type="button"
                className="grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25"
                onClick={() => setFacingMode((current) => (current === "environment" ? "user" : "environment"))}
                title="Đổi camera trước/sau"
              >
                <RotateCcw className="h-5 w-5" />
              </button>
            ) : (
              <div className="h-11 w-11" />
            )}
          </div>
        )}
      </div>

      <button className="h-12 w-full rounded-full border border-white/14 text-sm font-semibold text-mist" type="button" onClick={onSkip}>
        Bỏ qua ảnh
      </button>
    </div>
  );
}
