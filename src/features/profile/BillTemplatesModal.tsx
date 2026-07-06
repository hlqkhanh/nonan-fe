import { Plus, X } from "lucide-react";
import { useState } from "react";
import type { BillTitleTemplate } from "../../types/sharebill";

type BillTemplatesModalProps = {
  templates: BillTitleTemplate[];
  onClose: () => void;
  onSave: (labels: string[]) => Promise<void>;
};

const MAX_TEMPLATES = 5;

export function BillTemplatesModal({ templates, onClose, onSave }: BillTemplatesModalProps) {
  const [labels, setLabels] = useState<string[]>(templates.map((template) => template.label));
  const [newLabel, setNewLabel] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function addLabel() {
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    if (labels.length >= MAX_TEMPLATES) {
      setError(`Tối đa ${MAX_TEMPLATES} mẫu.`);
      return;
    }
    setLabels((current) => [...current, trimmed]);
    setNewLabel("");
    setError("");
  }

  function removeLabel(index: number) {
    setLabels((current) => current.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    try {
      await onSave(labels);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể lưu mẫu tên bill.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 grid place-items-end bg-black/76 sm:place-items-center">
      <div className="w-full max-w-[480px] rounded-t-[18px] border border-white/10 bg-ink p-4 shadow-2xl sm:rounded-[18px]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-mist">Mẫu tên bill</h2>
          <button
            className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.06] transition-colors hover:bg-white/10"
            type="button"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-3 text-sm text-white/45">Tối đa {MAX_TEMPLATES} mẫu, hiển thị nhanh khi đặt tên bill.</p>

        <div className="mb-4 flex flex-wrap gap-2">
          {labels.map((label, index) => (
            <span
              key={`${label}-${index}`}
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-mist"
            >
              {label}
              <button className="text-white/40 hover:text-coral" type="button" onClick={() => removeLabel(index)}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {labels.length === 0 && <p className="text-sm text-white/40">Chưa có mẫu nào.</p>}
        </div>

        <div className="mb-4 flex gap-2">
          <input
            className="h-11 min-w-0 flex-1 rounded-[8px] border border-white/10 bg-white/[0.06] px-3 text-sm text-mist outline-none focus:border-coral"
            value={newLabel}
            onChange={(event) => setNewLabel(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addLabel();
              }
            }}
            placeholder="Ví dụ: Ăn sáng"
            maxLength={40}
            disabled={labels.length >= MAX_TEMPLATES}
          />
          <button
            className="grid h-11 w-11 shrink-0 place-items-center rounded-[8px] bg-mist text-ink disabled:opacity-50"
            type="button"
            onClick={addLabel}
            disabled={labels.length >= MAX_TEMPLATES}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {error && <p className="mb-4 rounded-[8px] bg-coral/12 p-3 text-sm text-coral">{error}</p>}

        <button
          className="h-12 w-full rounded-full bg-coral font-semibold text-white disabled:opacity-50"
          type="button"
          disabled={submitting}
          onClick={handleSubmit}
        >
          Lưu
        </button>
      </div>
    </div>
  );
}
