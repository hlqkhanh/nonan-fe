import type { Expense, Group, Member, Settlement, LedgerCycle, SettlementSnapshot, AuditLogEntry, LedgerCycleDetail, LedgerCycleStatus, AuditAction } from "../types/sharebill";
import { seedExpenses, seedGroups } from "./seed";
import { calculateSettlements } from "../lib/split/settlements";

const STORAGE_KEY = "sharebill.mvp.v1";
const LOCAL_MEMBERS_KEY = "sharebill.localMembers.v1";

type LocalState = {
  groups: Group[];
  expenses: Expense[];
  paidSettlementIds: string[];
  ledgerCycles: LedgerCycle[];
  settlementSnapshots: SettlementSnapshot[];
  auditLogs: AuditLogEntry[];
  settlementAdjustmentsByCycle: Record<string, Record<string, number>>;
};

export function nowIso(): string {
  return new Date().toISOString();
}

export function todayIso(): string {
  return nowIso().slice(0, 10);
}

export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).substring(2, 9)}`;
}

function readLocalState(): LocalState {
  const stored = localStorage.getItem(STORAGE_KEY);
  let state: LocalState;

  if (stored) {
    state = JSON.parse(stored) as LocalState;
  } else {
    state = {
      groups: seedGroups,
      expenses: seedExpenses,
      paidSettlementIds: [],
      ledgerCycles: [],
      settlementSnapshots: [],
      auditLogs: [],
      settlementAdjustmentsByCycle: {}
    };
  }

  let needsSave = false;

  if (!state.ledgerCycles) { state.ledgerCycles = []; needsSave = true; }
  if (!state.settlementSnapshots) { state.settlementSnapshots = []; needsSave = true; }
  if (!state.auditLogs) { state.auditLogs = []; needsSave = true; }
  if (!state.settlementAdjustmentsByCycle) { state.settlementAdjustmentsByCycle = {}; needsSave = true; }

  const groupsToMigrate = new Set<string>();
  for (const expense of state.expenses) {
    if (!expense.ledgerCycleId) {
      groupsToMigrate.add(expense.groupId);
    }
  }

  for (const groupId of groupsToMigrate) {
    let cycle = state.ledgerCycles.find(c => c.groupId === groupId && c.status === "open");
    if (!cycle) {
      cycle = {
        id: newId("cycle"),
        groupId,
        status: "open",
        startDate: state.expenses.filter(e => e.groupId === groupId).reduce((min, e) => e.paidDate < min ? e.paidDate : min, todayIso()) || todayIso(),
        createdAt: nowIso()
      };
      state.ledgerCycles.push(cycle);
      needsSave = true;
    }

    const oldAdjustmentsStr = localStorage.getItem("sharebill.settlementAdjustments.v1");
    if (oldAdjustmentsStr && !state.settlementAdjustmentsByCycle[cycle.id]) {
      state.settlementAdjustmentsByCycle[cycle.id] = JSON.parse(oldAdjustmentsStr);
      needsSave = true;
    }

    for (const expense of state.expenses) {
      if (expense.groupId === groupId && !expense.ledgerCycleId) {
        expense.ledgerCycleId = cycle.id;
        needsSave = true;
      }
    }
  }

  if (needsSave) {
    writeLocalState(state);
  }

  return state;
}

function writeLocalState(state: LocalState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function readLocalMembers(): Record<string, Member[]> {
  const stored = localStorage.getItem(LOCAL_MEMBERS_KEY);
  return stored ? (JSON.parse(stored) as Record<string, Member[]>) : {};
}

function writeLocalMember(groupId: string, member: Member): void {
  const localMembers = readLocalMembers();
  localMembers[groupId] = [...(localMembers[groupId] ?? []).filter((item) => item.id !== member.id), member];
  localStorage.setItem(LOCAL_MEMBERS_KEY, JSON.stringify(localMembers));
}

function mergeLocalMembers(groups: Group[]): Group[] {
  const localMembers = readLocalMembers();
  return groups.map((group) => ({
    ...group,
    members: [...group.members, ...(localMembers[group.id] ?? []).filter((member) => !group.members.some((item) => item.id === member.id))]
  }));
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function getGroups(): Promise<Group[]> {
  try {
    return mergeLocalMembers(await fetchJson<Group[]>("/api/groups"));
  } catch {
    return mergeLocalMembers(readLocalState().groups);
  }
}

export async function addGroupMember(groupId: string, member: Member): Promise<Group> {
  writeLocalMember(groupId, member);
  try {
    const updatedGroup = await fetchJson<Group>(`/api/groups/${groupId}/members`, {
      method: "POST",
      body: JSON.stringify(member)
    });
    return mergeLocalMembers([updatedGroup])[0];
  } catch {
    const state = readLocalState();
    const group = state.groups.find((item) => item.id === groupId);
    if (!group) throw new Error(`Group not found: ${groupId}`);

    const updatedGroup = {
      ...group,
      members: [...group.members.filter((item) => item.id !== member.id), member]
    };
    state.groups = state.groups.map((item) => (item.id === groupId ? updatedGroup : item));
    writeLocalState(state);
    return updatedGroup;
  }
}

// ----------------- Ledger API (Local Only for MVP) -----------------

function ensureOpenCycle(state: LocalState, groupId: string): LedgerCycle {
  let cycle = state.ledgerCycles.find(c => c.groupId === groupId && c.status === "open");
  if (!cycle) {
    cycle = {
      id: newId("cycle"),
      groupId,
      status: "open",
      startDate: todayIso(),
      createdAt: nowIso()
    };
    state.ledgerCycles.push(cycle);
  }
  return cycle;
}

function writeAuditLog(state: LocalState, log: Omit<AuditLogEntry, "id" | "createdAt">) {
  state.auditLogs.push({
    ...log,
    id: newId("audit"),
    createdAt: nowIso()
  });
}

export function calculateCycleSettlements(state: LocalState, cycleId: string): Settlement[] {
  const cycleExpenses = state.expenses.filter(e => e.ledgerCycleId === cycleId);
  const baseSettlements = calculateSettlements(cycleExpenses, new Set(state.paidSettlementIds));
  const adjustments = state.settlementAdjustmentsByCycle[cycleId] || {};
  
  const result: Settlement[] = [];
  const handledKeys = new Set<string>();

  for (const s of baseSettlements) {
    const key = `${s.fromMemberId}->${s.toMemberId}`;
    handledKeys.add(key);
    const adj = adjustments[key] || 0;
    const finalAmount = Math.max(0, s.amount + adj);
    if (finalAmount > 0 || s.paid) {
      result.push({ ...s, amount: finalAmount });
    }
  }

  for (const [key, adjAmount] of Object.entries(adjustments)) {
    if (!handledKeys.has(key) && adjAmount > 0) {
      const [from, to] = key.split("->");
      result.push({
        id: key,
        fromMemberId: from,
        toMemberId: to,
        amount: adjAmount,
        paid: state.paidSettlementIds.includes(key)
      });
    }
  }

  return result.filter(s => s.amount > 0 || s.paid);
}

export async function getCurrentLedgerCycle(groupId: string): Promise<LedgerCycleDetail> {
  const state = readLocalState();
  const cycle = ensureOpenCycle(state, groupId);
  writeLocalState(state);

  return {
    cycle,
    expenses: state.expenses.filter(e => e.ledgerCycleId === cycle.id),
    settlements: calculateCycleSettlements(state, cycle.id) as unknown as SettlementSnapshot[], // structure matches
    auditLogs: state.auditLogs.filter(a => a.ledgerCycleId === cycle.id)
  };
}

export async function getLedgerCycles(groupId: string): Promise<LedgerCycle[]> {
  const state = readLocalState();
  return state.ledgerCycles.filter(c => c.groupId === groupId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getLedgerCycleDetail(groupId: string, cycleId: string): Promise<LedgerCycleDetail> {
  const state = readLocalState();
  const cycle = state.ledgerCycles.find(c => c.id === cycleId);
  if (!cycle) throw new Error("Cycle not found");

  if (cycle.status === "open") {
    return getCurrentLedgerCycle(groupId);
  }

  return {
    cycle,
    expenses: state.expenses.filter(e => e.ledgerCycleId === cycleId),
    settlements: state.settlementSnapshots.filter(s => s.ledgerCycleId === cycleId),
    auditLogs: state.auditLogs.filter(a => a.ledgerCycleId === cycleId)
  };
}

async function closeLedgerCycle(groupId: string, actorMemberId: string, status: "settled" | "archived_unpaid"): Promise<LedgerCycleDetail> {
  const state = readLocalState();
  const cycle = ensureOpenCycle(state, groupId);
  
  const settlements = calculateCycleSettlements(state, cycle.id);
  const snapshots: SettlementSnapshot[] = settlements.map(s => ({
    id: newId("snap"),
    ledgerCycleId: cycle.id,
    fromMemberId: s.fromMemberId,
    toMemberId: s.toMemberId,
    amount: s.amount,
    paid: status === "settled"
  }));

  state.settlementSnapshots.push(...snapshots);

  const cycleExpenses = state.expenses.filter(e => e.ledgerCycleId === cycle.id);
  let maxDate = cycle.startDate;
  for (const e of cycleExpenses) {
    if (e.paidDate > maxDate) maxDate = e.paidDate;
  }
  if (todayIso() > maxDate) maxDate = todayIso();

  cycle.status = status;
  cycle.endDate = maxDate;
  cycle.closedAt = nowIso();
  cycle.closedByMemberId = actorMemberId;

  writeAuditLog(state, {
    groupId,
    ledgerCycleId: cycle.id,
    actorMemberId,
    action: status === "settled" ? "ledger.settled" : "ledger.archived",
    entityType: "ledger_cycle",
    entityId: cycle.id,
    summary: status === "settled" ? `Đã tất toán sổ nợ` : `Đã lưu trữ sổ nợ chưa trả`
  });

  const nextCycle: LedgerCycle = {
    id: newId("cycle"),
    groupId,
    status: "open",
    startDate: todayIso(),
    createdAt: nowIso()
  };
  state.ledgerCycles.push(nextCycle);

  writeLocalState(state);
  return getLedgerCycleDetail(groupId, cycle.id);
}

export async function settleCurrentLedgerCycle(groupId: string, actorMemberId: string) {
  return closeLedgerCycle(groupId, actorMemberId, "settled");
}

export async function archiveCurrentLedgerCycle(groupId: string, actorMemberId: string) {
  return closeLedgerCycle(groupId, actorMemberId, "archived_unpaid");
}

// ----------------- Expenses -----------------

export async function getExpenses(groupId: string): Promise<Expense[]> {
  try {
    return await fetchJson<Expense[]>(`/api/groups/${groupId}/expenses`);
  } catch {
    return readLocalState().expenses.filter((expense) => expense.groupId === groupId);
  }
}

export async function createExpense(groupId: string, expense: Expense, actorMemberId: string): Promise<Expense> {
  const state = readLocalState();
  const cycle = ensureOpenCycle(state, groupId);
  
  expense.ledgerCycleId = cycle.id;
  state.expenses = [expense, ...state.expenses.filter((item) => item.id !== expense.id)];
  
  writeAuditLog(state, {
    groupId,
    ledgerCycleId: cycle.id,
    actorMemberId,
    action: "expense.created",
    entityType: "expense",
    entityId: expense.id,
    summary: `Đã tạo bill ${expense.title} ${expense.totalAmount}đ`,
    after: expense
  });

  writeLocalState(state);

  // Try to sync to backend just in case
  try {
    await fetchJson<Expense>(`/api/groups/${groupId}/expenses`, {
      method: "POST",
      body: JSON.stringify(expense)
    });
  } catch {}

  return expense;
}

export async function updateExpense(groupId: string, expenseId: string, expense: Expense, actorMemberId: string): Promise<Expense> {
  const state = readLocalState();
  const index = state.expenses.findIndex(e => e.id === expenseId);
  if (index === -1) throw new Error("Expense not found");
  
  const before = state.expenses[index];
  if (before.ledgerCycleId) {
    const cycle = state.ledgerCycles.find(c => c.id === before.ledgerCycleId);
    if (cycle && cycle.status !== "open") {
      throw new Error("Cannot edit expense in a closed cycle");
    }
  }

  expense.ledgerCycleId = before.ledgerCycleId;
  state.expenses[index] = expense;

  writeAuditLog(state, {
    groupId,
    ledgerCycleId: before.ledgerCycleId,
    actorMemberId,
    action: "expense.updated",
    entityType: "expense",
    entityId: expense.id,
    summary: `Đã sửa bill ${expense.title}`,
    before,
    after: expense
  });

  writeLocalState(state);
  return expense;
}

export async function deleteExpense(groupId: string, expenseId: string, actorMemberId: string): Promise<void> {
  const state = readLocalState();
  const index = state.expenses.findIndex(e => e.id === expenseId);
  if (index === -1) throw new Error("Expense not found");
  
  const before = state.expenses[index];
  if (before.ledgerCycleId) {
    const cycle = state.ledgerCycles.find(c => c.id === before.ledgerCycleId);
    if (cycle && cycle.status !== "open") {
      throw new Error("Cannot delete expense in a closed cycle");
    }
  }

  state.expenses.splice(index, 1);

  writeAuditLog(state, {
    groupId,
    ledgerCycleId: before.ledgerCycleId,
    actorMemberId,
    action: "expense.deleted",
    entityType: "expense",
    entityId: expenseId,
    summary: `Đã xóa bill ${before.title}`,
    before
  });

  writeLocalState(state);
}

// ----------------- Settlements -----------------

export async function getSettlements(groupId: string): Promise<Settlement[]> {
  try {
    return await fetchJson<Settlement[]>(`/api/groups/${groupId}/settlements`);
  } catch {
    const state = readLocalState();
    return calculateSettlements(
      state.expenses.filter((expense) => expense.groupId === groupId),
      new Set(state.paidSettlementIds)
    );
  }
}

export async function markSettlementPaid(groupId: string, settlementId: string, cycleId: string, actorMemberId: string): Promise<Settlement[]> {
  const state = readLocalState();
  
  state.paidSettlementIds = state.paidSettlementIds.includes(settlementId)
    ? state.paidSettlementIds.filter((id) => id !== settlementId)
    : [...state.paidSettlementIds, settlementId];
  
  writeAuditLog(state, {
    groupId,
    ledgerCycleId: cycleId,
    actorMemberId,
    action: state.paidSettlementIds.includes(settlementId) ? "settlement.marked_paid" : "settlement.marked_unpaid",
    entityType: "settlement",
    entityId: settlementId,
    summary: state.paidSettlementIds.includes(settlementId) ? `Đã đánh dấu khoản nợ là đã trả` : `Đã hoàn tác khoản nợ thành chưa trả`
  });

  writeLocalState(state);
  return calculateCycleSettlements(state, cycleId);
}

export async function adjustSettlement(groupId: string, cycleId: string, settlementId: string, deltaAmount: number, actorMemberId: string): Promise<Settlement[]> {
  const state = readLocalState();
  
  if (!state.settlementAdjustmentsByCycle[cycleId]) {
    state.settlementAdjustmentsByCycle[cycleId] = {};
  }
  
  const currentDelta = state.settlementAdjustmentsByCycle[cycleId][settlementId] || 0;
  state.settlementAdjustmentsByCycle[cycleId][settlementId] = currentDelta + deltaAmount;

  writeAuditLog(state, {
    groupId,
    ledgerCycleId: cycleId,
    actorMemberId,
    action: "settlement.adjusted",
    entityType: "settlement",
    entityId: settlementId,
    summary: `Đã điều chỉnh nợ ${deltaAmount > 0 ? "+" : ""}${deltaAmount}đ`,
    before: { delta: currentDelta },
    after: { delta: state.settlementAdjustmentsByCycle[cycleId][settlementId] }
  });

  writeLocalState(state);
  return calculateCycleSettlements(state, cycleId);
}

export function isSettlementPaid(settlement: Settlement, paidSettlementIds: Set<string>): boolean {
  return paidSettlementIds.has(settlement.id) || paidSettlementIds.has(`${settlement.fromMemberId}->${settlement.toMemberId}`);
}

export async function getLocalPaidSettlementIds(): Promise<Set<string>> {
  return new Set(readLocalState().paidSettlementIds);
}
