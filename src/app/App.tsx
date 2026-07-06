import { Home, NotebookTabs, Plus, RefreshCw, User } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  addGroupMember,
  getGroups,
  createGroup,
  createExpense,
  getCurrentLedgerCycle,
  getLedgerCycles,
  markSettlementPaid,
  adjustSettlement,
  settleCurrentLedgerCycle,
  archiveCurrentLedgerCycle,
  updateExpense,
  deleteExpense,
  getBillTemplates,
  saveBillTemplates
} from "../data/api";
import { useAuth } from "../auth/AuthContext";
import { AuthScreen } from "../features/auth/AuthScreen";
import { ExpenseList } from "../features/expenses/ExpenseList";
import { AddExpenseModal } from "../features/expenses/AddExpenseModal";
import { GroupPicker } from "../features/groups/GroupPicker";
import { CreateGroupModal } from "../features/groups/CreateGroupModal";
import { SettlementPanel } from "../features/settlements/SettlementPanel";
import { WeeklyCalendar } from "../features/calendar/WeeklyCalendar";
import { LedgerPage } from "../features/ledger/LedgerPage";
import { ProfilePage } from "../features/profile/ProfilePage";
import type { Expense, Group, Member, Settlement, LedgerCycleDetail, LedgerCycle, BillTitleTemplate } from "../types/sharebill";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function App() {
  const { user, status } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [currentLedgerDetail, setCurrentLedgerDetail] = useState<LedgerCycleDetail | null>(null);
  const [ledgerCycles, setLedgerCycles] = useState<LedgerCycle[]>([]);
  const [billTemplates, setBillTemplates] = useState<BillTitleTemplate[]>([]);

  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | undefined>(undefined);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeView, setActiveView] = useState<"home" | "ledger" | "profile">("home");

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) ?? groups[0],
    [groups, selectedGroupId]
  );
  const currentMemberId = useMemo(
    () => selectedGroup?.members.find((member) => member.userId === user?.id)?.id ?? selectedGroup?.members[0]?.id ?? "",
    [selectedGroup, user]
  );

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
    if (status !== "authed") return;

    async function boot() {
      setIsLoading(true);
      const [nextGroups, templates] = await Promise.all([getGroups(), getBillTemplates()]);
      setGroups(nextGroups);
      setBillTemplates(templates);
      const firstGroupId = nextGroups[0]?.id ?? "";
      setSelectedGroupId(firstGroupId);
      if (firstGroupId) {
        const [detail, cycles] = await Promise.all([
          getCurrentLedgerCycle(firstGroupId),
          getLedgerCycles(firstGroupId)
        ]);
        setCurrentLedgerDetail(detail);
        setLedgerCycles(cycles);
      }
      setIsLoading(false);
    }

    void boot();
  }, [status]);

  async function handleSaveBillTemplates(labels: string[]) {
    const updated = await saveBillTemplates(labels);
    setBillTemplates(updated);
  }

  async function handleGroupChange(groupId: string) {
    setSelectedGroupId(groupId);
    await refresh(groupId);
  }

  async function handleCreateGroup(name: string, memberNames: string[]) {
    const group = await createGroup(name);
    for (const memberName of memberNames) {
      await addGroupMember(group.id, { id: crypto.randomUUID(), name: memberName });
    }
    const nextGroups = await getGroups();
    setGroups(nextGroups);
    setSelectedGroupId(group.id);
    await refresh(group.id);
    setShowCreateGroup(false);
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

  if (status === "loading") {
    return (
      <main className="app-shell grid min-h-screen place-items-center text-sm text-white/45">
        Đang tải ShareBill...
      </main>
    );
  }

  if (status === "anon") {
    return <AuthScreen />;
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
            title="Tạo nhóm mới"
            onClick={() => setShowCreateGroup(true)}
          >
            <Plus className="h-4 w-4 text-white/65" />
          </button>
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

      {isLoading ? (
        <div className="grid min-h-[70vh] place-items-center text-sm text-white/45">Đang tải ShareBill...</div>
      ) : !selectedGroup ? (
        <div className="grid min-h-[70vh] place-items-center px-6 text-center">
          <div>
            <p className="mb-4 text-sm text-white/55">Bạn chưa có nhóm nào.</p>
            <button
              className="h-12 rounded-full bg-coral px-6 font-semibold text-white"
              type="button"
              onClick={() => setShowCreateGroup(true)}
            >
              Tạo nhóm đầu tiên
            </button>
          </div>
        </div>
      ) : !currentLedgerDetail ? (
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
                onOpenDetail={() => { /* handled inside SettlementPanel */ }}
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
            <ProfilePage billTemplates={billTemplates} onSaveBillTemplates={handleSaveBillTemplates} />
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
              className="grid h-[60px] w-[60px] place-items-center rounded-full border-[6px] border-ink bg-mist text-ink shadow-lg shadow-coral/10 transition-transform active:scale-95 disabled:opacity-50"
              type="button"
              title="Tạo Bill Mới"
              disabled={!selectedGroup}
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
          titleBadges={billTemplates.map((template) => template.label)}
          onClose={() => { setShowAddExpense(false); setEditingExpense(undefined); }}
          onCreate={handleCreateOrUpdateExpense}
          onAddMember={handleAddMember}
        />
      )}

      {showCreateGroup && (
        <CreateGroupModal
          onClose={() => setShowCreateGroup(false)}
          onCreate={handleCreateGroup}
        />
      )}
    </main>
  );
}
