import { Home, NotebookTabs, Plus, RefreshCw, User } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { 
  addGroupMember, 
  getGroups, 
  createExpense, 
  getCurrentLedgerCycle,
  getLedgerCycles,
  markSettlementPaid,
  adjustSettlement,
  settleCurrentLedgerCycle,
  archiveCurrentLedgerCycle,
  updateExpense,
  deleteExpense
} from "../data/api";
import { ExpenseList } from "../features/expenses/ExpenseList";
import { AddExpenseModal } from "../features/expenses/AddExpenseModal";
import { GroupPicker } from "../features/groups/GroupPicker";
import { SettlementPanel } from "../features/settlements/SettlementPanel";
import { WeeklyCalendar } from "../features/calendar/WeeklyCalendar";
import { LedgerPage } from "../features/ledger/LedgerPage";
import type { Expense, Group, Member, Settlement, LedgerCycleDetail, LedgerCycle } from "../types/sharebill";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function App() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [currentLedgerDetail, setCurrentLedgerDetail] = useState<LedgerCycleDetail | null>(null);
  const [ledgerCycles, setLedgerCycles] = useState<LedgerCycle[]>([]);
  
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [activeView, setActiveView] = useState<"home" | "ledger" | "profile">("home");

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) ?? groups[0],
    [groups, selectedGroupId]
  );
  const currentMemberId = selectedGroup?.members[0]?.id ?? "";

  async function refresh(groupId = selectedGroupId) {
    if (!groupId) return;
    const [detail, cycles] = await Promise.all([
      getCurrentLedgerCycle(groupId),
      getLedgerCycles(groupId)
    ]);
    setCurrentLedgerDetail(detail);
    setLedgerCycles(cycles);
  }

  useEffect(() => {
    async function boot() {
      setIsLoading(true);
      const nextGroups = await getGroups();
      setGroups(nextGroups);
      setSelectedGroupId(nextGroups[0]?.id ?? "");
      if (nextGroups[0]) {
        const [detail, cycles] = await Promise.all([
          getCurrentLedgerCycle(nextGroups[0].id),
          getLedgerCycles(nextGroups[0].id)
        ]);
        setCurrentLedgerDetail(detail);
        setLedgerCycles(cycles);
      }
      setIsLoading(false);
    }

    void boot();
  }, []);

  async function handleGroupChange(groupId: string) {
    setSelectedGroupId(groupId);
    await refresh(groupId);
  }

  async function handleCreateOrUpdateExpense(expense: Expense) {
    if (!selectedGroup) return;
    if (editingExpense) {
      await updateExpense(selectedGroup.id, editingExpense.id, expense, currentMemberId);
    } else {
      await createExpense(selectedGroup.id, expense, currentMemberId);
    }
    setShowAddExpense(false);
    setEditingExpense(undefined);
    setSelectedDate(expense.paidDate);
    await refresh(selectedGroup.id);
  }

  async function handleDeleteExpense(expenseId: string) {
    if (!selectedGroup) return;
    if (confirm("Bạn có chắc muốn xóa bill này?")) {
      await deleteExpense(selectedGroup.id, expenseId, currentMemberId);
      await refresh(selectedGroup.id);
    }
  }

  async function handleAddMember(member: Member) {
    if (!selectedGroup) return member;
    const updatedGroup = await addGroupMember(selectedGroup.id, member);
    setGroups((current) => current.map((group) => (group.id === updatedGroup.id ? updatedGroup : group)));
    return member;
  }

  async function handleMarkPaid(settlementId: string) {
    if (!selectedGroup || !currentLedgerDetail) return;
    await markSettlementPaid(selectedGroup.id, settlementId, currentLedgerDetail.cycle.id, currentMemberId);
    await refresh(selectedGroup.id);
  }

  async function handleAdjustSettlement(settlementId: string, deltaAmount: number) {
    if (!selectedGroup || !currentLedgerDetail) return;
    await adjustSettlement(selectedGroup.id, currentLedgerDetail.cycle.id, settlementId, deltaAmount, currentMemberId);
    await refresh(selectedGroup.id);
  }

  return (
    <main className="app-shell relative overflow-hidden">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-ink/86 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-coral text-xl font-black text-white">
            S
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-[0.18em] text-white/38">ShareBill</p>
            {selectedGroup && (
              <GroupPicker groups={groups} selectedGroupId={selectedGroup.id} onSelectGroup={handleGroupChange} />
            )}
          </div>
          <button
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.06]"
            type="button"
            title="Tải lại"
            onClick={() => refresh()}
          >
            <RefreshCw className="h-4 w-4 text-white/65" />
          </button>
        </div>
      </header>

      {isLoading || !selectedGroup || !currentLedgerDetail ? (
        <div className="grid min-h-[70vh] place-items-center text-sm text-white/45">Đang tải ShareBill...</div>
      ) : (
        <div className="pb-24">
          {activeView === "home" && (
            <>
              <WeeklyCalendar expenses={currentLedgerDetail.expenses} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
              <ExpenseList 
                expenses={currentLedgerDetail.expenses} 
                selectedDate={selectedDate} 
                onEditExpense={(e) => { setEditingExpense(e); setShowAddExpense(true); }}
                onDeleteExpense={handleDeleteExpense}
              />
              <SettlementPanel
                group={selectedGroup}
                ledgerCycle={currentLedgerDetail.cycle}
                expenses={currentLedgerDetail.expenses}
                auditLogs={currentLedgerDetail.auditLogs}
                settlements={currentLedgerDetail.settlements as unknown as Settlement[]}
                currentMemberId={currentMemberId}
                onMarkPaid={handleMarkPaid}
                onAdjustSettlement={handleAdjustSettlement}
                onOpenDetail={() => { /* Wait, maybe handle internally in SettlementPanel or App */ }}
                onSettleLedger={async () => {
                  if (confirm("Tất toán sổ nợ hiện tại và lưu vào lịch sử?")) {
                    await settleCurrentLedgerCycle(selectedGroup.id, currentMemberId);
                    await refresh();
                  }
                }}
                onArchiveLedger={async () => {
                  if (confirm("Lưu trữ khoản nợ chưa trả và bắt đầu sổ nợ mới?")) {
                    await archiveCurrentLedgerCycle(selectedGroup.id, currentMemberId);
                    await refresh();
                  }
                }}
              />
            </>
          )}

          {activeView === "ledger" && (
            <LedgerPage 
              group={selectedGroup}
              cycles={ledgerCycles}
              currentCycleId={currentLedgerDetail.cycle.id}
              currentMemberId={currentMemberId}
            />
          )}

          {activeView === "profile" && (
            <div className="p-4 text-center text-white/50">Tính năng đang phát triển</div>
          )}
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-10 mx-auto w-full max-w-[480px] border-t border-white/10 bg-ink/90 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="relative flex h-[56px] items-center justify-between px-8">
          <button 
            className={`flex flex-col items-center justify-center transition-colors ${activeView === "home" ? "text-mist" : "text-white/40 hover:text-mist"}`}
            onClick={() => setActiveView("home")}
          >
            <Home className="h-6 w-6" />
          </button>

          <div className="absolute left-1/2 top-[-24px] -translate-x-1/2">
            <button
              className="grid h-[60px] w-[60px] place-items-center rounded-full border-[6px] border-ink bg-mist text-ink shadow-lg shadow-coral/10 transition-transform active:scale-95"
              type="button"
              title="Tạo Bill Mới"
              onClick={() => { setEditingExpense(undefined); setShowAddExpense(true); }}
            >
              <Plus className="h-6 w-6" />
            </button>
          </div>

          <div className="flex items-center gap-8 pl-14">
            <button 
              className={`flex flex-col items-center justify-center transition-colors ${activeView === "ledger" ? "text-mist" : "text-white/40 hover:text-mist"}`}
              onClick={() => setActiveView("ledger")}
            >
              <NotebookTabs className="h-6 w-6" />
            </button>

            <button 
              className={`flex flex-col items-center justify-center transition-colors ${activeView === "profile" ? "text-mist" : "text-white/40 hover:text-mist"}`}
              onClick={() => setActiveView("profile")}
            >
              <User className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>

      {showAddExpense && selectedGroup && (
        <AddExpenseModal
          group={selectedGroup}
          initialExpense={editingExpense}
          mode={editingExpense ? "edit" : "create"}
          onClose={() => { setShowAddExpense(false); setEditingExpense(undefined); }}
          onCreate={handleCreateOrUpdateExpense}
          onAddMember={handleAddMember}
        />
      )}
    </main>
  );
}
