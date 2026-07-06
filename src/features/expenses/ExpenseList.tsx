import { Pencil, ReceiptText, Trash2 } from "lucide-react";
import { formatVnd } from "../../lib/money/format";
import type { Expense } from "../../types/sharebill";

type ExpenseListProps = {
  expenses: Expense[];
  selectedDate: string;
  readonly?: boolean;
  onEditExpense?: (expense: Expense) => void;
  onDeleteExpense?: (expenseId: string) => void;
};

export function ExpenseList({ expenses, selectedDate, readonly, onEditExpense, onDeleteExpense }: ExpenseListProps) {
  const bills = expenses.filter((expense) => expense.paidDate === selectedDate);

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
                {expense.participants.length} người tham gia · {expense.splitMode === "equal" ? "chia đều" : "tùy chỉnh"}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <p className="text-sm font-semibold text-mist">{formatVnd(expense.totalAmount)}</p>
              {!readonly && (
                <div className="flex gap-2">
                  {onEditExpense && (
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
                      className="text-white/40 transition-colors hover:text-coral" 
                      onClick={() => onDeleteExpense(expense.id)}
                      title="Xóa"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
