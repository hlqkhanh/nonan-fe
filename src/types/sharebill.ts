export type User = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
};

export type BillTitleTemplate = {
  id: string;
  label: string;
  position: number;
};

export type Friend = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  isFavorite: boolean;
};

export type FriendRequest = {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  createdAt: string;
};

export type FriendRequests = {
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
};

export type FriendRelationship = "none" | "friend" | "pending_outgoing" | "pending_incoming";

export type FriendSearchResult = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  relationship: FriendRelationship;
};

export type Contact = {
  id: string;
  name: string;
  avatarUrl?: string;
  isFavorite: boolean;
};

export type FavoriteTargetType = "user" | "contact";

// A participant is anyone who can pay for or share an expense: the current
// user, a friend (both have accounts -> "user:<id>"), or a contact
// (account-less -> "contact:<id>").
export type ParticipantType = "user" | "contact";

export type Participant = {
  participantId: string;
  name: string;
  avatarUrl?: string;
  type: ParticipantType;
};

export type GroupMember = Participant;

export type Group = {
  id: string;
  name: string;
  members: GroupMember[];
};

export type PayerContribution = {
  memberId: string;
  amount: number;
  name?: string;
  avatarUrl?: string;
};

export type ParticipantShare = {
  memberId: string;
  amount: number;
  isCustom: boolean;
  memberName?: string;
  avatarUrl?: string;
};

export type SplitMode = "equal" | "custom";

export type Expense = {
  id: string;
  title: string;
  totalAmount: number;
  paidDate: string;
  imageUrl?: string;
  payers: PayerContribution[];
  participants: ParticipantShare[];
  splitMode: SplitMode;
  ledgerCycleId?: string;
};

export type Settlement = {
  id: string;
  fromMemberId: string;
  toMemberId: string;
  amount: number;
  paid: boolean;
};

export type LedgerCycleStatus = "open" | "settled" | "archived_unpaid";

export type LedgerCycle = {
  id: string;
  ownerUserId: string;
  status: LedgerCycleStatus;
  startDate: string;
  endDate?: string;
  createdAt: string;
  closedAt?: string;
  closedByUserId?: string;
};

export type SettlementSnapshot = {
  id: string;
  ledgerCycleId: string;
  fromMemberId: string;
  toMemberId: string;
  amount: number;
  paid: boolean;
};

export type AuditAction =
  | "ledger.settled"
  | "ledger.archived"
  | "expense.created"
  | "expense.updated"
  | "expense.deleted"
  | "settlement.adjusted"
  | "settlement.marked_paid"
  | "settlement.marked_unpaid";

export type AuditLogEntry = {
  id: string;
  ownerUserId: string;
  ledgerCycleId?: string;
  action: AuditAction;
  entityType: "ledger_cycle" | "expense" | "settlement";
  entityId: string;
  summary: string;
  before?: unknown;
  after?: unknown;
  createdAt: string;
};

export type LedgerCycleDetail = {
  cycle: LedgerCycle;
  expenses: Expense[];
  settlements: SettlementSnapshot[];
  auditLogs: AuditLogEntry[];
};
