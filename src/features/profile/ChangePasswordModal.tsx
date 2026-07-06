import { X } from "lucide-react";
import { useState } from "react";

type ChangePasswordModalProps = {
  onClose: () => void;
  onSave: (currentPassword: string, newPassword: string) => Promise<void>;
};

export function ChangePasswordModal({ onClose, onSave }: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!currentPassword || !newPassword) {
      setError("Vui lòng điền đầy đủ thông tin.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Mật khẩu mới phải từ 6 ký tự.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await onSave(currentPassword, newPassword);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể đổi mật khẩu.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 grid place-items-end bg-black/76 sm:place-items-center">
      <div className="w-full max-w-[480px] rounded-t-[18px] border border-white/10 bg-ink p-4 shadow-2xl sm:rounded-[18px]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-mist">Đổi mật khẩu</h2>
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
            <span className="mb-1 block text-sm text-white/55">Mật khẩu hiện tại</span>
            <input
              className="h-12 w-full rounded-[8px] border border-white/10 bg-white/[0.06] px-3 text-mist outline-none focus:border-coral"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-white/55">Mật khẩu mới</span>
            <input
              className="h-12 w-full rounded-[8px] border border-white/10 bg-white/[0.06] px-3 text-mist outline-none focus:border-coral"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-white/55">Xác nhận mật khẩu mới</span>
            <input
              className="h-12 w-full rounded-[8px] border border-white/10 bg-white/[0.06] px-3 text-mist outline-none focus:border-coral"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>

          {error && <p className="rounded-[8px] bg-coral/12 p-3 text-sm text-coral">{error}</p>}

          <button
            className="h-12 w-full rounded-full bg-coral font-semibold text-white disabled:opacity-50"
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
          >
            Đổi mật khẩu
          </button>
        </div>
      </div>
    </div>
  );
}
