import { Loader2, Pencil, ReceiptText, Trash2 } from "lucide-react";
import { useState } from "react";
import { formatVnd } from "../../lib/money/format";
import type { Expense } from "../../types/sharebill";

type ExpenseListProps = {
  expenses: Expense[];
  selectedDate: string;
  // Settled cycles hide the edit button but always allow soft-delete.
  readonly?: boolean;
  onEditExpense?: (expense: Expense) => void;
  onDeleteExpense?: (expenseId: string) => Promise<void>;
};

function formatBillDateTime(paidDate: string): string {
  const parsed = new Date(paidDate);
  if (Number.isNaN(parsed.getTime())) return paidDate;
  return parsed.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function ExpenseList({ expenses, selectedDate, readonly, onEditExpense, onDeleteExpense }: ExpenseListProps) {
  const bills = expenses.filter((expense) => expense.paidDate.slice(0, 10) === selectedDate);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(expenseId: string) {
    if (!onDeleteExpense) return;
    setDeletingId(expenseId);
    try {
      await onDeleteExpense(expenseId);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="px-4 pt-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-mist">Bill trong ngày</h2>
        <span className="text-xs text-white/40">{selectedDate}</span>
      </div>
      <div className="space-y-2">
        {bills.length === 0 && (
          <div className="rounded-[8px] border border-dashed border-white/14 p-4 text-sm text-white/48">
            Chưa có bill nào cho ngày này.
          </div>
        )}
        {bills.map((expense) => (
          <article key={expense.id} className="group flex items-center gap-3 rounded-[8px] border border-white/10 bg-white/[0.05] p-3 transition-colors hover:bg-white/[0.08]">
            <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-[8px] bg-panel">
              {expense.imageUrl ? (
                <img className="h-full w-full object-cover" src={expense.imageUrl} alt={expense.title} />
              ) : (
                <ReceiptText className="h-6 w-6 text-white/38" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-semibold text-mist">{expense.title}</h3>
              <p className="text-xs text-white/42">
                {formatBillDateTime(expense.paidDate)} · {expense.participants.length} người tham gia ·{" "}
                {expense.splitMode === "equal" ? "chia đều" : "tùy chỉnh"}
              </p>
              {expense.createdByDisplayName && (
                <p className="truncate text-[11px] text-white/32">Tạo bởi {expense.createdByDisplayName}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              <p className="text-sm font-semibold text-mist">{formatVnd(expense.totalAmount)}</p>
              <div className="flex gap-2">
                {!readonly && onEditExpense && (
                  <button
                    className="text-white/40 transition-colors hover:text-mist"
                    onClick={() => onEditExpense(expense)}
                    title="Sửa"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
                {onDeleteExpense && (
                  <button
                    className="text-white/40 transition-colors hover:text-coral disabled:opacity-50"
                    disabled={deletingId === expense.id}
                    onClick={() => handleDelete(expense.id)}
                    title="Xóa"
                  >
                    {deletingId === expense.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
