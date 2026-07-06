# ShareBill Mobile-First MVP Plan

## Summary
Xây dựng ShareBill dưới dạng web app mobile-first với **React + TypeScript frontend** và **Spring Boot backend**, ưu tiên MVP chạy nhanh bằng dữ liệu local/in-memory trước. Trọng tâm giai đoạn đầu là: quản lý nhóm, tạo bill theo flow ảnh trước giống Locket, chọn người trả/người tham gia, tính chia đều/chia tùy chỉnh, dashboard lịch tuần, và màn hình tổng hợp nợ.

## Project Structure
Tạo monorepo:

```text
sharebill/
  frontend/
    src/
      app/
      components/
      features/
        groups/
        expenses/
        calendar/
        settlements/
      lib/
        money/
        split/
      types/
      data/
    package.json
    vite.config.ts
    tailwind.config.ts

  backend/
    src/main/java/com/sharebill/
      ShareBillApplication.java
      group/
      expense/
      settlement/
      common/
    pom.xml

  README.md
```

Frontend dùng **Vite React + TypeScript + Tailwind CSS**. Backend dùng **Spring Boot REST API**, nhưng MVP có thể chạy với in-memory storage để chưa cần PostgreSQL/MongoDB.

## Key Implementation Changes

### Frontend App Flow
- Home dashboard:
  - Max-width `480px`, center trên desktop.
  - Dark mobile-first UI, camera-like feel.
  - Top bar chọn group.
  - Weekly calendar từ Thứ 2 đến Chủ nhật.
  - Mỗi ngày hiển thị bill thumbnail nếu có ảnh, hoặc placeholder icon + tên ngắn.
  - Summary:
    - `Bạn cần trả`
    - `Bạn sẽ nhận lại`
  - Floating round button `Tạo Bill Mới` ở bottom center.

- Add Expense flow:
  - Step 1: Camera/upload placeholder.
    - Upload image.
    - Skip image.
  - Step 2: Bill basics.
    - Bill name.
    - Total amount.
    - Paid date.
    - Multiple payers, mỗi payer có amount riêng.
    - Validate tổng tiền người trả bằng tổng bill.
  - Step 3: Participants + split mode.
    - Checkbox member list.
    - `Chọn tất cả`.
    - Equal mode.
    - Custom mode với input fixed amount cho từng participant.
    - Preview realtime số tiền mỗi người chịu.

- Debt detail screen:
  - List các settlement tối giản: `A trả B 23.000đ`.
  - Button `Đánh dấu đã trả xong`.
  - MVP có thể chỉ update local/in-memory state.

### Backend API
Spring Boot expose REST endpoints tối thiểu:

```http
GET    /api/groups
POST   /api/groups
POST   /api/groups/{groupId}/members

GET    /api/groups/{groupId}/expenses
POST   /api/groups/{groupId}/expenses

GET    /api/groups/{groupId}/settlements
POST   /api/groups/{groupId}/settlements/{settlementId}/mark-paid
```

DTO chính:
- `GroupDto`
- `MemberDto`
- `ExpenseDto`
- `PayerContributionDto`
- `ParticipantShareDto`
- `SettlementDto`

MVP storage:
- In-memory maps trong Spring service.
- Seed data demo cho 1 group và vài member.
- Frontend có thể fallback mock local data nếu backend chưa chạy, nhưng mặc định gọi API.

### Custom Split Logic
Viết hàm TypeScript trong `frontend/src/lib/split/customSplit.ts`.

Input dự kiến:

```ts
type CustomSplitInput = {
  totalAmount: number; // smallest currency unit, e.g. VND integer
  participants: { id: string; name: string }[];
  customAmounts: Record<string, number | undefined>;
};
```

Output:

```ts
type SplitShare = {
  memberId: string;
  amount: number;
  isCustom: boolean;
};
```

Logic:
- Tất cả số tiền xử lý bằng integer VND, không dùng float cho tiền.
- Member có custom amount hợp lệ sẽ nhận đúng amount đó.
- `remainingAmount = totalAmount - sum(customAmounts)`.
- Những member không có custom amount sẽ chia đều phần còn lại.
- Nếu chia lẻ, dùng deterministic rounding:
  - `base = Math.floor(remainingAmount / autoCount)`.
  - `remainder = remainingAmount % autoCount`.
  - Những member auto đầu tiên theo thứ tự participants nhận `base + 1`.
  - Các member auto còn lại nhận `base`.
- Validate:
  - `totalAmount >= 0`.
  - Có ít nhất 1 participant.
  - Custom amount không âm.
  - Tổng custom không vượt total.
  - Nếu tất cả participant đều custom thì tổng custom phải đúng bằng total.
- Guarantee:
  - Tổng output luôn bằng `totalAmount`.
  - Không có amount âm.
  - Kết quả ổn định theo thứ tự participants.

Ví dụ:
- Total `80000`
- A custom `10000`
- B/C/D auto
- Remaining `70000`
- Output: A `10000`, B `23334`, C `23333`, D `23333`.

### Settlement Logic
Tính nợ nhóm từ expense:
- Với mỗi expense:
  - Mỗi participant có `owedShare`.
  - Mỗi payer có `paidAmount`.
  - Net per member: `paidAmount - owedShare`.
- Member net âm là debtor.
- Member net dương là creditor.
- Tạo settlements tối giản bằng two-pointer matching:
  - debtor trả creditor số nhỏ hơn giữa debt và credit.
- Rounding đã được xử lý ở split stage nên settlement dùng integer.

## Test Plan
- Unit tests cho `customSplit.ts`:
  - Chia đều phần còn lại có số dư.
  - Một người custom, nhiều người auto.
  - Nhiều người custom.
  - Tất cả custom đúng total.
  - Tổng custom vượt total thì throw error.
  - Không participant thì throw error.
  - Custom amount âm thì throw error.
  - Output sum luôn bằng total.

- Unit tests cho settlement:
  - Một payer trả hết bill.
  - Nhiều payer cùng trả.
  - Người trả cũng là participant.
  - Người trả không tham gia bill.
  - Settlement bỏ qua amount `0`.

- UI acceptance:
  - Home hiển thị weekly calendar đúng ngày.
  - Add Expense đi đủ 3 step.
  - Custom split preview cập nhật realtime.
  - Mobile viewport `360px` không overflow.
  - Desktop viewport vẫn giữ app centered max-width `480px`.

## Assumptions
- Stack chốt: **React + TypeScript frontend**, **Spring Boot backend**.
- MVP dùng **in-memory/local data**, chưa cần database thật.
- Tiền lưu bằng integer VND để tránh lỗi floating-point.
- Ảnh bill ở MVP lưu dạng local preview/base64 hoặc mock URL; upload thật sẽ để giai đoạn sau.
- Không làm social feed, global friends, public profile, hay notification ở MVP.
