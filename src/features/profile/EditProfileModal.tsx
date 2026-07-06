import { X } from "lucide-react";
import { useState } from "react";
import type { User } from "../../types/sharebill";

type EditProfileModalProps = {
  user: User;
  onClose: () => void;
  onSave: (input: { displayName: string; username: string }) => Promise<void>;
};

export function EditProfileModal({ user, onClose, onSave }: EditProfileModalProps) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [username, setUsername] = useState(user.username);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!displayName.trim()) {
      setError("Hãy nhập tên hiển thị.");
      return;
    }
    if (!username.trim()) {
      setError("Hãy nhập username.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await onSave({ displayName: displayName.trim(), username: username.trim().toLowerCase() });
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể cập nhật hồ sơ.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 grid place-items-end bg-black/76 sm:place-items-center">
      <div className="w-full max-w-[480px] rounded-t-[18px] border border-white/10 bg-ink p-4 shadow-2xl sm:rounded-[18px]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-mist">Sửa hồ sơ</h2>
          <button
            className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.06] transition-colors hover:bg-white/10"
            type="button"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm text-white/55">Tên hiển thị</span>
            <input
              className="h-12 w-full rounded-[8px] border border-white/10 bg-white/[0.06] px-3 text-mist outline-none focus:border-coral"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-white/55">Username</span>
            <div className="flex h-12 items-center rounded-[8px] border border-white/10 bg-white/[0.06] px-3 focus-within:border-coral">
              <span className="text-white/40">@</span>
              <input
                className="min-w-0 flex-1 bg-transparent px-1 text-mist outline-none"
                value={username}
                onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))}
              />
            </div>
          </label>

          {error && <p className="rounded-[8px] bg-coral/12 p-3 text-sm text-coral">{error}</p>}

          <button
            className="h-12 w-full rounded-full bg-coral font-semibold text-white disabled:opacity-50"
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
          >
            Lưu thay đổi
          </button>
        </div>
      </div>
    </div>
  );
}
