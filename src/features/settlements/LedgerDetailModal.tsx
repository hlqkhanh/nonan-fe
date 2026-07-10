import { X } from "lucide-react";
import type { ParticipantMap } from "../../lib/participants";
import type { Expense, LedgerCycleDetail } from "../../types/sharebill";
import { CycleWorkspace } from "./CycleWorkspace";

type LedgerDetailModalProps = {
  participantMap: ParticipantMap;
  detail: LedgerCycleDetail;
  currentMemberId: string;
  onClose: () => void;
  readonly: boolean;
  onMarkPaid: (settlementId: string) => Promise<void>;
  onAdjustSettlement: (settlementId: string, deltaAmount: number) => Promise<void>;
  onEditExpense: (expense: Expense) => void;
  onDeleteExpense: (expenseId: string) => Promise<void>;
  onAddExpense: () => void;
  onSettleLedger: () => Promise<void>;
  onArchiveLedger: () => Promise<void>;
  onReopenLedger: () => Promise<void>;
};

function getStatusLabel(status: string) {
  if (status === "settled") return <span className="rounded-full bg-mist/20 px-2 py-0.5 text-xs font-semibold text-mist">Tất toán</span>;
  return <span className="rounded-full bg-coral/20 px-2 py-0.5 text-xs font-semibold text-coral">Chưa trả</span>;
}

/**
 * The "chi tiết khoản nợ" modal opened from the Sổ nợ tab. Wraps the same
 * CycleWorkspace used on the home screen, so a shared/own cycle picked from
 * the ledger list gets every home-screen capability (Issue 2): mark paid,
 * adjust, edit/delete bills, add a bill to this cycle, settle/archive/reopen.
 */
export function LedgerDetailModal({
  participantMap,
  detail,
  currentMemberId,
  onClose,
  readonly,
  onMarkPaid,
  onAdjustSettlement,
  onEditExpense,
  onDeleteExpense,
  onAddExpense,
  onSettleLedger,
  onArchiveLedger,
  onReopenLedger
}: LedgerDetailModalProps) {
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/76 sm:items-center">
      <div className="flex h-[94vh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-[18px] bg-ink shadow-2xl sm:h-[85vh] sm:rounded-[18px]">
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <h2 className="text-lg font-semibold text-mist">Chi tiết Sổ nợ</h2>
            <div className="mt-1 flex items-center gap-2">
              {getStatusLabel(detail.cycle.status)}
              {detail.cycle.active && (
                <span className="rounded-full bg-mint/20 px-2 py-0.5 text-xs font-semibold text-mint">Đang ở trang chủ</span>
              )}
              <span className="text-xs text-white/40">
                {detail.cycle.startDate} {detail.cycle.endDate ? `→ ${detail.cycle.endDate}` : ""}
              </span>
            </div>
          </div>
          <button className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.06] transition-colors hover:bg-white/10" type="button" title="Đóng" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <CycleWorkspace
            detail={detail}
            currentMemberId={currentMemberId}
            participantMap={participantMap}
            readonly={readonly}
            onMarkPaid={onMarkPaid}
            onAdjustSettlement={onAdjustSettlement}
            onEditExpense={onEditExpense}
            onDeleteExpense={onDeleteExpense}
            onAddExpense={onAddExpense}
            onSettleLedger={onSettleLedger}
            onArchiveLedger={onArchiveLedger}
            onReopenLedger={onReopenLedger}
          />
        </div>
      </div>
    </div>
  );
}
