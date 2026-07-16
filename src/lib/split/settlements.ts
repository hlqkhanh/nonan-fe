import type { Expense, Settlement } from "../../types/sharebill.js";

interface Balance {
  memberId: string;
  amount: number;
}

interface Debt {
  from: string;
  to: string;
  amount: number;
}

export function calculateSettlements(expenses: Expense[], paidSettlementIds = new Set<string>()): Settlement[] {
  const pairDebt = new Map<string, number>();

  for (const expense of expenses) {
    accumulateExpense(expense, pairDebt);
  }

  const members = new Set<string>();
  for (const key of pairDebt.keys()) {
    const [from, to] = key.split("->");
    members.add(from);
    members.add(to);
  }
  const sortedMembers = Array.from(members).sort(compareIds);

  const debts: Debt[] = [];
  for (let i = 0; i < sortedMembers.length; i++) {
    for (let j = i + 1; j < sortedMembers.length; j++) {
      const x = sortedMembers[i];
      const y = sortedMembers[j];
      const xToY = pairDebt.get(`${x}->${y}`) ?? 0;
      const yToX = pairDebt.get(`${y}->${x}`) ?? 0;
      const net = xToY - yToX;

      if (net > 0) {
        debts.push({ from: x, to: y, amount: net });
      } else if (net < 0) {
        debts.push({ from: y, to: x, amount: -net });
      }
    }
  }

  debts.sort((a, b) => (a.from === b.from ? compareIds(a.to, b.to) : compareIds(a.from, b.from)));

  return debts.map((debt) => {
    const id = `${debt.from}->${debt.to}:${debt.amount}`;
    const pairId = `${debt.from}->${debt.to}`;
    return {
      id,
      fromMemberId: debt.from,
      toMemberId: debt.to,
      amount: debt.amount,
      paid: paidSettlementIds.has(id) || paidSettlementIds.has(pairId)
    };
  });
}

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function accumulateExpense(expense: Expense, pairDebt: Map<string, number>): void {
  const netByMember = new Map<string, number>();

  for (const payer of expense.payers) {
    netByMember.set(payer.memberId, (netByMember.get(payer.memberId) ?? 0) + payer.amount);
  }
  for (const participant of expense.participants) {
    netByMember.set(participant.memberId, (netByMember.get(participant.memberId) ?? 0) - participant.amount);
  }

  const creditors: Balance[] = [];
  const debtors: Balance[] = [];
  for (const [memberId, net] of netByMember.entries()) {
    if (net > 0) {
      creditors.push({ memberId, amount: net });
    } else if (net < 0) {
      debtors.push({ memberId, amount: -net });
    }
  }

  creditors.sort((a, b) => (b.amount === a.amount ? compareIds(a.memberId, b.memberId) : b.amount - a.amount));
  debtors.sort((a, b) => compareIds(a.memberId, b.memberId));

  const totalSurplus = creditors.reduce((sum, creditor) => sum + creditor.amount, 0);
  if (totalSurplus <= 0) {
    return;
  }

  for (const debtor of debtors) {
    const debt = debtor.amount;
    const shares = creditors.map((creditor) => Math.floor((debt * creditor.amount) / totalSurplus));
    const sumShares = shares.reduce((sum, share) => sum + share, 0);
    shares[0] += debt - sumShares;

    creditors.forEach((creditor, i) => {
      if (shares[i] <= 0 || debtor.memberId === creditor.memberId) {
        return;
      }
      const key = `${debtor.memberId}->${creditor.memberId}`;
      pairDebt.set(key, (pairDebt.get(key) ?? 0) + shares[i]);
    });
  }
}
