import { Home, NotebookTabs, Plus, RefreshCw, User as UserIcon, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  createExpense,
  getCurrentLedgerCycle,
  getLedgerCycles,
  markSettlementPaid,
  adjustSettlement,
  settleLedgerCycle,
  archiveLedgerCycle,
  reopenLedgerCycle,
  updateExpense,
  deleteExpense,
  getBillTemplates,
  saveBillTemplates,
  getFriends,
  getContacts,
  getGroups
} from "../data/api";
import { useAuth } from "../auth/AuthContext";
import { AuthScreen } from "../features/auth/AuthScreen";
import { AddExpenseModal } from "../features/expenses/AddExpenseModal";
import { ExpenseList } from "../features/expenses/ExpenseList";
import { CycleWorkspace } from "../features/settlements/CycleWorkspace";
import { WeeklyCalendar } from "../features/calendar/WeeklyCalendar";
import { LedgerPage } from "../features/ledger/LedgerPage";
import { ProfilePage } from "../features/profile/ProfilePage";
import { buildParticipantMap } from "../lib/participants";
import type {
  Contact,
  Expense,
  Friend,
  Group,
  LedgerCycleDetail,
  LedgerCycle,
  LedgerCycleMemberInfo,
  BillTitleTemplate
} from "../types/sharebill";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function App() {
  const { user, status } = useAuth();
  const [currentLedgerDetail, setCurrentLedgerDetail] = useState<LedgerCycleDetail | null>(null);
  const [ledgerCycles, setLedgerCycles] = useState<LedgerCycle[]>([]);
  const [billTemplates, setBillTemplates] = useState<BillTitleTemplate[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);

  // Grows over time as we fetch cycle details (own + shared-in): every
  // member id (user/contact) the backend has resolved for us, so shared
  // bills referencing non-friend `user:<id>` still render real names.
  const [resolvedMembers, setResolvedMembers] = useState<Record<string, LedgerCycleMemberInfo>>({});

  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | undefined>(undefined);
  // Set when "+ Thêm bill" is triggered from a specific Sổ nợ cycle (rather
  // than the bottom-nav "+", which always targets the home/active cycle).
  const [addExpenseCycleId, setAddExpenseCycleId] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [activeView, setActiveView] = useState<"home" | "ledger" | "profile">("home");

  const currentMemberId = user ? `user:${user.id}` : "";
  const participantMap = useMemo(
    () => buildParticipantMap(user, friends, contacts, groups, resolvedMembers),
    [user, friends, contacts, groups, resolvedMembers]
  );

  function mergeMembers(members: Record<string, LedgerCycleMemberInfo> = {}) {
    setResolvedMembers((current) => ({ ...current, ...members }));
  }

  async function refresh() {
    const [detail, cycles] = await Promise.all([getCurrentLedgerCycle(), getLedgerCycles()]);
    setCurrentLedgerDetail(detail);
    setLedgerCycles(cycles);
    mergeMembers(detail.members);
  }

  async function refreshDirectory() {
    const [nextFriends, nextContacts, nextGroups] = await Promise.all([getFriends(), getContacts(), getGroups()]);
    setFriends(nextFriends);
    setContacts(nextContacts);
    setGroups(nextGroups);
  }

  useEffect(() => {
    if (status !== "authed") return;

    async function boot() {
      setIsLoading(true);
      try {
        const [detail, cycles, templates] = await Promise.all([
          getCurrentLedgerCycle(),
          getLedgerCycles(),
          getBillTemplates().catch(() => [] as BillTitleTemplate[])
        ]);
        setCurrentLedgerDetail(detail);
        setLedgerCycles(cycles);
        setBillTemplates(templates);
        mergeMembers(detail.members);
        await refreshDirectory();
      } catch (err) {
        console.error("Boot failed:", err);
      } finally {
        setIsLoading(false);
      }
    }

    void boot();
  }, [status]);

  async function handleSaveBillTemplates(labels: string[]) {
    const updated = await saveBillTemplates(labels);
    setBillTemplates(updated);
  }

  async function handleCreateOrUpdateExpense(expense: Expense) {
    if (editingExpense) {
      await updateExpense(editingExpense.id, expense);
    } else {
      await createExpense(expense);
    }
    setShowAddExpense(false);
    setEditingExpense(undefined);
    setAddExpenseCycleId(undefined);
    setSelectedDate(expense.paidDate.slice(0, 10));
    await refresh();
  }

  async function handleDeleteExpense(expenseId: string) {
    if (confirm("Bạn có chắc muốn xóa bill này?")) {
      await deleteExpense(expenseId);
      await refresh();
    }
  }

  function handleContactCreated(contact: Contact) {
    setContacts((current) => [...current, contact]);
  }

  function openCreateExpense(cycleId?: string) {
    setEditingExpense(undefined);
    setAddExpenseCycleId(cycleId);
    setShowAddExpense(true);
  }

  function openEditExpense(expense: Expense) {
    setEditingExpense(expense);
    setAddExpenseCycleId(undefined);
    setShowAddExpense(true);
  }

  async function handleMarkPaid(cycleId: string, settlementId: string) {
    await markSettlementPaid(cycleId, settlementId);
    await refresh();
  }

  async function handleAdjustSettlement(cycleId: string, settlementId: string, deltaAmount: number) {
    await adjustSettlement(cycleId, settlementId, deltaAmount);
    await refresh();
  }

  async function handleSettleLedger(cycleId: string) {
    if (confirm("Tất toán sổ nợ này và lưu vào lịch sử?")) {
      await settleLedgerCycle(cycleId);
      await refresh();
    }
  }

  async function handleArchiveLedger(cycleId: string) {
    if (confirm("Lưu trữ khoản nợ chưa trả?")) {
      await archiveLedgerCycle(cycleId);
      await refresh();
    }
  }

  async function handleReopenLedger(cycleId: string) {
    if (confirm("Hủy tất toán và mở lại khoản nợ này?")) {
      await reopenLedgerCycle(cycleId);
      await refresh();
    }
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
            <p className="truncate text-sm font-semibold text-mist">
              {!currentLedgerDetail || currentLedgerDetail.cycle.isOwner
                ? "Sổ nợ của tôi"
                : `Sổ nợ chung với ${currentLedgerDetail.cycle.ownerDisplayName}`}
            </p>
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

      {isLoading || !currentLedgerDetail ? (
        <div className="grid min-h-[70vh] place-items-center text-sm text-white/45">Đang tải ShareBill...</div>
      ) : (
        <div className="pb-24">
          {activeView === "home" && (
            <>
              {!currentLedgerDetail.cycle.isOwner && (
                <div className="mx-4 mt-3 flex items-center gap-2 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/55">
                  <Users className="h-3.5 w-3.5 shrink-0" />
                  Khoản nợ chung — chủ sổ là {currentLedgerDetail.cycle.ownerDisplayName}
                </div>
              )}

              <WeeklyCalendar expenses={currentLedgerDetail.expenses} selectedDate={selectedDate} onSelectDate={setSelectedDate} />

              <ExpenseList
                expenses={currentLedgerDetail.expenses}
                selectedDate={selectedDate}
                readonly={currentLedgerDetail.cycle.status === "settled"}
                onEditExpense={openEditExpense}
                onDeleteExpense={handleDeleteExpense}
              />

              <CycleWorkspace
                detail={currentLedgerDetail}
                currentMemberId={currentMemberId}
                participantMap={participantMap}
                readonly={currentLedgerDetail.cycle.status === "settled"}
                onMarkPaid={(settlementId) => handleMarkPaid(currentLedgerDetail.cycle.id, settlementId)}
                onAdjustSettlement={(settlementId, deltaAmount) =>
                  handleAdjustSettlement(currentLedgerDetail.cycle.id, settlementId, deltaAmount)
                }
                onEditExpense={openEditExpense}
                onDeleteExpense={handleDeleteExpense}
                onAddExpense={() => openCreateExpense(currentLedgerDetail.cycle.id)}
                onSettleLedger={() => handleSettleLedger(currentLedgerDetail.cycle.id)}
                onArchiveLedger={() => handleArchiveLedger(currentLedgerDetail.cycle.id)}
                onReopenLedger={() => handleReopenLedger(currentLedgerDetail.cycle.id)}
              />
            </>
          )}

          {activeView === "ledger" && (
            <LedgerPage
              participantMap={participantMap}
              cycles={ledgerCycles}
              currentMemberId={currentMemberId}
              onCyclesChanged={refresh}
              onMembersResolved={mergeMembers}
              onMarkPaid={handleMarkPaid}
              onAdjustSettlement={handleAdjustSettlement}
              onEditExpense={openEditExpense}
              onDeleteExpense={handleDeleteExpense}
              onAddExpense={openCreateExpense}
              onSettleLedger={handleSettleLedger}
              onArchiveLedger={handleArchiveLedger}
              onReopenLedger={handleReopenLedger}
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
              onClick={() => openCreateExpense()}
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
              <UserIcon className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>

      {showAddExpense && user && (
        <AddExpenseModal
          initialExpense={editingExpense}
          targetCycleId={addExpenseCycleId}
          mode={editingExpense ? "edit" : "create"}
          titleBadges={billTemplates.map((template) => template.label)}
          currentUser={user}
          friends={friends}
          contacts={contacts}
          groups={groups}
          onContactCreated={handleContactCreated}
          onClose={() => { setShowAddExpense(false); setEditingExpense(undefined); setAddExpenseCycleId(undefined); }}
          onCreate={handleCreateOrUpdateExpense}
        />
      )}
    </main>
  );
}
