import type { SplitParticipant, SplitShare } from "./customSplit.js";

export function calculateEqualSplit(totalAmount: number, participants: SplitParticipant[]): SplitShare[] {
  if (!Number.isInteger(totalAmount) || totalAmount < 0) {
    throw new Error("totalAmount must be a non-negative integer");
  }

  if (participants.length === 0) {
    throw new Error("At least one participant is required");
  }

  const base = Math.floor(totalAmount / participants.length);
  const remainder = totalAmount % participants.length;

  return participants.map((participant, index) => ({
    memberId: participant.id,
    amount: base + (index < remainder ? 1 : 0),
    isCustom: false
  }));
}
