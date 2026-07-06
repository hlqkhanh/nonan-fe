import { X, Calendar, ReceiptText, Activity, Check, CheckCircle2 } from "lucide-react";
import { useMemo, useState } from "react";
import { formatVnd } from "../../lib/money/format";
import type { Group, LedgerCycleDetail, Settlement, SettlementSnapshot } from "../../types/sharebill";

type LedgerDetailModalProps = {
  group: Group;
  detail: LedgerCycleDetail;
  settlements: Settlement[] | SettlementSnapshot[];
  currentMemberId: string;
  onClose: () => void;
  readonly: boolean;
};

type LedgerTab = "transactions" | "balances" | "bills" | "activity";

export function LedgerDetailModal({ group, detail, settlements, currentMemberId, onClose, readonly }: LedgerDetailModalProps) {
  const [activeTab, setActiveTab] = useState<LedgerTab>("transactions");

  const sortedExpenses = [...detail.expenses].sort((a, b) => b.paidDate.localeCompare(a.paidDate));

  function getMemberName(memberId: string) {
    const member = group.members.find(m => m.id === memberId);
    if (member) return member.name;
    if (memberId.startsWith("temp:")) {
      const parts = memberId.split(":");
      if (parts.length > 1) return decodeURIComponent(parts[1]);
    }
    return memberId;
  }

  function getStatusLabel(status: string) {
    if (status === "open") return <span className="rounded-full bg-mint/20 px-2 py-0.5 text-xs font-semibold text-mint">Đang mở</span>;
    if (status === "settled") return <span className="rounded-full bg-mist/20 px-2 py-0.5 text-xs font-semibold text-mist">Đã tất toán</span>;
    return <span className="rounded-full bg-coral/20 px-2 py-0.5 text-xs font-semibold text-coral">Chưa trả</span>;
  }

  const youOwe = settlements
    .filter((settlement) => !settlement.paid && settlement.fromMemberId === currentMemberId)
    .reduce((sum, settlement) => sum + settlement.amount, 0);
  const youReceive = settlements
    .filter((settlement) => !settlement.paid && settlement.toMemberId === currentMemberId)
    .reduce((sum, settlement) => sum + settlement.amount, 0);

  const balances = useMemo(() => {
    const balanceByMember = new Map<string, { current: number; total: number }>();

    for (const settlement of settlements) {
      if (settlement.amount === 0) continue;

      const from = balanceByMember.get(settlement.fromMemberId) ?? { current: 0, total: 0 };
      const to = balanceByMember.get(settlement.toMemberId) ?? { current: 0, total: 0 };

      from.total -= settlement.amount;
      to.total += settlement.amount;

      if (!settlement.paid) {
        from.current -= settlement.amount;
        to.current += settlement.amount;
      }

      balanceByMember.set(settlement.fromMemberId, from);
      balanceByMember.set(settlement.toMemberId, to);
    }

    return Array.from(balanceByMember.entries())
      .map(([memberId, { current, total }]) => ({
        memberId,
        amount: current,
        originalAmount: total,
        isFullyPaid: current === 0 && total !== 0
      }))
      .filter((balance) => balance.originalAmount !== 0)
      .sort((a, b) => {
        if (a.isFullyPaid !== b.isFullyPaid) return a.isFullyPaid ? 1 : -1;
        return (a.isFullyPaid ? a.originalAmount : a.amount) - (b.isFullyPaid ? b.originalAmount : b.amount);
      });
  }, [settlements]);

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/76 sm:items-center">
      <div className="flex h-[94vh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-[18px] bg-ink shadow-2xl sm:h-[85vh] sm:rounded-[18px]">
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <h2 className="text-lg font-semibold text-mist">Chi tiết Sổ nợ</h2>
            <div className="mt-1 flex items-center gap-2">
              {getStatusLabel(detail.cycle.status)}
              <span className="text-xs text-white/40">
                {detail.cycle.startDate} {detail.cycle.endDate ? `→ ${detail.cycle.endDate}` : ""}
              </span>
            </div>
          </div>
          <button className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.06] transition-colors hover:bg-white/10" type="button" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="rounded-[8px] border border-white/10 bg-white/[0.05] p-3">
              <p className="text-xs text-white/45">Bạn cần trả</p>
              <p className="mt-1 text-xl font-semibold text-coral">{formatVnd(youOwe)}</p>
            </div>
            <div className="rounded-[8px] border border-white/10 bg-white/[0.05] p-3">
              <p className="text-xs text-white/45">Bạn sẽ nhận lại</p>
              <p className="mt-1 text-xl font-semibold text-mint">{formatVnd(youReceive)}</p>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-4 gap-1 rounded-[10px] bg-white/[0.05] p-1">
            {[
              { id: "transactions" as const, label: "Giao dịch" },
              { id: "balances" as const, label: "Âm dương" },
              { id: "bills" as const, label: "Bill" },
              { id: "activity" as const, label: "Log" }
            ].map((tab) => (
              <button
                key={tab.id}
                className={`h-10 rounded-[8px] text-[13px] font-semibold ${activeTab === tab.id ? "bg-mist text-ink" : "text-white/56"}`}
                type="button"
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {activeTab === "transactions" && (
              <div className="space-y-2">
                {settlements.length === 0 && (
                  <div className="rounded-[8px] border border-white/10 bg-white/[0.04] p-4 text-sm text-white/55">
                    Không có khoản nợ nào.
                  </div>
                )}
                {settlements.map((settlement) => {
                  const fromName = getMemberName(settlement.fromMemberId);
                  const toName = getMemberName(settlement.toMemberId);
                  return (
                    <div
                      key={settlement.id}
                      className={`relative flex items-center justify-between overflow-hidden rounded-[14px] border border-white/10 bg-clip-padding px-2 py-2 ${settlement.paid ? "opacity-50" : ""}`}
                      style={{
                        backgroundImage: "linear-gradient(90deg, #c20000 -10%, rgba(255, 255, 255, 0.05) 30%, rgba(255, 255, 255, 0.05) 70%, #00a340 110%)"
                      }}
                    >
                      <div className="flex flex-col items-center gap-1 z-10 w-[60px]">
                        <div className="relative h-10 w-10 overflow-hidden rounded-full border-2 border-white/20 bg-white/10 shadow-lg">
                          <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${fromName}`} alt={fromName} className="h-full w-full object-cover" />
                        </div>
                        <span className="truncate text-[11px] font-bold text-white drop-shadow-md">{fromName.split(" ")[0]}</span>
                      </div>

                      <div className="flex flex-1 flex-col items-center justify-center z-10 px-2 mt-[-4px]">
                        <div className="flex items-center justify-center w-full mb-1">
                          <div className="w-[120px] shrink-0 text-center">
                            <span className="text-[22px] font-black tracking-tight text-white drop-shadow-lg leading-none">
                              {formatVnd(settlement.amount)}
                            </span>
                          </div>

                          <button
                            className={`grid shrink-0 h-7 w-7 place-items-center rounded-full border border-white/40 bg-white/[0.05] transition-colors ${settlement.paid ? "text-mint border-mint" : "text-mint/70"} ${readonly ? "opacity-70 cursor-default" : ""}`}
                            type="button"
                            disabled={readonly}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center w-full max-w-[120px] opacity-40 mt-1">
                          <div className="h-[2px] flex-1 bg-white rounded-l-full"></div>
                          <div className="w-0 h-0 border-y-[4px] border-y-transparent border-l-[6px] border-l-white"></div>
                        </div>
                      </div>

                      <div className="flex flex-col items-center gap-1 z-10 w-[60px]">
                        <div className="relative h-10 w-10 overflow-hidden rounded-full border-2 border-white/20 bg-white/10 shadow-lg">
                          <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${toName}`} alt={toName} className="h-full w-full object-cover" />
                        </div>
                        <span className="truncate text-[11px] font-bold text-white drop-shadow-md">{toName.split(" ")[0]}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {activeTab === "balances" && (
              <div className="space-y-2">
                {balances.length === 0 && (
                  <div className="rounded-[8px] border border-white/10 bg-white/[0.04] p-4 text-sm text-white/55">
                    Không có số dư âm dương.
                  </div>
                )}
                {balances.map((balance) => {
                  const displayAmount = balance.isFullyPaid ? balance.originalAmount : balance.amount;
                  return (
                    <div
                      key={balance.memberId}
                      className={`flex items-center gap-2 rounded-[8px] border p-3 ${balance.isFullyPaid ? "border-mint/20 bg-mint/5 opacity-60" : "border-white/10 bg-white/[0.05]"}`}
                    >
                      <span className={`min-w-0 flex-1 truncate text-sm font-medium ${balance.isFullyPaid ? "text-white/40 line-through" : "text-mist"}`}>
                        {getMemberName(balance.memberId)}
                      </span>
                      <span className={`text-sm font-semibold ${balance.isFullyPaid ? "text-white/40 line-through" : displayAmount < 0 ? "text-coral" : "text-mint"}`}>
                        {displayAmount > 0 ? "+" : "-"}
                        {formatVnd(Math.abs(displayAmount))}
                      </span>
                      {balance.isFullyPaid && (
                        <div className="grid h-9 w-9 place-items-center">
                          <CheckCircle2 className="h-5 w-5 text-mint" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {activeTab === "bills" && (
              <div className="space-y-3">
                {sortedExpenses.length === 0 ? (
                  <p className="text-sm text-white/50">Không có bill nào.</p>
                ) : (
                  sortedExpenses.map((expense) => (
                    <div key={expense.id} className="rounded-[8px] border border-white/10 bg-white/[0.04] p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="font-semibold text-mist">{expense.title}</span>
                        <span className="text-xs text-white/40">{expense.paidDate}</span>
                      </div>
                      <div className="mb-2 flex gap-4">
                        {expense.imageUrl && (
                          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-[8px] bg-white/10">
                            <img src={expense.imageUrl} alt="" className="h-full w-full object-cover" />
                          </div>
                        )}
                        <div className="flex-1 space-y-1">
                          <div className="text-sm">
                            <span className="text-white/60">Tổng cộng: </span>
                            <span className="font-semibold text-mist">{formatVnd(expense.totalAmount)}</span>
                          </div>
                          <div className="text-xs">
                            <span className="text-white/60">Người trả: </span>
                            <span className="text-white/80">
                              {expense.payers.map(p => `${getMemberName(p.memberId)} (${formatVnd(p.amount)})`).join(", ")}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="border-t border-white/10 pt-2 text-xs">
                        <span className="text-white/60">Chia cho: </span>
                        <span className="text-white/80">
                          {expense.participants.map(p => `${p.memberName || getMemberName(p.memberId)} (${formatVnd(p.amount)}${p.isCustom ? " custom" : ""})`).join(", ")}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "activity" && (
              <div className="space-y-3 pl-2">
                {detail.auditLogs.length === 0 ? (
                  <p className="text-sm text-white/50">Không có hoạt động.</p>
                ) : (
                  detail.auditLogs.map((log) => (
                    <div key={log.id} className="relative border-l border-white/10 pb-3 pl-4 last:border-0 last:pb-0">
                      <div className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full border-2 border-ink bg-blue-400"></div>
                      <p className="text-sm text-white/80">{log.summary}</p>
                      <p className="text-xs text-white/40">{new Date(log.createdAt).toLocaleString("vi-VN")}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
