import { X } from "lucide-react";
import { useState } from "react";

type CreateGroupModalProps = {
  onClose: () => void;
  onCreate: (name: string, memberNames: string[]) => Promise<void>;
};

export function CreateGroupModal({ onClose, onCreate }: CreateGroupModalProps) {
  const [name, setName] = useState("");
  const [memberNamesText, setMemberNamesText] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!name.trim()) {
      setError("Hãy nhập tên nhóm.");
      return;
    }

    const memberNames = memberNamesText
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    setSubmitting(true);
    setError("");
    try {
      await onCreate(name.trim(), memberNames);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể tạo nhóm.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 grid place-items-end bg-black/76 sm:place-items-center">
      <div className="w-full max-w-[480px] rounded-t-[18px] border border-white/10 bg-ink p-4 shadow-2xl sm:rounded-[18px]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-mist">Tạo nhóm mới</h2>
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
            <span className="mb-1 block text-sm text-white/55">Tên nhóm</span>
            <input
              className="h-12 w-full rounded-[8px] border border-white/10 bg-white/[0.06] px-3 text-mist outline-none focus:border-coral"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ví dụ: Hội bạn thân"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-white/55">Thêm thành viên (phân cách bằng dấu phẩy)</span>
            <input
              className="h-12 w-full rounded-[8px] border border-white/10 bg-white/[0.06] px-3 text-mist outline-none focus:border-coral"
              value={memberNamesText}
              onChange={(event) => setMemberNamesText(event.target.value)}
              placeholder="Khanh, Kien, Thong"
            />
          </label>

          {error && <p className="rounded-[8px] bg-coral/12 p-3 text-sm text-coral">{error}</p>}

          <button
            className="h-12 w-full rounded-full bg-coral font-semibold text-white disabled:opacity-50"
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
          >
            Tạo nhóm
          </button>
        </div>
      </div>
    </div>
  );
}
