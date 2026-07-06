# Detailed Implementation Plan: MVP Sổ Nợ Local/In-Memory

## Summary
Triển khai tính năng sổ nợ theo hướng MVP chạy nhanh, ưu tiên frontend `localStorage` và backend Spring Boot in-memory hiện tại. Trang chủ chỉ hiển thị sổ nợ của chu kỳ đang mở. Người dùng có thể xem chi tiết khoản nợ hiện tại, tất toán, lưu trữ, xem lịch sử sổ nợ qua navigation bar, CRUD bill/khoản nợ cơ bản và xem activity log. Ghi chú backend production với database/auth thật được giữ riêng để triển khai sau.

## Current State
- Frontend: React + TypeScript + Vite + Tailwind.
- Backend: Spring Boot REST API in-memory.
- Settlement hiện được tính từ toàn bộ `expenses`.
- Paid/adjustment hiện lưu riêng trong localStorage bằng `sharebill.paidSettlements.v1` và `sharebill.settlementAdjustments.v1`.
- Bottom navigation hiện có Home, nút tạo bill, User.
- Chưa có route thật, auth thật, database thật, ledger history hoặc audit log.

## MVP Data Model

### Update `frontend/src/types/sharebill.ts`
Thêm các type sau:

```ts
export type LedgerCycleStatus = "open" | "settled" | "archived_unpaid";

export type LedgerCycle = {
  id: string;
  groupId: string;
  status: LedgerCycleStatus;
  startDate: string;
  endDate?: string;
  createdAt: string;
  closedAt?: string;
  closedByMemberId?: string;
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
  | "ledger.created"
  | "ledger.settled"
  | "ledger.archived"
  | "expense.created"
  | "expense.updated"
  | "expense.deleted"
  | "settlement.adjusted"
  | "settlement.marked_paid"
  | "settlement.marked_unpaid"
  | "member.created"
  | "group.created"
  | "group.updated"
  | "group.deleted";

export type AuditLogEntry = {
  id: string;
  groupId: string;
  ledgerCycleId?: string;
  actorMemberId: string;
  action: AuditAction;
  entityType: "ledger_cycle" | "expense" | "settlement" | "member" | "group";
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
```

Update `Expense`:
```ts
ledgerCycleId?: string;
```

MVP rule:
- Expense cũ không có `ledgerCycleId` sẽ được migrate tự động vào current open cycle.
- Actor audit tạm thời là `currentMemberId`, lấy từ member đầu tiên của selected group như app đang làm.

## Storage Design

### Replace/extend localStorage state
Trong `frontend/src/data/api.ts`, mở rộng `LocalState`:

```ts
type LocalState = {
  groups: Group[];
  expenses: Expense[];
  paidSettlementIds: string[];
  ledgerCycles: LedgerCycle[];
  settlementSnapshots: SettlementSnapshot[];
  auditLogs: AuditLogEntry[];
  settlementAdjustmentsByCycle: Record<string, Record<string, number>>;
};
```

Giữ key hiện tại `sharebill.mvp.v1`, nhưng migration phải chịu được state cũ:
- Nếu thiếu `ledgerCycles`, tạo một open cycle cho mỗi group có trong state.
- Gán toàn bộ expense không có `ledgerCycleId` vào open cycle của group tương ứng.
- Nếu thiếu `settlementSnapshots`, dùng `[]`.
- Nếu thiếu `auditLogs`, dùng `[]`.
- Nếu thiếu `settlementAdjustmentsByCycle`, migrate từ `sharebill.settlementAdjustments.v1` vào open cycle đầu tiên nếu có.

### Helper functions cần thêm trong `api.ts`
- `nowIso(): string`
- `todayIso(): string`
- `newId(prefix: string): string`
- `getCurrentCycleFromState(state, groupId): LedgerCycle`
- `ensureOpenCycle(state, groupId): LedgerCycle`
- `expensesForCycle(state, cycleId): Expense[]`
- `settlementSnapshotsForCycle(state, cycleId): SettlementSnapshot[]`
- `auditLogsForCycle(state, cycleId): AuditLogEntry[]`
- `writeAuditLog(state, input): AuditLogEntry`
- `createSettlementSnapshots(cycleId, settlements, paid): SettlementSnapshot[]`
- `cycleDateRange(expenses, fallbackStartDate): { startDate; endDate }`

