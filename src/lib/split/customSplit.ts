export type SplitParticipant = {
  id: string;
  name: string;
};

export type CustomSplitInput = {
  totalAmount: number;
  participants: SplitParticipant[];
  customAmounts: Record<string, number | undefined>;
};

export type SplitShare = {
  memberId: string;
  amount: number;
  isCustom: boolean;
};

function assertValidMoney(value: number, label: string): void {
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be khanh integer amount`);
  }

  if (value < 0) {
    throw new Error(`${label} must not be negative`);
  }
}

export function calculateCustomSplit(input: CustomSplitInput): SplitShare[] {
  const { totalAmount, participants, customAmounts } = input;
  assertValidMoney(totalAmount, "totalAmount");

  if (participants.length === 0) {
    throw new Error("At least one participant is required");
  }

  const participantIds = new Set(participants.map((participant) => participant.id));
  const customByMember = new Map<string, number>();

  for (const [memberId, maybeAmount] of Object.entries(customAmounts)) {
    if (maybeAmount === undefined || maybeAmount === null) {
      continue;
    }

    if (!participantIds.has(memberId)) {
      continue;
    }

    assertValidMoney(maybeAmount, `customAmounts.${memberId}`);
    customByMember.set(memberId, maybeAmount);
  }

  const customTotal = Array.from(customByMember.values()).reduce((sum, amount) => sum + amount, 0);
  if (customTotal > totalAmount) {
    throw new Error("Custom amounts must not exceed totalAmount");
  }

  const autoParticipants = participants.filter((participant) => !customByMember.has(participant.id));
  const remainingAmount = totalAmount - customTotal;

  if (autoParticipants.length === 0 && remainingAmount !== 0) {
    throw new Error("Custom amounts must equal totalAmount when all participants are custom");
  }

  const base = autoParticipants.length > 0 ? Math.floor(remainingAmount / autoParticipants.length) : 0;
  const remainder = autoParticipants.length > 0 ? remainingAmount % autoParticipants.length : 0;
  const autoAmountByMember = new Map<string, number>();

  autoParticipants.forEach((participant, index) => {
    autoAmountByMember.set(participant.id, base + (index < remainder ? 1 : 0));
  });

  const shares = participants.map<SplitShare>((participant) => {
    const customAmount = customByMember.get(participant.id);
    if (customAmount !== undefined) {
      return {
        memberId: participant.id,
        amount: customAmount,
        isCustom: true
      };
    }

    return {
      memberId: participant.id,
      amount: autoAmountByMember.get(participant.id) ?? 0,
      isCustom: false
    };
  });

  const outputTotal = shares.reduce((sum, share) => sum + share.amount, 0);
  if (outputTotal !== totalAmount) {
    throw new Error("Split output total does not match totalAmount");
  }

  return shares;
}
