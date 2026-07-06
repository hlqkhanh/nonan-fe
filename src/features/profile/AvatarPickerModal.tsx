import { Loader2, Upload, X } from "lucide-react";
import { useState } from "react";
import { getAvatarUploadSignature, uploadAvatarToCloudinary } from "../../data/api";
import { AVATAR_PRESET_SEEDS, diceBearUrl } from "../../lib/avatar";

type AvatarPickerModalProps = {
  currentAvatarUrl?: string;
  onClose: () => void;
  onSelect: (avatarUrl: string) => Promise<void>;
};

type AvatarTab = "presets" | "upload";

export function AvatarPickerModal({ currentAvatarUrl, onClose, onSelect }: AvatarPickerModalProps) {
  const [tab, setTab] = useState<AvatarTab>("presets");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function choosePreset(seed: string) {
    setSaving(true);
    setError("");
    try {
      await onSelect(diceBearUrl(seed));
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể cập nhật avatar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(file?: File) {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const signature = await getAvatarUploadSignature();
      const url = await uploadAvatarToCloudinary(file, signature);
      await onSelect(url);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể tải ảnh lên.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 grid place-items-end bg-black/76 sm:place-items-center">
      <div className="w-full max-w-[480px] rounded-t-[18px] border border-white/10 bg-ink p-4 shadow-2xl sm:rounded-[18px]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-mist">Chọn avatar</h2>
          <button
            className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.06] transition-colors hover:bg-white/10"
            type="button"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 rounded-[10px] bg-white/[0.05] p-1">
          {(["presets", "upload"] as AvatarTab[]).map((t) => (
            <button
              key={t}
              className={`h-10 rounded-[8px] text-sm font-semibold ${tab === t ? "bg-mist text-ink" : "text-white/56"}`}
              type="button"
              onClick={() => setTab(t)}
            >
              {t === "presets" ? "Mẫu" : "Tải ảnh"}
            </button>
          ))}
        </div>

        {tab === "presets" && (
          <div className="grid grid-cols-4 gap-3">
            {AVATAR_PRESET_SEEDS.map((seed) => {
              const url = diceBearUrl(seed);
              const isSelected = url === currentAvatarUrl;
              return (
                <button
                  key={seed}
                  className={`rounded-full p-[2px] ${isSelected ? "border-[2px] border-coral" : "border-[2px] border-transparent"}`}
                  type="button"
                  disabled={saving}
                  onClick={() => choosePreset(seed)}
                >
                  <div className="h-16 w-16 overflow-hidden rounded-full border-[3px] border-white/10 bg-white/5">
                    <img src={url} alt={seed} className="h-full w-full object-cover" />
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {tab === "upload" && (
          <div className="space-y-3">
            <label className="flex h-14 cursor-pointer items-center justify-center gap-2 rounded-full bg-mist font-semibold text-ink">
              {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
              {uploading ? "Đang tải lên..." : "Tải ảnh lên"}
              <input
                className="hidden"
                type="file"
                accept="image/*"
                disabled={uploading}
                onChange={(event) => handleUpload(event.target.files?.[0])}
              />
            </label>
            <p className="text-xs text-white/45">Ảnh sẽ được lưu trên Cloudinary.</p>
          </div>
        )}

        {error && <p className="mt-3 rounded-[8px] bg-coral/12 p-3 text-sm text-coral">{error}</p>}
      </div>
    </div>
  );
}
