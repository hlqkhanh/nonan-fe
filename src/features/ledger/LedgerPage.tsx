import { useState } from "react";
import type { Expense, LedgerCycle, LedgerCycleDetail, LedgerCycleMemberInfo } from "../../types/sharebill";
import type { ParticipantMap } from "../../lib/participants";
import { getLedgerCycleDetail, setActiveLedgerCycle, reopenLedgerCycle } from "../../data/api";
import { formatVnd } from "../../lib/money/format";
import { resolveAvatarUrl } from "../../lib/avatar";
import { LedgerDetailModal } from "../settlements/LedgerDetailModal";
import { ChevronRight, CalendarClock, Home, Loader2, ReceiptText, RefreshCcw, Users } from "lucide-react";

type LedgerPageProps = {
  participantMap: ParticipantMap;
  cycles: LedgerCycle[];
  currentMemberId: string;
  // Cycle-level actions (set-active/reopen) change data App.tsx also relies on
  // (home screen's active cycle) — let the parent refetch everything rather
  // than mutating local state ourselves.
  onCyclesChanged: () => Promise<void>;
  onMembersResolved: (members: Record<string, LedgerCycleMemberInfo>) => void;
  onMarkPaid: (cycleId: string, settlementId: string) => Promise<void>;
  onAdjustSettlement: (cycleId: string, settlementId: string, deltaAmount: number) => Promise<void>;
  onEditExpense: (expense: Expense) => void;
  onDeleteExpense: (expenseId: string) => Promise<void>;
  onAddExpense: (cycleId: string) => void;
  onSettleLedger: (cycleId: string) => Promise<void>;
  onArchiveLedger: (cycleId: string) => Promise<void>;
  onReopenLedger: (cycleId: string) => Promise<void>;
};

