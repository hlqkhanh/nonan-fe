import { ChevronDown, Clock3, Loader2, Pencil, ReceiptText, SlidersHorizontal, Trash2, Users, WalletCards } from "lucide-react";
import { useState } from "react";
import { resolveAvatarUrl } from "../../lib/avatar";
import { formatVnd } from "../../lib/money/format";
import type { Expense, ParticipantShare, PayerContribution } from "../../types/sharebill";

type ExpenseListProps = {
  expenses: Expense[];
  selectedDate: string;
  readonly?: boolean;
  onEditExpense?: (expense: Expense) => void;
  onDeleteExpense?: (expenseId: string) => Promise<void>;
};

function formatBillDateTime(paidDate: string): string {
  const parsed = new Date(paidDate);
  if (Number.isNaN(parsed.getTime())) return paidDate;
  return parsed.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function payerName(payer: PayerContribution): string {
  return payer.name?.trim() || payer.memberId;
}

function participantName(participant: ParticipantShare): string {
  return participant.memberName?.trim() || participant.memberId;
}

function summarizePayers(payers: PayerContribution[]): string {
  if (payers.length === 0) return "";
  return payers.map(payerName).join(", ");
}

function summarizeParticipants(participants: ParticipantShare[]): string {
  if (participants.length === 0) return "";
  return participants.map(participantName).join(", ");
}

export function ExpenseList({ expenses, selectedDate, readonly, onEditExpense, onDeleteExpense }: ExpenseListProps) {
  const bills = expenses.filter((expense) => expense.paidDate.slice(0, 10) === selectedDate);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [isSectionExpanded, setIsSectionExpanded] = useState(true);

  async function handleDelete(expenseId: string) {
    if (!onDeleteExpense) return;
    setDeletingId(expenseId);
    try {
      await onDeleteExpense(expenseId);
    } finally {
      setDeletingId(null);
    }
  }

  function toggleExpanded(expenseId: string) {
    setExpandedIds((current) =>
      current.includes(expenseId) ? current.filter((id) => id !== expenseId) : [...current, expenseId]
    );
  }

  return (
    <section className="px-4 pt-5">
      <div 
        className="mb-3 flex items-center justify-between cursor-pointer select-none"
        onClick={() => setIsSectionExpanded(!isSectionExpanded)}
      >
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-mist">Bill trong ngày</h2>
          <ChevronDown className={`h-5 w-5 text-white/40 transition-transform ${isSectionExpanded ? "rotate-180" : ""}`} />
        </div>
        <span className="text-xs text-white/40">{selectedDate}</span>
      </div>
      
      {isSectionExpanded && (
        <div className="space-y-2">
        {bills.length === 0 && (
          <div className="rounded-[8px] border border-dashed border-white/14 p-4 text-sm text-white/48">
            Chưa có bill nào cho ngày này.
          </div>
        )}

        {bills.map((expense) => {
          const isExpanded = expandedIds.includes(expense.id);
          const payerSummary = summarizePayers(expense.payers);
          const participantSummary = summarizeParticipants(expense.participants);
          const SplitIcon = expense.splitMode === "equal" ? Users : SlidersHorizontal;

          return (
            <article
              key={expense.id}
              className="overflow-hidden rounded-[10px] border border-white/10 bg-white/[0.04] transition-colors hover:bg-white/[0.06]"
            >
              <div
                className="flex items-center gap-3 p-3 cursor-pointer"
                onClick={() => toggleExpanded(expense.id)}
              >
                <div className="grid h-[60px] w-[60px] shrink-0 place-items-center overflow-hidden rounded-[10px] bg-white/[0.06] border border-white/5">
                  {expense.imageUrl ? (
                    <img className="h-full w-full object-cover" src={expense.imageUrl} alt={expense.title} />
                  ) : (
                    <ReceiptText className="h-6 w-6 text-white/38" />
                  )}
                </div>

                <div className="min-w-0 flex-1 flex gap-3 self-stretch">
                  <div className="min-w-0 flex-1 flex flex-col pt-0.5">
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                      <h3 className="min-w-0 truncate text-sm font-semibold text-mist leading-tight">{expense.title}</h3>
                      <div className="flex shrink-0 items-center gap-2 text-[11px] text-white/45">
                        <div className="flex items-center gap-1 min-w-0">
                          <Clock3 className="h-3 w-3 shrink-0" />
                          <span className="truncate">{formatBillDateTime(expense.paidDate)}</span>
                        </div>
                        <div
                          className="flex items-center gap-1 shrink-0"
                          title={expense.splitMode === "equal" ? "Chia đều" : "Tùy chỉnh"}
                        >
                          <SplitIcon className="h-3 w-3 shrink-0" />
                          <span>{expense.participants.length}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 text-[11px] text-white/50">
                      {payerSummary && (
                        <div className="flex items-center gap-1.5 min-w-0" title={`Trả bởi ${payerSummary}`}>
                          <WalletCards className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate font-medium text-mint/90">{payerSummary}</span>
                        </div>
                      )}
                      {participantSummary && (
                        <div className="flex items-center gap-1.5 min-w-0" title={`Tham gia: ${participantSummary}`}>
                          <Users className="h-3.5 w-3.5 shrink-0 text-coral/90" />
                          <span className="truncate font-medium text-coral/90">{participantSummary}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-end justify-between pt-0.5">
                    <span className="text-sm font-bold text-mist">{formatVnd(expense.totalAmount)}</span>
                    <div className="flex items-center gap-0.5 -mr-1.5 -mb-1 mt-1">
                      {!readonly && onEditExpense && (
                        <button
                          className="grid h-7 w-7 place-items-center rounded-full text-white/45 transition-colors hover:bg-white/[0.08] hover:text-mist"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditExpense(expense);
                          }}
                          title="Sửa"
                          type="button"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {onDeleteExpense && (
                        <button
                          className="grid h-7 w-7 place-items-center rounded-full text-white/45 transition-colors hover:bg-white/[0.08] hover:text-coral disabled:opacity-50"
                          disabled={deletingId === expense.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(expense.id);
                          }}
                          title="Xóa"
                          type="button"
                        >
                          {deletingId === expense.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}
                      <button
                        className="grid h-7 w-7 place-items-center rounded-full text-white/45 transition-colors hover:bg-white/[0.08] hover:text-mist"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpanded(expense.id);
                        }}
                        title={isExpanded ? "Thu gọn" : "Xem chi tiết"}
                        type="button"
                        aria-expanded={isExpanded}
                      >
                        <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="space-y-3 border-t border-white/10 px-3 py-3">
                  <div>
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-white/55">
                      <WalletCards className="h-3.5 w-3.5 text-mint" />
                      Người trả
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {expense.payers.map((payer) => {
                        const name = payerName(payer);
                        return (
                          <div
                            key={payer.memberId}
                            className="flex min-w-0 items-center gap-2 rounded-full border border-mint/16 bg-mint/8 py-1 pl-1 pr-2"
                          >
                            <img
                              className="h-6 w-6 shrink-0 rounded-full object-cover"
                              src={resolveAvatarUrl(name, payer.avatarUrl)}
                              alt={name}
                            />
                            <span className="max-w-[92px] truncate text-xs font-semibold text-mist">{name}</span>
                            <span className="text-xs font-bold text-mint">{formatVnd(payer.amount)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-white/55">
                      <Users className="h-3.5 w-3.5 text-coral" />
                      Người tham gia
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {expense.participants.map((participant) => {
                        const name = participantName(participant);
                        return (
                          <div
                            key={participant.memberId}
                            className="flex min-w-0 items-center gap-2 rounded-[8px] border border-white/10 bg-ink/35 px-2 py-1.5"
                          >
                            <img
                              className="h-7 w-7 shrink-0 rounded-full object-cover"
                              src={resolveAvatarUrl(name, participant.avatarUrl)}
                              alt={name}
                            />
                            <span className="min-w-0 flex-1 truncate text-xs font-medium text-mist">{name}</span>
                            <span className="shrink-0 text-xs font-semibold text-white/70">
                              {formatVnd(participant.amount)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </article>
          );
        })}
        </div>
      )}
    </section>
  );
}
