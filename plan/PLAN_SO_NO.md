# Plan Triển Khai Sổ Nợ, Lưu Trữ, Lịch Sử Và Audit Log

## Summary
Triển khai lại “sổ nợ” từ trạng thái tính động/localStorage thành hệ thống backend có PostgreSQL, JWT auth, ledger cycle, lịch sử chi tiết và audit log. Trang chủ chỉ hiển thị chu kỳ sổ nợ hiện tại; nút `Tất toán` đóng chu kỳ với trạng thái đã trả, nút `Lưu trữ` đóng chu kỳ chưa trả và reset home về chu kỳ mới. Page `Sổ nợ` trong navigation bar hiển thị toàn bộ lịch sử các chu kỳ, chi tiết bill, người trả, người chia, settlement và activity log.

## Key Changes

### Backend + Database
- Thêm dependencies: Spring Data JPA, Spring Security, JWT library, PostgreSQL driver, Flyway.
- Cấu hình PostgreSQL qua env:
  - `SPRING_DATASOURCE_URL`
  - `SPRING_DATASOURCE_USERNAME`
  - `SPRING_DATASOURCE_PASSWORD`
  - `JWT_SECRET`
- Thêm Flyway migrations cho các bảng chính:
  - `users`: email, password hash, display name.
  - `groups`, `group_members`.
  - `expenses`, `expense_payers`, `expense_participants`.
  - `ledger_cycles`: `OPEN | ARCHIVED_UNPAID | SETTLED`, `start_date`, `end_date`, `closed_at`, `closed_by_user_id`.
  - `ledger_cycle_expenses`: gắn bill vào chu kỳ.
  - `settlement_snapshots`: snapshot khoản A trả B khi đóng/tất toán chu kỳ.
  - `audit_logs`: actor, action, entity type/id, before/after JSON, timestamp.
- Mỗi group luôn có đúng một `OPEN` ledger cycle. Khi tạo bill mới, bill mặc định thuộc cycle đang mở.

### Auth + Audit
- Thêm auth email/password bằng JWT:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `GET /api/auth/me`
- Frontend lưu JWT và gửi `Authorization: Bearer <token>`.
- Mọi mutation server-side ghi audit log:
  - create/update/delete group.
  - create/update/delete member.
  - create/update/delete bill.
  - create/update/delete payer/participant share.
  - mark settlement paid/unpaid.
  - adjust settlement/manual debt.
  - settle ledger cycle.
  - archive ledger cycle.
- Audit log lấy actor từ JWT user, không lấy từ client input.

### Ledger APIs
- Thêm API sổ nợ:
  - `GET /api/groups/{groupId}/ledger/current`
  - `GET /api/groups/{groupId}/ledger/cycles`
  - `GET /api/groups/{groupId}/ledger/cycles/{cycleId}`
  - `POST /api/groups/{groupId}/ledger/current/settle`
  - `POST /api/groups/{groupId}/ledger/current/archive`
  - `GET /api/groups/{groupId}/ledger/cycles/{cycleId}/activity`
- `settle`: đóng cycle hiện tại với status `SETTLED`, snapshot settlements hiện tại với `paid=true`, tạo cycle mới rỗng.
- `archive`: đóng cycle hiện tại với status `ARCHIVED_UNPAID`, snapshot settlements hiện tại với `paid=false`, tạo cycle mới rỗng.
- Bill trong cycle đã đóng là readonly trong UI lịch sử ở version này.

### CRUD APIs
- Chuẩn hóa CRUD thay cho create-only hiện tại:
  - `GET/POST/PATCH/DELETE /api/groups`
  - `GET/POST/PATCH/DELETE /api/groups/{groupId}/members`
  - `GET/POST/PATCH/DELETE /api/groups/{groupId}/expenses`
  - `GET/PATCH/DELETE /api/groups/{groupId}/expenses/{expenseId}`
