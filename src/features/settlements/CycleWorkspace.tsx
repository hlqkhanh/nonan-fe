import { Plus } from "lucide-react";
import { useState } from "react";
import type { AuditLogEntry, Expense, LedgerCycleDetail } from "../../types/sharebill";
import type { ParticipantMap } from "../../lib/participants";
import { mergeParticipantMembers, participantName } from "../../lib/participants";
import { ExpenseList } from "../expenses/ExpenseList";
import { SettlementPanel } from "./SettlementPanel";

type CycleWorkspaceProps = {
  detail: LedgerCycleDetail;
  currentMemberId: string;
  participantMap: ParticipantMap;
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

type WorkspaceTab = "ledger" | "bills" | "log";

/**
 * The full set of interactions available for a ledger cycle — mark
 * paid/adjust/tất toán/lưu trữ/hủy tất toán, edit/delete bills, and the
 * activity log. Shared between the home screen (App.tsx, for the viewer's
 * active cycle) and the Sổ nợ tab's cycle detail modal, so both surfaces
 * offer identical functionality (Issue 2).
 */
export function CycleWorkspace({
  detail,
  currentMemberId,
  participantMap,
  readonly,
  onMarkPaid,
  onAdjustSettlement,
  onEditExpense,
  onDeleteExpense,
  onAddExpense,
  onSettleLedger,
  onArchiveLedger,
  onReopenLedger
}: CycleWorkspaceProps) {
  const [tab, setTab] = useState<WorkspaceTab>("ledger");

  const mergedParticipantMap = mergeParticipantMembers(participantMap, detail.members);
  const sortedExpenses = [...detail.expenses].sort((a, b) => b.paidDate.localeCompare(a.paidDate));

  return (
    <section>
      <div className="mb-3 flex items-center justify-between px-4 pt-4">
        <div className="grid grid-cols-3 gap-1 rounded-[10px] bg-white/[0.05] p-1">
          {(
            [
              { id: "ledger" as const, label: "Sổ nợ" },
              { id: "bills" as const, label: "Bill" },
              { id: "log" as const, label: "Log" }
            ]
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              className={`h-9 rounded-[8px] px-3 text-xs font-semibold ${tab === item.id ? "bg-mist text-ink" : "text-white/56"}`}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        {!readonly && (
          <button
            type="button"
            className="flex h-9 shrink-0 items-center gap-1 rounded-[8px] bg-coral px-3 text-xs font-semibold text-white"
            onClick={onAddExpense}
          >
            <Plus className="h-3.5 w-3.5" />
            Thêm bill
          </button>
        )}
      </div>

      {tab === "ledger" && (
        <SettlementPanel
          participantMap={mergedParticipantMap}
          ledgerCycle={detail.cycle}
          expenses={detail.expenses}
          auditLogs={detail.auditLogs}
          members={detail.members}
          settlements={detail.settlements}
          currentMemberId={currentMemberId}
          onMarkPaid={onMarkPaid}
          onAdjustSettlement={onAdjustSettlement}
          onSettleLedger={onSettleLedger}
          onArchiveLedger={onArchiveLedger}
          onReopenLedger={onReopenLedger}
        />
      )}

      {tab === "bills" && (
        <ExpenseListAll
          expenses={sortedExpenses}
          readonly={readonly}
          onEditExpense={onEditExpense}
          onDeleteExpense={onDeleteExpense}
        />
      )}

      {tab === "log" && <ActivityLog auditLogs={detail.auditLogs} participantMap={mergedParticipantMap} />}
    </section>
  );
}

// ExpenseList filters by an exact selectedDate — the workspace's "Bill" tab
// shows every bill in the cycle instead, so we reuse ExpenseList once per
// distinct date rather than re-implement its row markup.
function ExpenseListAll({
  expenses,
  readonly,
  onEditExpense,
  onDeleteExpense
}: {
  expenses: Expense[];
  readonly: boolean;
  onEditExpense: (expense: Expense) => void;
  onDeleteExpense: (expenseId: string) => Promise<void>;
}) {
  if (expenses.length === 0) {
    return (
      <div className="mx-4 rounded-[8px] border border-dashed border-white/14 p-4 text-sm text-white/48">
        Chưa có bill nào trong khoản nợ này.
      </div>
    );
  }

  const dates = Array.from(new Set(expenses.map((expense) => expense.paidDate.slice(0, 10))));

  return (
    <div className="space-y-1">
      {dates.map((date) => (
        <ExpenseList
          key={date}
          expenses={expenses}
          selectedDate={date}
          readonly={readonly}
          onEditExpense={onEditExpense}
          onDeleteExpense={onDeleteExpense}
        />
      ))}
    </div>
  );
}

function ActivityLog({ auditLogs, participantMap }: { auditLogs: AuditLogEntry[]; participantMap: ParticipantMap }) {
  return (
    <div className="space-y-3 px-4 pb-28 pl-6">
      {auditLogs.length === 0 ? (
        <p className="text-sm text-white/50">Không có hoạt động.</p>
      ) : (
        [...auditLogs].reverse().map((log) => {
          const actorName = participantName(participantMap, `user:${log.ownerUserId}`);
          return (
            <div key={log.id} className="relative border-l border-white/10 pb-3 pl-4 last:border-0 last:pb-0">
              <div className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full border-2 border-ink bg-blue-400"></div>
              <p className="text-xs font-semibold text-mist">{actorName}</p>
              <p className="text-sm text-white/80">{log.summary}</p>
              <p className="text-xs text-white/40">{new Date(log.createdAt).toLocaleString("vi-VN")}</p>
            </div>
          );
        })
      )}
    </div>
  );
}
