# Plan Cập Nhật: MVP Sổ Nợ Ưu Tiên Local/In-Memory

## Summary
Ưu tiên triển khai nhanh tính năng sổ nợ trên MVP hiện tại bằng dữ liệu `localStorage` phía frontend và in-memory phía Spring Boot backend. Mục tiêu là có thể dùng được ngay: tất toán, lưu trữ, xem chi tiết khoản nợ hiện tại, page lịch sử sổ nợ, CRUD bill/khoản nợ cơ bản và activity log tối thiểu. Phần backend production với database/auth thật sẽ được ghi chú riêng để triển khai sau.

## MVP Key Changes

### Frontend Data Model
- Mở rộng `frontend/src/types/sharebill.ts`:
  - `LedgerCycle`: chu kỳ sổ nợ, gồm `id`, `groupId`, `status`, `startDate`, `endDate`, `createdAt`, `closedAt`.
  - `LedgerCycleDetail`: cycle + expenses + settlement snapshot + activity log.
  - `SettlementSnapshot`: khoản A trả B được lưu tại thời điểm tất toán/lưu trữ.
  - `AuditLogEntry`: actor tạm thời, action, entity, before/after, timestamp.
- `Expense` thêm `ledgerCycleId`.
- MVP dùng actor tạm là current member hiện tại trong group, vì chưa có auth thật.

### Home Sổ Nợ
- `SettlementPanel` chỉ tính trên cycle đang mở.
- Thêm 3 hành động:
  - `Chi tiết`: mở bottom sheet/modal hiển thị bill theo ngày, ai trả bill, chia cho member nào.
  - `Tất toán`: đóng cycle hiện tại với status `SETTLED`, lưu snapshot vào lịch sử, tạo cycle mới rỗng.
  - `Lưu trữ`: đóng cycle hiện tại với status `ARCHIVED_UNPAID`, lưu snapshot chưa trả vào lịch sử, tạo cycle mới rỗng.
- Sau `Tất toán` hoặc `Lưu trữ`, home reset khoản nợ về 0 vì chỉ đọc cycle mới.

### Navigation + Page Sổ Nợ
- Thêm icon `Sổ nợ` vào bottom navigation bằng lucide icon như `NotebookTabs` hoặc `ReceiptText`.
- Thêm view `ledger` trong `App.tsx`.
- Page `Sổ nợ` hiển thị:
  - danh sách toàn bộ cycle đã đóng và cycle hiện tại.
  - khoảng ngày từ ngày đầu đến ngày cuối của cycle.
  - trạng thái `Đang mở`, `Đã tất toán`, `Chưa trả`.
  - detail từng cycle: bill, người trả, người tham gia, số tiền chia, settlement snapshot.
  - activity log của cycle.

### CRUD MVP
- Bill:
  - tạo bill dùng modal hiện tại.
  - thêm sửa bill.
  - thêm xóa bill.
  - mọi sửa/xóa chỉ áp dụng cho cycle đang mở.
- Khoản nợ:
  - giữ adjustment hiện tại nhưng lưu vào local state theo cycle.
  - cho tăng/giảm khoản nợ thủ công.
  - ghi activity log khi adjustment thay đổi.
- Cycle đã đóng là readonly trong MVP để lịch sử không bị lệch snapshot.

### Local/In-Memory Storage
- Frontend là nguồn ổn định chính cho MVP:
  - lưu `groups`, `expenses`, `ledgerCycles`, `settlementSnapshots`, `auditLogs`, `settlementAdjustments` vào localStorage.
- Backend in-memory giữ API hiện có và có thể bổ sung endpoint ledger tối thiểu nếu cần demo server.
- Nếu backend không chạy, app vẫn hoạt động bằng localStorage fallback.

## Future Backend Plan Note
Sau MVP, nâng cấp sang backend production:
- PostgreSQL + Flyway migrations.
- Spring Data JPA entities cho users, groups, members, expenses, ledger cycles, settlement snapshots, audit logs.
- JWT email/password auth.
- Audit log server-side lấy actor từ authenticated user.
- API CRUD đầy đủ:
  - groups, members, expenses, ledger cycles, settlements, audit logs.
- Rule production:
  - không cho sửa bill thuộc cycle đã đóng.
  - mọi mutation ghi audit log.
  - settlement snapshot được lưu server-side khi archive/settle.

## Test Plan
- Unit tests:
  - settlement chỉ tính expense trong cycle đang mở.
  - archive cycle lưu snapshot unpaid và tạo cycle mới.
  - settle cycle lưu snapshot paid và tạo cycle mới.
  - bill thuộc cycle cũ không ảnh hưởng home.
- UI acceptance:
  - tạo bill, thấy sổ nợ hiện tại cập nhật.
  - xem chi tiết sổ nợ hiện tại đúng bill/payer/participants.
  - bấm `Lưu trữ`, home reset về 0, page sổ nợ có lịch sử `Chưa trả`.
  - bấm `Tất toán`, page sổ nợ có lịch sử `Đã tất toán`.
  - sửa/xóa/tạo bill đều xuất hiện trong activity log.
- Build:
  - `npm test`
  - `npm run build`
  - backend hiện tại vẫn chạy được với `mvn test`.

## Assumptions
- MVP ưu tiên chạy nhanh bằng localStorage/in-memory.
- Chưa thêm auth thật trong MVP; actor audit log tạm là current member.
- Chưa thêm PostgreSQL trong MVP, chỉ note plan backend để triển khai sau.
- Cycle đã lưu trữ/tất toán là readonly.
- `Lưu trữ` không chuyển nợ sang cycle mới; nó reset home và giữ khoản cũ trong lịch sử.