## Frontend API Layer

### Add local-first API methods
In `frontend/src/data/api.ts` add:

```ts
getCurrentLedgerCycle(groupId): Promise<LedgerCycleDetail>
getLedgerCycles(groupId): Promise<LedgerCycle[]>
getLedgerCycleDetail(groupId, cycleId): Promise<LedgerCycleDetail>
settleCurrentLedgerCycle(groupId, actorMemberId): Promise<LedgerCycleDetail>
archiveCurrentLedgerCycle(groupId, actorMemberId): Promise<LedgerCycleDetail>
updateExpense(groupId, expenseId, expense, actorMemberId): Promise<Expense>
deleteExpense(groupId, expenseId, actorMemberId): Promise<void>
adjustSettlement(groupId, ledgerCycleId, settlementId, deltaAmount, actorMemberId): Promise<Settlement[]>
```

Behavior:
- `getCurrentLedgerCycle` returns open cycle detail.
- `settleCurrentLedgerCycle`:
  - calculate visible settlements for current cycle.
  - apply cycle-specific adjustments before snapshot.
  - save snapshots with `paid: true`.
  - close current cycle with status `settled`.
  - set `endDate` from latest expense date or today.
  - write audit action `ledger.settled`.
  - create a new `open` cycle starting today.
- `archiveCurrentLedgerCycle` same as settle, but:
  - status `archived_unpaid`.
  - snapshots have `paid: false`.
  - audit action `ledger.archived`.
- `createExpense`:
  - ensure open cycle.
  - assign `ledgerCycleId`.
  - write audit action `expense.created`.
- `updateExpense`:
  - only allow expense in open cycle.
  - replace expense.
  - write audit action `expense.updated` with before/after.
- `deleteExpense`:
  - only allow expense in open cycle.
  - remove expense.
  - write audit action `expense.deleted`.
- `adjustSettlement`:
  - store adjustment in `settlementAdjustmentsByCycle[cycleId][settlementId]`.
  - write audit action `settlement.adjusted`.

### Keep backend fallback simple
For MVP, do not force full backend ledger implementation. Frontend should still work if backend is unavailable. Since localStorage is the MVP source of truth, ledger APIs can be local-only for now.

## Settlement Logic

### Add cycle-aware calculation
Create or update helper:
- Existing `calculateSettlements(expenses, paidSettlementIds)` remains unchanged.
- Add frontend helper in `api.ts` or `src/lib/split/ledger.ts`:

```ts
calculateCycleSettlements(state, cycleId): Settlement[]
applyCycleAdjustments(settlements, adjustments): Settlement[]
```

Rules:
- Only use expenses with matching `ledgerCycleId`.
- Pair key remains `${fromMemberId}->${toMemberId}` for adjustment.
- Adjusted amount cannot go below 0.
- Settlement with amount 0 is hidden.
- Closed cycle detail must use `SettlementSnapshot`, not recalculated live settlement.

## UI Implementation

### App-level view state
In `frontend/src/app/App.tsx`:
- Add view state:
```ts
type AppView = "home" | "ledger" | "profile";
const [activeView, setActiveView] = useState<AppView>("home");
```
- Home renders current calendar, expense list and settlement panel.
- Ledger renders new `LedgerPage`.
- Profile can remain placeholder or existing user icon with no feature.

### Load cycle-aware data
In `App.tsx`:
- Add state:
```ts
const [currentLedgerDetail, setCurrentLedgerDetail] = useState<LedgerCycleDetail | null>(null);
const [ledgerCycles, setLedgerCycles] = useState<LedgerCycle[]>([]);
```
- `refresh(groupId)` should load:
  - expenses for group.
  - current ledger detail.
  - settlements for current open cycle.
  - ledger cycles.
- Calendar and ExpenseList on home should only receive expenses from current open cycle.
- Existing `visibleSettlements` should be calculated from current cycle only.

### Bottom navigation
Update bottom nav:
- Left: Home.
- Center: Plus create bill.
- Right side split into:
  - `Sổ nợ` icon using `NotebookTabs` or `ReceiptText`.
  - `User` icon.
