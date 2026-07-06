import { Check, CheckCircle2, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { formatVnd, formatVndInput, parseVndInput } from "../../lib/money/format";
import type { Group, Settlement, LedgerCycle, Expense, AuditLogEntry } from "../../types/sharebill";
import { LedgerDetailModal } from "./LedgerDetailModal";

type SettlementPanelProps = {
  group: Group;
  ledgerCycle: LedgerCycle;
  expenses: Expense[];
  auditLogs: AuditLogEntry[];
  settlements: Settlement[];
  currentMemberId: string;
  onMarkPaid: (settlementId: string) => void;
  onAdjustSettlement: (settlementId: string, deltaAmount: number) => void;
  onOpenDetail: () => void;
  onSettleLedger: () => void;
  onArchiveLedger: () => void;
};

type SettlementTab = "transactions" | "balances";
type AdjustmentMode = "increase" | "decrease";
type BalanceAdjustmentTarget = {
  memberId: string;
  amount: number;
};

function memberName(group: Group, memberId: string): string {
  const member = group.members.find((item) => item.id === memberId);
  if (member) return member.name;

  if (memberId.startsWith("temp:")) {
    const [, encodedName] = memberId.split(":");
    return decodeURIComponent(encodedName ?? memberId);
  }

  return memberId;
}

export function SettlementPanel({
  group,
  ledgerCycle,
  expenses,
  auditLogs,
  settlements,
  currentMemberId,
  onMarkPaid,
  onAdjustSettlement,
  onOpenDetail,
  onSettleLedger,
  onArchiveLedger
}: SettlementPanelProps) {
  const [activeTab, setActiveTab] = useState<SettlementTab>("balances");
  const [adjustingSettlement, setAdjustingSettlement] = useState<Settlement | null>(null);
  const [adjustingBalance, setAdjustingBalance] = useState<BalanceAdjustmentTarget | null>(null);
  const [adjustmentMode, setAdjustmentMode] = useState<AdjustmentMode>("decrease");
  const [adjustmentAmount, setAdjustmentAmount] = useState(0);
  const [counterpartyId, setCounterpartyId] = useState("");
  const [showDetail, setShowDetail] = useState(false);

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

  function openAdjustment(settlement: Settlement) {
    setAdjustingSettlement(settlement);
    setAdjustingBalance(null);
    setAdjustmentMode("decrease");
    setAdjustmentAmount(0);
  }

  function openBalanceAdjustment(balance: BalanceAdjustmentTarget) {
    const defaultCounterparty =
      balances.find((item) => !item.isFullyPaid && item.memberId !== balance.memberId && Math.sign(item.amount) !== Math.sign(balance.amount))?.memberId ??
      group.members.find((member) => member.id !== balance.memberId)?.id ??
      "";

    setAdjustingBalance(balance);
    setAdjustingSettlement(null);
    setCounterpartyId(defaultCounterparty);
    setAdjustmentMode("decrease");
    setAdjustmentAmount(0);
  }

  function submitAdjustment() {
    if (adjustingSettlement) {
      if (adjustmentAmount <= 0) return;
      onAdjustSettlement(adjustingSettlement.id, adjustmentMode === "increase" ? adjustmentAmount : -adjustmentAmount);
    }

    if (adjustingBalance) {
      if (adjustmentAmount <= 0 || !counterpartyId) return;
      const balanceIsDebtor = adjustingBalance.amount < 0;
      const pairKey = balanceIsDebtor
        ? `${adjustingBalance.memberId}->${counterpartyId}`
        : `${counterpartyId}->${adjustingBalance.memberId}`;
      onAdjustSettlement(pairKey, adjustmentMode === "increase" ? adjustmentAmount : -adjustmentAmount);
    }

    setAdjustingSettlement(null);
    setAdjustingBalance(null);
    setAdjustmentAmount(0);
  }

  const modalOpen = adjustingSettlement !== null || adjustingBalance !== null;

  return (
    <section className="px-4 pb-28 pt-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-[8px] border border-white/10 bg-white/[0.05] p-3">
          <p className="text-xs text-white/45">Bạn cần trả</p>
          <p className="mt-1 text-xl font-semibold text-coral">{formatVnd(youOwe)}</p>
        </div>
        <div className="rounded-[8px] border border-white/10 bg-white/[0.05] p-3">
          <p className="text-xs text-white/45">Bạn sẽ nhận lại</p>
          <p className="mt-1 text-xl font-semibold text-mint">{formatVnd(youReceive)}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <button 
          className="h-10 rounded-[8px] bg-white/[0.05] text-sm font-semibold text-mist hover:bg-white/[0.08]" 
          onClick={() => setShowDetail(true)}
        >
          Chi tiết
        </button>
        <button 
          className="h-10 rounded-[8px] bg-mist text-sm font-semibold text-ink disabled:opacity-50" 
          disabled={expenses.length === 0 && settlements.length === 0}
          onClick={onSettleLedger}
        >
          Tất toán
        </button>
        <button 
          className="h-10 rounded-[8px] border border-white/10 bg-transparent text-sm font-semibold text-white/60 hover:text-white disabled:opacity-50" 
          disabled={expenses.length === 0 && settlements.length === 0}
          onClick={onArchiveLedger}
        >
          Lưu trữ
        </button>
      </div>

      <div className="mt-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-mist">Sổ nợ</h2>
          <span className="text-xs text-white/40">{settlements.filter((item) => !item.paid).length} việc cần xử lý</span>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2 rounded-[10px] bg-white/[0.05] p-1">
          {[
            { id: "transactions" as const, label: "Giao dịch" },
            { id: "balances" as const, label: "Âm dương" }
          ].map((tab) => (
            <button
              key={tab.id}
              className={`h-10 rounded-[8px] text-sm font-semibold ${activeTab === tab.id ? "bg-mist text-ink" : "text-white/56"
                }`}
              type="button"
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "transactions" && (
          <div className="space-y-2">
            {settlements.length === 0 && (
              <div className="rounded-[8px] border border-white/10 bg-white/[0.04] p-4 text-sm text-white/55">
                Nhóm hiện không có khoản nợ nào.
              </div>
            )}
            {settlements.map((settlement) => {
              const fromName = memberName(group, settlement.fromMemberId);
              const toName = memberName(group, settlement.toMemberId);
              return (
                <div
                  key={settlement.id}
                  className={`relative flex items-center justify-between overflow-hidden rounded-[14px] border border-white/10 bg-clip-padding px-2 py-2 ${settlement.paid ? "opacity-50" : ""
                    }`}
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
                      <button
                        className="grid shrink-0 h-7 w-7 place-items-center rounded-full border border-white/40 bg-white/[0.05] text-coral transition-colors active:scale-95"
                        type="button"
                        title="Điều chỉnh sổ nợ"
                        onClick={() => openAdjustment(settlement)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>

                      <div className="w-[120px] shrink-0 text-center">
                        <span className="text-[22px] font-black tracking-tight text-white drop-shadow-lg leading-none">
                          {formatVnd(settlement.amount)}
                        </span>
                      </div>

                      <button
                        className={`grid shrink-0 h-7 w-7 place-items-center rounded-full border border-white/40 bg-white/[0.05] transition-colors active:scale-95 ${settlement.paid ? "text-mint border-mint" : "text-mint/70"
                          }`}
                        type="button"
                        title={settlement.paid ? "Hoàn tác đã trả" : "Đánh dấu đã trả xong"}
                        onClick={() => onMarkPaid(settlement.id)}
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
                Nhóm đang cân bằng, không có số dư âm dương.
              </div>
            )}
            {balances.map((balance) => {
              const displayAmount = balance.isFullyPaid ? balance.originalAmount : balance.amount;
              return (
                <div
                  key={balance.memberId}
                  className={`flex items-center gap-2 rounded-[8px] border p-3 ${balance.isFullyPaid ? "border-mint/20 bg-mint/5 opacity-60" : "border-white/10 bg-white/[0.05]"
                    }`}
                >
                  <span className={`min-w-0 flex-1 truncate text-sm font-medium ${balance.isFullyPaid ? "text-white/40 line-through" : "text-mist"}`}>
                    {memberName(group, balance.memberId)}
                  </span>
                  <span className={`text-sm font-semibold ${balance.isFullyPaid ? "text-white/40 line-through" : displayAmount < 0 ? "text-coral" : "text-mint"
                    }`}>
                    {displayAmount > 0 ? "+" : "-"}
                    {formatVnd(Math.abs(displayAmount))}
                  </span>
                  {!balance.isFullyPaid ? (
                    <>
                      <button
                        className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-coral transition-colors hover:bg-white/10"
                        type="button"
                        title="Điều chỉnh số dư"
                        onClick={() => openBalanceAdjustment(balance)}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                      <button
                        className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-white/55 transition-colors hover:bg-white/10"
                        type="button"
                        title="Đánh dấu các khoản liên quan đã trả"
                        onClick={() => {
                          settlements
                            .filter(
                              (settlement) =>
                                !settlement.paid &&
                                (settlement.fromMemberId === balance.memberId || settlement.toMemberId === balance.memberId)
                            )
                            .forEach((settlement) => onMarkPaid(settlement.id));
                        }}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <div className="grid h-9 w-9 place-items-center">
                      <CheckCircle2 className="h-5 w-5 text-mint" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-30 flex items-end justify-center overflow-y-auto bg-black/70 p-3 sm:items-center">
          <div className="max-h-[92vh] w-full max-w-[448px] overflow-y-auto rounded-[14px] border border-white/10 bg-ink p-4 shadow-2xl">
            <div className="mb-4">
              <p className="text-xs text-white/45">Điều chỉnh sổ nợ</p>
              <h3 className="mt-1 text-lg font-semibold text-mist">
                {adjustingSettlement
                  ? `${memberName(group, adjustingSettlement.fromMemberId)} trả ${memberName(group, adjustingSettlement.toMemberId)}`
                  : `${memberName(group, adjustingBalance!.memberId)} ${adjustingBalance!.amount < 0 ? "đang âm" : "đang dương"
                  }`}
              </h3>
            </div>

            {adjustingBalance && (
              <label className="mb-4 block">
                <span className="mb-1 block text-sm text-white/55">
                  {adjustingBalance.amount < 0 ? "Ghi nợ với ai" : "Nhận/đối ứng với ai"}
                </span>
                <select
                  className="h-12 w-full rounded-[8px] border border-white/10 bg-white/[0.06] px-3 text-mist outline-none focus:border-coral"
                  value={counterpartyId}
                  onChange={(event) => setCounterpartyId(event.target.value)}
                >
                  <option className="bg-ink text-mist" value="">
                    Chọn người
                  </option>
                  {balances
                    .filter((balance) => !balance.isFullyPaid && balance.memberId !== adjustingBalance.memberId)
                    .map((balance) => (
                      <option className="bg-ink text-mist" key={balance.memberId} value={balance.memberId}>
                        {memberName(group, balance.memberId)} {balance.amount > 0 ? "+" : "-"}
                        {formatVnd(Math.abs(balance.amount))}
                      </option>
                    ))}
                  {group.members
                    .filter(
                      (member) =>
                        member.id !== adjustingBalance.memberId && !balances.some((balance) => !balance.isFullyPaid && balance.memberId === member.id)
                    )
                    .map((member) => (
                      <option className="bg-ink text-mist" key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                </select>
              </label>
            )}

            <div className="grid grid-cols-2 gap-2 rounded-[10px] bg-white/[0.05] p-1">
              <button
                className={`h-10 rounded-[8px] text-sm font-semibold ${adjustmentMode === "decrease" ? "bg-mist text-ink" : "text-white/56"
                  }`}
                type="button"
                onClick={() => setAdjustmentMode("decrease")}
              >
                Giảm nợ
              </button>
              <button
                className={`h-10 rounded-[8px] text-sm font-semibold ${adjustmentMode === "increase" ? "bg-mist text-ink" : "text-white/56"
                  }`}
                type="button"
                onClick={() => setAdjustmentMode("increase")}
              >
                Tăng nợ
              </button>
            </div>

            <label className="mt-4 block">
              <span className="mb-1 block text-sm text-white/55">Số tiền</span>
              <input
                className="h-12 w-full rounded-[8px] border border-white/10 bg-white/[0.06] px-3 text-right text-mist outline-none focus:border-coral"
                inputMode="numeric"
                value={formatVndInput(adjustmentAmount)}
                onChange={(event) => setAdjustmentAmount(parseVndInput(event.target.value))}
                placeholder="50.000"
              />
            </label>

            <p className="mt-3 rounded-[8px] bg-white/[0.04] p-3 text-xs leading-5 text-white/55">
              {adjustmentMode === "decrease"
                ? "Giảm nợ sẽ trừ bớt số tiền của người đang âm và giảm số tiền người đối ứng sẽ nhận."
                : "Tăng nợ sẽ cộng thêm vào người đang âm và cộng thêm vào số tiền người đối ứng sẽ nhận."}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                className="h-12 rounded-full border border-white/14 text-sm font-semibold text-mist"
                type="button"
                onClick={() => {
                  setAdjustingSettlement(null);
                  setAdjustingBalance(null);
                }}
              >
                Hủy
              </button>
              <button className="h-12 rounded-full bg-coral text-sm font-semibold text-white" type="button" onClick={submitAdjustment}>
                Áp dụng
              </button>
            </div>
          </div>
        </div>
      )}

      {showDetail && (
        <LedgerDetailModal 
          group={group} 
          detail={{ cycle: ledgerCycle, expenses, auditLogs, settlements: [] }} 
          settlements={settlements} 
          currentMemberId={currentMemberId}
          onClose={() => setShowDetail(false)} 
          readonly={false} 
        />
      )}
    </section>
  );
}
