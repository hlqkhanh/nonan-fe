import { useState } from "react";
import type { LedgerCycle, LedgerCycleDetail } from "../../types/sharebill";
import type { ParticipantMap } from "../../lib/participants";
import { getLedgerCycleDetail } from "../../data/api";
import { LedgerDetailModal } from "../settlements/LedgerDetailModal";
import { ChevronRight, CalendarClock, ReceiptText, RefreshCcw } from "lucide-react";

type LedgerPageProps = {
  participantMap: ParticipantMap;
  cycles: LedgerCycle[];
  currentCycleId: string;
  currentMemberId: string;
};

export function LedgerPage({ participantMap, cycles, currentCycleId, currentMemberId }: LedgerPageProps) {
  const [selectedDetail, setSelectedDetail] = useState<LedgerCycleDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const pastCycles = cycles.filter(c => c.id !== currentCycleId).sort((a, b) => b.startDate.localeCompare(a.startDate));

  async function openDetail(cycleId: string) {
    setLoading(true);
    try {
      const detail = await getLedgerCycleDetail(cycleId);
      if (detail) {
        setSelectedDetail(detail);
      }
    } finally {
      setLoading(false);
    }
  }

  function getStatusLabel(status: string) {
    if (status === "open") return <span className="rounded bg-mint/20 px-2 py-0.5 text-xs font-semibold text-mint">Đang mở</span>;
    if (status === "settled") return <span className="rounded bg-mist/20 px-2 py-0.5 text-xs font-semibold text-mist">Đã tất toán</span>;
    return <span className="rounded bg-coral/20 px-2 py-0.5 text-xs font-semibold text-coral">Chưa trả</span>;
  }

  return (
    <div className="px-4 pt-4 pb-28">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-mist">Lịch sử Sổ nợ</h2>
        <p className="text-sm text-white/50">Xem lại các kỳ thanh toán trước</p>
      </div>

      {pastCycles.length === 0 ? (
        <div className="rounded-[8px] border border-dashed border-white/14 p-8 text-center text-sm text-white/48">
          <CalendarClock className="mx-auto mb-3 h-8 w-8 text-white/20" />
          <p>Chưa có lịch sử sổ nợ nào.</p>
          <p className="mt-1 text-xs">Sổ nợ sẽ xuất hiện ở đây sau khi bạn tất toán hoặc lưu trữ.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pastCycles.map((cycle) => (
            <button
              key={cycle.id}
              type="button"
              className="flex w-full items-center justify-between rounded-[12px] border border-white/10 bg-white/[0.04] p-4 text-left transition-colors hover:bg-white/[0.06] active:scale-[0.98]"
              onClick={() => openDetail(cycle.id)}
              disabled={loading}
            >
              <div className="flex items-start gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/[0.05]">
                  {cycle.status === "settled" ? (
                     <ReceiptText className="h-6 w-6 text-mist" />
                  ) : (
                     <RefreshCcw className="h-6 w-6 text-coral" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                     <span className="font-semibold text-mist">Kỳ {cycle.endDate || cycle.startDate}</span>
                     {getStatusLabel(cycle.status)}
                  </div>
                  <div className="text-sm text-white/60">
                    {cycle.startDate} {cycle.endDate ? `→ ${cycle.endDate}` : ""}
                  </div>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-white/30" />
            </button>
          ))}
        </div>
      )}

      {selectedDetail && (
        <LedgerDetailModal
          participantMap={participantMap}
          detail={selectedDetail}
          settlements={selectedDetail.settlements}
          currentMemberId={currentMemberId}
          onClose={() => setSelectedDetail(null)}
          readonly={true}
        />
      )}
    </div>
  );
}