- Active icon uses `text-mist`; inactive uses `text-white/40`.
- Plus button should still open Add Expense modal from any view, then return or refresh current data.

### SettlementPanel updates
In `frontend/src/features/settlements/SettlementPanel.tsx`:
- Add props:
```ts
ledgerCycle: LedgerCycle;
expenses: Expense[];
auditLogs: AuditLogEntry[];
onOpenDetail: () => void;
onSettleLedger: () => void;
onArchiveLedger: () => void;
```
- Add action row near header:
  - `Chi tiết`
  - `Tất toán`
  - `Lưu trữ`
- Disable `Tất toán` and `Lưu trữ` if no expenses and no settlements.
- `Tất toán` confirmation text: “Tất toán sổ nợ hiện tại và lưu vào lịch sử?”
- `Lưu trữ` confirmation text: “Lưu trữ khoản nợ chưa trả và bắt đầu sổ nợ mới?”
- After action, parent refreshes data.

### Current debt detail modal
Create `frontend/src/features/settlements/LedgerDetailModal.tsx`.
Props:
```ts
group: Group;
detail: LedgerCycleDetail;
settlements: Settlement[] | SettlementSnapshot[];
onClose: () => void;
readonly: boolean;
```

Content:
- Header: status + date range.
- Section `Bill trong sổ nợ`:
  - group by `paidDate`.
  - show bill title, total amount, image if any.
  - show payers: member name + amount.
  - show participants: member name + share amount + split custom/equal.
- Section `Khoản cần trả`:
  - from member, to member, amount, paid/unpaid.
- Section `Activity log`:
  - timestamp, actor name, summary.
- For current open cycle, use live settlements.
- For closed cycle, use snapshots.

### Ledger history page
Create `frontend/src/features/ledger/LedgerPage.tsx`.
Props:
```ts
group: Group;
cycles: LedgerCycle[];
currentCycleId: string;
onOpenCycle: (cycleId: string) => void;
```

Behavior:
- Filter tabs:
  - `Tất cả`
  - `Đang mở`
  - `Chưa trả`
  - `Đã tất toán`
- Each cycle row/card:
  - status badge.
  - date range.
  - total bill count.
  - total amount.
  - unpaid/paid settlement count.
  - button/icon to open detail.
- Use `LedgerDetailModal` for detail.
- Closed cycles are readonly.
- Current cycle detail can share same modal, readonly false.

### Expense CRUD
Update `ExpenseList`:
- Add optional props:
```ts
group: Group;
readonly?: boolean;
onEditExpense?: (expense: Expense) => void;
onDeleteExpense?: (expenseId: string) => void;
```
- For home/current cycle only:
  - show edit icon.
  - show delete icon.
- Delete requires confirmation.
- For readonly/history:
  - no edit/delete controls.

Update `AddExpenseModal`:
- Support edit mode:
```ts
initialExpense?: Expense;
mode?: "create" | "edit";
```
- On submit:
  - create mode calls `onCreate`.
  - edit mode calls `onUpdate`.
- Preserve current validation:
  - title required.
  - payer total equals bill total.
  - participant share total equals bill total.

App handlers:
- `handleCreateExpense(expense)` calls API create with current actor.
- `handleUpdateExpense(expense)` calls API update with current actor.
- `handleDeleteExpense(expenseId)` calls API delete with current actor.
- After each mutation, refresh selected group.

## Audit Log Rules

### Summary text examples
Generate human-readable summaries in API layer:
- `expense.created`: “Khanh tạo bill Lau toi thu sau 320.000đ”
- `expense.updated`: “Khanh sửa bill Cafe sau phim”
- `expense.deleted`: “Khanh xóa bill Cafe sau phim”
- `settlement.adjusted`: “Khanh điều chỉnh khoản nợ Kien -> Khanh +50.000đ”
- `ledger.settled`: “Khanh tất toán sổ nợ”
- `ledger.archived`: “Khanh lưu trữ sổ nợ chưa trả”

### Before/after
- For expense create: `after = expense`.
- For expense update: `before = previousExpense`, `after = nextExpense`.
- For delete: `before = previousExpense`.
- For ledger close: `after = closedCycle`.
- For adjustment: include previous delta and next delta.

