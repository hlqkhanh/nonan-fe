import type { Expense, Settlement } from "../../types/sharebill.js";

export function calculateSettlements(expenses: Expense[], paidSettlementIds = new Set<string>()): Settlement[] {
  const netByMember = new Map<string, number>();

  for (const expense of expenses) {
    for (const payer of expense.payers) {
      netByMember.set(payer.memberId, (netByMember.get(payer.memberId) ?? 0) + payer.amount);
    }

    for (const participant of expense.participants) {
      netByMember.set(participant.memberId, (netByMember.get(participant.memberId) ?? 0) - participant.amount);
    }
  }

  const debtors = Array.from(netByMember.entries())
    .filter(([, net]) => net < 0)
    .map(([memberId, net]) => ({ memberId, amount: -net }));
  const creditors = Array.from(netByMember.entries())
    .filter(([, net]) => net > 0)
    .map(([memberId, net]) => ({ memberId, amount: net }));

  const settlements: Settlement[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amount = Math.min(debtor.amount, creditor.amount);

    if (amount > 0) {
      const id = `${debtor.memberId}->${creditor.memberId}:${amount}`;
      const pairId = `${debtor.memberId}->${creditor.memberId}`;
      settlements.push({
        id,
        fromMemberId: debtor.memberId,
        toMemberId: creditor.memberId,
        amount,
        paid: paidSettlementIds.has(id) || paidSettlementIds.has(pairId)
      });
    }

    debtor.amount -= amount;
    creditor.amount -= amount;

    if (debtor.amount === 0) debtorIndex += 1;
    if (creditor.amount === 0) creditorIndex += 1;
  }

  return settlements;
}
