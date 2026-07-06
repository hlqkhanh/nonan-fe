# Update Plan: MVP Debt Ledger - Local/In-Memory Priority

## Summary
Prioritize the rapid deployment of the debt ledger feature on the current MVP using `localStorage` on the frontend and in-memory storage on the Spring Boot backend. The objective is immediate usability: settlement, archiving, viewing current debt details, debt ledger history page, basic bill/debt CRUD, and a minimal activity log. The production backend with a real database/auth will be documented separately for later implementation.

## MVP Key Changes

### Frontend Data Model
- Extend `frontend/src/types/sharebill.ts`:
  - `LedgerCycle`: debt ledger cycle, including `id`, `groupId`, `status`, `startDate`, `endDate`, `createdAt`, `closedAt`.
  - `LedgerCycleDetail`: cycle + expenses + settlement snapshot + activity log.
  - `SettlementSnapshot`: debt records (A pays B) saved at the time of settlement/archiving.
  - `AuditLogEntry`: temporary actor, action, entity, before/after, timestamp.
- Add `ledgerCycleId` to `Expense`.
- The MVP uses the current group member as a temporary actor, since real auth is not yet available.

### Home Sổ Nợ
- `SettlementPanel` only calculates based on the currently open cycle.
- Add 3 actions:
  - `Chi tiết`: opens a bottom sheet/modal displaying bills by date, who paid the bill, and which members it is split among.
  - `Tất toán`: closes the current cycle with status `SETTLED`, saves the snapshot to history, and creates a new empty cycle.
  - `Lưu trữ`: closes the current cycle with status `ARCHIVED_UNPAID`, saves the unpaid snapshot to history, and creates a new empty cycle.
- After `Tất toán` or `Lưu trữ`, the home screen resets debts to 0 because it only reads from the new cycle.

### Navigation + Page Sổ Nợ
- Add the `Sổ nợ` icon to the bottom navigation using a lucide icon such as `NotebookTabs` or `ReceiptText`.
- Add the `ledger` view in `App.tsx`.
- Page `Sổ nợ` displays:
  - List of all closed cycles and the current cycle.
  - Date range from the first day to the last day of the cycle.
  - Statuses: `Đang mở`, `Đã tất toán`, `Chưa trả`.
  - Detailed view of each cycle: bills, payers, participants, split amounts, and settlement snapshot.
  - Activity log of the cycle.

### CRUD MVP
- Bill:
  - Create bills using the current modal.
  - Add bill editing.
  - Add bill deletion.
  - All edits/deletions only apply to the currently open cycle.
- Debt:
  - Keep the current adjustment but save it to the local state by cycle.
  - Allow manual manual increases/decreases of debt.
  - Record an activity log entry when an adjustment changes.
- Closed cycles are readonly in the MVP to prevent history from deviating from the saved snapshot.

### Local/In-Memory Storage
- The frontend acts as the primary stable source for the MVP:
  - Save `groups`, `expenses`, `ledgerCycles`, `settlementSnapshots`, `auditLogs`, `settlementAdjustments` into localStorage.
- Backend in-memory maintains existing APIs and can add minimal ledger endpoints if a demo server is required.
- If the backend is not running, the app still functions using the localStorage fallback.

## Future Backend Plan Note
Post-MVP, upgrade to the production backend:
- PostgreSQL + Flyway migrations.
- Spring Data JPA entities for users, groups, members, expenses, ledger cycles, settlement snapshots, audit logs.
- JWT email/password auth.
- Server-side audit log fetching the actor from the authenticated user.
- Full CRUD APIs:
  - groups, members, expenses, ledger cycles, settlements, audit logs.
- Production rules:
  - Do not allow modifications to bills belonging to closed cycles.
  - Every mutation records an audit log entry.
  - Settlement snapshot is saved server-side during archive/settle operations.

## Test Plan
- Unit tests:
  - Settlement is only calculated from expenses in the currently open cycle.
  - Archiving a cycle saves an unpaid snapshot and creates a new cycle.
  - Settling a cycle saves a paid snapshot and creates a new cycle.
  - Bills belonging to old cycles do not affect the home screen.
- UI acceptance:
  - Create a bill, verify the current debt ledger updates.
  - View current debt ledger details (`Chi tiết`) to ensure correct bills/payers/participants.
  - Click `Lưu trữ`, verify home resets to 0, and page `Sổ nợ` contains a `Chưa trả` history entry.
  - Click `Tất toán`, verify page `Sổ nợ` contains an `Đã tất toán` history entry.
  - Editing/deleting/creating bills must all appear in the activity log.
- Build:
  - `npm test`
  - `npm run build`
  - Current backend still runs with `mvn test`.

## Assumptions
- MVP prioritizes rapid execution via localStorage/in-memory storage.
- Real auth is not included in the MVP; the temporary audit log actor is the current member.
- PostgreSQL is not included in the MVP, only noted in the backend plan for later implementation.
- Archived/settled cycles are readonly.
- `Lưu trữ` does not carry debt over to the new cycle; it resets the home screen and retains the old records in history.