## Backend MVP Notes

### Keep current backend working
Do not require backend schema changes for the MVP to run.
- Existing endpoints can remain:
  - `/api/groups`
  - `/api/groups/{groupId}/members`
  - `/api/groups/{groupId}/expenses`
  - `/api/groups/{groupId}/settlements`
- Frontend ledger history can be local-only.

### Optional backend in-memory extension
If implementing backend ledger in MVP, add:
- `LedgerCycleDto`
- `SettlementSnapshotDto`
- `AuditLogDto`
- `LedgerController`
- In-memory fields in `ShareBillService`:
```java
Map<String, List<LedgerCycleDto>> ledgerCyclesByGroup;
Map<String, List<SettlementSnapshotDto>> snapshotsByCycle;
Map<String, List<AuditLogDto>> auditLogsByGroup;
Map<String, Map<String, Long>> settlementAdjustmentsByCycle;
```
Endpoints:
```http
GET  /api/groups/{groupId}/ledger/current
GET  /api/groups/{groupId}/ledger/cycles
GET  /api/groups/{groupId}/ledger/cycles/{cycleId}
POST /api/groups/{groupId}/ledger/current/settle
POST /api/groups/{groupId}/ledger/current/archive
```
But this is optional for MVP; frontend localStorage remains the required deliverable.

## Future Backend Production Plan
Keep this note in `PLAN.md` for later:
- Add PostgreSQL.
- Add Flyway migrations.
- Add Spring Data JPA.
- Add JWT email/password auth.
- Add server-side audit log.
- Make backend the source of truth.
- Add permission model: only group members can view/mutate group data.
- Add immutable closed ledger cycles.
- Add production CRUD endpoints for group/member/bill/ledger/audit.

## Testing Plan

### Unit tests
Frontend:
- `calculateCycleSettlements` only includes expenses from the requested cycle.
- `archiveCurrentLedgerCycle`:
  - closes current cycle as `archived_unpaid`.
  - creates unpaid settlement snapshots.
  - creates new open cycle.
  - old bill no longer appears on home.
- `settleCurrentLedgerCycle`:
  - closes current cycle as `settled`.
  - creates paid settlement snapshots.
  - creates new open cycle.
- `updateExpense` rejects closed-cycle expense.
- `deleteExpense` rejects closed-cycle expense.
- audit log is written for create/update/delete/settle/archive/adjust.

Backend:
- Existing `mvn test` must still pass.

### UI acceptance
- Create bill on home: calendar, expense list and sổ nợ update.
- Click `Chi tiết`: modal shows date, bill, payer, participant shares and settlements.
- Click `Lưu trữ`: home resets to zero, ledger page shows closed cycle with `Chưa trả`.
- Click `Tất toán`: home resets to zero, ledger page shows closed cycle with `Đã tất toán`.
- Edit bill in current cycle: settlement recalculates and audit log records update.
- Delete bill in current cycle: settlement recalculates and audit log records delete.
- Closed cycle detail is readonly.
- Mobile width 360px has no horizontal overflow.
- Desktop keeps max-width 480px shell.

### Commands
Run:
```bash
cd sharebill/frontend
npm test
npm run build

cd ../backend
mvn test
```

## Implementation Order
1. Update types and localStorage migration in `api.ts`.
2. Add ledger helper functions and cycle-aware settlement calculation.
3. Add ledger API functions: current cycle, cycle list, settle, archive, detail.
4. Update App state and refresh flow to use current open cycle.
5. Add `LedgerDetailModal`.
6. Update `SettlementPanel` with detail/settle/archive actions.
7. Add `LedgerPage`.
8. Update bottom navigation.
9. Add Expense edit/delete support.
10. Wire audit log into every MVP mutation.
11. Add focused tests.
12. Run frontend/backend build and tests.
13. Update `PLAN.md` with MVP plan plus future backend note.

## Explicit Defaults
- LocalStorage is source of truth for MVP ledger history.
- Backend production work is planned but not required for this MVP.
- Actor is current group member until auth exists.
- Closed cycles are readonly.
- `Lưu trữ` does not carry debt into the new cycle.
- Settlement snapshots are frozen at close time.
- Current open cycle is recalculated live from editable bills plus adjustments.