export function LedgerPage({
  participantMap,
  cycles,
  currentMemberId,
  onCyclesChanged,
  onMembersResolved,
  onMarkPaid,
  onAdjustSettlement,
  onEditExpense,
  onDeleteExpense,
  onAddExpense,
  onSettleLedger,
  onArchiveLedger,
  onReopenLedger
}: LedgerPageProps) {
  const [selectedDetail, setSelectedDetail] = useState<LedgerCycleDetail | null>(null);
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);
  const [busyCycleId, setBusyCycleId] = useState<string | null>(null);

  async function openDetail(cycleId: string) {
    setLoadingDetailId(cycleId);
    try {
      const detail = await getLedgerCycleDetail(cycleId);
      setSelectedDetail(detail);
      onMembersResolved(detail.members);
    } finally {
      setLoadingDetailId(null);
    }
  }

  // Every mutation from inside the open detail modal must refresh both the
  // app-wide state (home cycle / cycles list, via the parent-supplied
  // handlers below) and this page's own open-detail snapshot.
  async function withDetailRefresh(action: () => Promise<void>) {
    await action();
    if (selectedDetail) {
      const fresh = await getLedgerCycleDetail(selectedDetail.cycle.id);
      setSelectedDetail(fresh);
      onMembersResolved(fresh.members);
    }
  }

  async function handleSetActive(cycle: LedgerCycle, event: React.MouseEvent) {
    event.stopPropagation();
    setBusyCycleId(cycle.id);
    try {
      await setActiveLedgerCycle(cycle.id);
      await onCyclesChanged();
    } finally {
      setBusyCycleId(null);
    }
  }

  async function handleReopen(cycle: LedgerCycle, event: React.MouseEvent) {
    event.stopPropagation();
    if (!confirm("Hủy tất toán và mở lại khoản nợ này?")) return;
    setBusyCycleId(cycle.id);
    try {
      await reopenLedgerCycle(cycle.id);
      await onCyclesChanged();
    } finally {
      setBusyCycleId(null);
    }
  }

  function getStatusLabel(cycle: LedgerCycle) {
    if (cycle.active) return <span className="rounded bg-mint/20 px-2 py-0.5 text-xs font-semibold text-mint">Đang mở</span>;
    if (cycle.status === "settled") return <span className="rounded bg-mist/20 px-2 py-0.5 text-xs font-semibold text-mist">Tất toán</span>;
    return <span className="rounded bg-coral/20 px-2 py-0.5 text-xs font-semibold text-coral">Chưa trả</span>;
  }

  return (
    <div className="px-4 pt-4 pb-28">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-mist">Sổ nợ</h2>
        <p className="text-sm text-white/50">Mọi khoản nợ bạn tham gia — của bạn và được chia sẻ</p>
      </div>

      {cycles.length === 0 ? (
        <div className="rounded-[8px] border border-dashed border-white/14 p-8 text-center text-sm text-white/48">
          <CalendarClock className="mx-auto mb-3 h-8 w-8 text-white/20" />
          <p>Chưa có khoản nợ nào.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cycles.map((cycle) => {
            const isBusy = busyCycleId === cycle.id;
            const isLoadingDetail = loadingDetailId === cycle.id;
            const netAmount = cycle.viewerNet ?? 0;
            return (
              <div
                key={cycle.id}
                className="rounded-[12px] border border-white/10 bg-white/[0.04] p-4 transition-colors hover:bg-white/[0.06]"
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between text-left"
                  onClick={() => openDetail(cycle.id)}
                  disabled={isLoadingDetail}
                >
                  <div className="flex items-start gap-4">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/[0.05]">
                      {cycle.status === "settled" ? (
                        <ReceiptText className="h-6 w-6 text-mist" />
                      ) : cycle.active ? (
                        <RefreshCcw className="h-6 w-6 text-mint" />
                      ) : (
                        <RefreshCcw className="h-6 w-6 text-coral" />
                      )}
                    </div>
                    <div>
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-mist">Kỳ {cycle.endDate || cycle.startDate}</span>
                        {getStatusLabel(cycle)}
                        {cycle.isOwner ? (
                          <span className="rounded bg-white/10 px-2 py-0.5 text-xs font-semibold text-white/55">Của tôi</span>
                        ) : (
                          <span className="flex items-center gap-1 rounded bg-white/10 px-2 py-0.5 text-xs font-semibold text-white/55">
                            <Users className="h-3 w-3" /> Chia sẻ
                          </span>
                        )}
                      </div>
                      {!cycle.isOwner && (
                        <div className="mb-1 flex items-center gap-1.5 text-xs text-white/50">
                          <img
                            src={resolveAvatarUrl(cycle.ownerDisplayName, cycle.ownerAvatarUrl)}
                            alt={cycle.ownerDisplayName}
                            className="h-4 w-4 rounded-full object-cover"
                          />
                          Chủ sổ: {cycle.ownerDisplayName}
                        </div>
                      )}
                      <div className="text-sm text-white/60">
                        {cycle.startDate} {cycle.endDate ? `→ ${cycle.endDate}` : ""}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                        <span className={netAmount > 0 ? "font-semibold text-mint" : netAmount < 0 ? "font-semibold text-coral" : "text-white/45"}>
                          {netAmount === 0 ? "Đã cân bằng" : `${netAmount > 0 ? "+" : "-"}${formatVnd(Math.abs(netAmount))}`}
                        </span>
                        <span className="text-white/40">Tổng {formatVnd(cycle.totalAmount ?? 0)}</span>
                        {(cycle.unpaidCount ?? 0) > 0 && (
                          <span className="text-white/40">{cycle.unpaidCount} khoản chưa trả</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-white/30" />
                </button>

                <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3">
                  {cycle.active ? (
                    <span className="flex h-9 items-center gap-1.5 rounded-[8px] border border-mint/30 bg-mint/10 px-3 text-xs font-semibold text-mint">
                      <Home className="h-3.5 w-3.5" />
                      Đang ở trang chủ
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="flex h-9 items-center gap-1.5 rounded-[8px] border border-white/10 bg-white/[0.05] px-3 text-xs font-semibold text-white/65 transition-colors hover:bg-white/10 disabled:opacity-50"
                      onClick={(event) => handleSetActive(cycle, event)}
                      disabled={isBusy}
                    >
                      {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Home className="h-3.5 w-3.5" />}
                      Đưa lên trang chủ
                    </button>
                  )}

                  {cycle.status === "settled" && (
                    <button
                      type="button"
                      className="flex h-9 items-center gap-1.5 rounded-[8px] border border-white/10 bg-white/[0.05] px-3 text-xs font-semibold text-white/65 transition-colors hover:bg-white/10 disabled:opacity-50"
                      onClick={(event) => handleReopen(cycle, event)}
                      disabled={isBusy}
                    >
                      {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
                      Hủy tất toán
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedDetail && (
        <LedgerDetailModal
          participantMap={participantMap}
          detail={selectedDetail}
          currentMemberId={currentMemberId}
          onClose={() => setSelectedDetail(null)}
          readonly={selectedDetail.cycle.status === "settled"}
          onMarkPaid={(settlementId) => withDetailRefresh(() => onMarkPaid(selectedDetail.cycle.id, settlementId))}
          onAdjustSettlement={(settlementId, deltaAmount) =>
            withDetailRefresh(() => onAdjustSettlement(selectedDetail.cycle.id, settlementId, deltaAmount))
          }
          onEditExpense={onEditExpense}
          onDeleteExpense={(expenseId) => withDetailRefresh(() => onDeleteExpense(expenseId))}
          onAddExpense={() => onAddExpense(selectedDetail.cycle.id)}
          onSettleLedger={() => withDetailRefresh(() => onSettleLedger(selectedDetail.cycle.id))}
          onArchiveLedger={() => withDetailRefresh(() => onArchiveLedger(selectedDetail.cycle.id))}
          onReopenLedger={() => withDetailRefresh(() => onReopenLedger(selectedDetail.cycle.id))}
        />
      )}
    </div>
  );
}
