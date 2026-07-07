import { Home, NotebookTabs, Plus, RefreshCw, User as UserIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
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
  saveBillTemplates,
  getFriends,
  getContacts,
  getGroups
} from "../data/api";
import { useAuth } from "../auth/AuthContext";
import { AuthScreen } from "../features/auth/AuthScreen";
import { ExpenseList } from "../features/expenses/ExpenseList";
import { AddExpenseModal } from "../features/expenses/AddExpenseModal";
import { SettlementPanel } from "../features/settlements/SettlementPanel";
import { WeeklyCalendar } from "../features/calendar/WeeklyCalendar";
import { LedgerPage } from "../features/ledger/LedgerPage";
import { ProfilePage } from "../features/profile/ProfilePage";
import { buildParticipantMap } from "../lib/participants";
import type { Contact, Expense, Friend, Group, Settlement, LedgerCycleDetail, LedgerCycle, BillTitleTemplate } from "../types/sharebill";

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

  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [activeView, setActiveView] = useState<"home" | "ledger" | "profile">("home");

  const currentMemberId = user ? `user:${user.id}` : "";
  const participantMap = useMemo(() => buildParticipantMap(user, friends, contacts, groups), [user, friends, contacts, groups]);

  async function refresh() {
    const [detail, cycles] = await Promise.all([getCurrentLedgerCycle(), getLedgerCycles()]);
    setCurrentLedgerDetail(detail);
    setLedgerCycles(cycles);
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
    setSelectedDate(expense.paidDate);
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

  async function handleMarkPaid(settlementId: string) {
    if (!currentLedgerDetail) return;
    await markSettlementPaid(currentLedgerDetail.cycle.id, settlementId);
    await refresh();
  }

  async function handleAdjustSettlement(settlementId: string, deltaAmount: number) {
    if (!currentLedgerDetail) return;
    await adjustSettlement(currentLedgerDetail.cycle.id, settlementId, deltaAmount);
    await refresh();
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
            <p className="truncate text-sm font-semibold text-mist">Sổ nợ của tôi</p>
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
              <WeeklyCalendar expenses={currentLedgerDetail.expenses} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
              <ExpenseList
                expenses={currentLedgerDetail.expenses}
                selectedDate={selectedDate}
                onEditExpense={(e) => { setEditingExpense(e); setShowAddExpense(true); }}
                onDeleteExpense={handleDeleteExpense}
              />
              <SettlementPanel
                participantMap={participantMap}
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
                    await settleCurrentLedgerCycle();
                    await refresh();
                  }
                }}
                onArchiveLedger={async () => {
                  if (confirm("Lưu trữ khoản nợ chưa trả và bắt đầu sổ nợ mới?")) {
                    await archiveCurrentLedgerCycle();
                    await refresh();
                  }
                }}
              />
            </>
          )}

          {activeView === "ledger" && (
            <LedgerPage
              participantMap={participantMap}
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
              <UserIcon className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>

      {showAddExpense && user && (
        <AddExpenseModal
          initialExpense={editingExpense}
          mode={editingExpense ? "edit" : "create"}
          titleBadges={billTemplates.map((template) => template.label)}
          currentUser={user}
          friends={friends}
          contacts={contacts}
          groups={groups}
          onContactCreated={handleContactCreated}
          onClose={() => { setShowAddExpense(false); setEditingExpense(undefined); }}
          onCreate={handleCreateOrUpdateExpense}
        />
      )}
    </main>
  );
}