- Giữ rule tiền là integer VND.
- Validate:
  - tổng payer amount bằng total bill.
  - tổng participant share bằng total bill.
  - payer/member/participant phải thuộc group.
  - không cho sửa/xóa bill thuộc ledger cycle đã đóng.
  - không cho archive/settle cycle rỗng nếu không có expense và settlement.

### Frontend
- Thêm navigation item `Sổ nợ` bằng lucide icon phù hợp như `NotebookTabs` hoặc `ReceiptText`.
- Tách route/view tối thiểu bằng state trong `App.tsx`:
  - `home`
  - `ledger`
  - future `profile`
- Home:
  - `SettlementPanel` hiển thị sổ nợ hiện tại.
  - Thêm nút `Chi tiết`, `Tất toán`, `Lưu trữ`.
  - `Chi tiết` mở bottom sheet/modal liệt kê bill theo ngày: bill nào, ai trả, split cho member nào.
  - `Tất toán` gọi settle API, refresh home về cycle mới.
  - `Lưu trữ` gọi archive API, refresh home về cycle mới.
- Page `Sổ nợ`:
  - Danh sách ledger cycles, có status `Đã tất toán` hoặc `Chưa trả`.
  - Hiển thị khoảng ngày từ `startDate` đến `endDate`.
  - Detail từng cycle gồm expenses, payers, participants, settlement snapshot và activity log.
  - Có filter/tab: `Tất cả`, `Chưa trả`, `Đã tất toán`.
- CRUD UI:
  - Bill: tạo/sửa/xóa từ modal hiện có, mở rộng thêm edit/delete.
  - Group/member: thêm màn quản lý đơn giản hoặc modal trong group picker.
  - Ledger cycle: cho tạo cycle mới chỉ qua archive/settle tự động; không cho sửa cycle đã đóng ngoài action trạng thái đã định nghĩa.

### Data Model Frontend
- Mở rộng types:
  - `User`
  - `LedgerCycle`
  - `LedgerCycleDetail`
  - `SettlementSnapshot`
  - `AuditLogEntry`
- `Expense` thêm `ledgerCycleId`.
- `Settlement` hiện tại dùng cho cycle mở; `SettlementSnapshot` dùng cho lịch sử đã đóng.
- Xóa dần localStorage paid/adjustment cũ; trạng thái authoritative nằm ở backend/PostgreSQL.

## Test Plan
- Backend unit tests:
  - settlement calculator giữ đúng logic hiện tại.
  - validate expense payer/share totals.
  - settle cycle tạo snapshot paid và cycle mới.
  - archive cycle tạo snapshot unpaid và cycle mới.
  - không sửa/xóa bill của cycle đã đóng.
  - audit log được ghi cho mọi mutation chính.
- Backend integration tests:
  - auth register/login/me.
  - CRUD bill/group/member với JWT.
  - request không JWT bị reject.
  - user không thuộc group không được thao tác group đó.
- Frontend tests/build:
  - `npm test`
  - `npm run build`
  - kiểm tra home reset sau settle/archive.
  - kiểm tra ledger page hiển thị lịch sử, detail bill, payer, participants, settlement snapshot, activity log.
- Manual acceptance:
  - tạo bill, thấy sổ nợ hiện tại thay đổi.
  - xem chi tiết sổ nợ hiện tại đúng ngày/bill/payer/split.
  - bấm `Lưu trữ`, home về 0, page sổ nợ có cycle `Chưa trả`.
  - tạo bill mới không lẫn với cycle cũ.
  - bấm `Tất toán`, page sổ nợ có cycle `Đã tất toán`.
  - sửa/xóa/tạo bill đều xuất hiện trong activity log với đúng user.

## Assumptions
- Database chọn PostgreSQL.
- Auth chọn JWT email/password.
- Audit actor lấy từ authenticated user.
- Bill trong chu kỳ đã `Lưu trữ` hoặc `Tất toán` là readonly ở version đầu.
- `Lưu trữ` không chuyển số dư chưa trả sang cycle mới; nó chỉ đóng snapshot cũ và reset sổ nợ hiện tại về 0.
- Tiền tiếp tục lưu bằng integer VND.
