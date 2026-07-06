import re

def replace_in_file(file_path, replacements):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    for old, new in replacements.items():
        content = content.replace(old, new)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

# File 4: AddExpenseModal.tsx
replacements_add_expense = {
    '"Ca phe", "Khanh xe", "Banh mi", "Che"': '"Cà phê", "Ăn xế", "Bánh mì", "Chè"',
    'Nhap tong tien truoc khi chon nguoi tra het.': 'Nhập tổng tiền trước khi chọn người trả hết.',
    'Hay nhap ten bill.': 'Hãy nhập tên bill.',
    'Tong tien phai lon hon 0.': 'Tổng tiền phải lớn hơn 0.',
    'Tong tien nguoi tra phai bang tong bill.': 'Tổng tiền người trả phải bằng tổng bill.',
    'Can chon it nhat mot nguoi tham gia.': 'Cần chọn ít nhất một người tham gia.',
    'Khong the tao bill.': 'Không thể tạo bill.',
    'Buoc {step}/3': 'Bước {step}/3',
    'Tao Bill Moi': 'Tạo Bill Mới',
    'Them anh mon an hoac hoa don': 'Thêm ảnh món ăn hoặc hóa đơn',
    'Upload anh': 'Upload ảnh',
    'Bo qua anh': 'Bỏ qua ảnh',
    'Ten bill': 'Tên bill',
    'Vi du: Lau toi thu sau': 'Ví dụ: Lẩu tối thứ sáu',
    'Tong tien': 'Tổng tiền',
    'Ngay thanh toan': 'Ngày thanh toán',
    'Nguoi tra tien': 'Người trả tiền',
    'tra het`': 'trả hết`',
    'Tiep tuc': 'Tiếp tục',
    'Thanh vien tham gia': 'Thành viên tham gia',
    'Chon tat ca': 'Chọn tất cả',
    'Them user tam thoi': 'Thêm user tạm thời',
    '>Them<': '>Thêm<',
    '>tam<': '>tạm<',
    'Chia deu': 'Chia đều',
    'Tuy chinh': 'Tùy chỉnh',
    'Tu dong': 'Tự động',
    'Preview chia tien': 'Preview chia tiền',
    '>Tao bill<': '>Tạo bill<'
}

replace_in_file(r'D:\FPT_PROCESS\nonan\sharebill\frontend\src\features\expenses\AddExpenseModal.tsx', replacements_add_expense)

# File 5: ExpenseList.tsx
replacements_expense_list = {
    'Bill trong ngay': 'Bill trong ngày',
    'Chua co bill nao cho ngay nay.': 'Chưa có bill nào cho ngày này.',
    'nguoi tham gia': 'người tham gia',
    'chia deu': 'chia đều',
    'tuy chinh': 'tùy chỉnh'
}

replace_in_file(r'D:\FPT_PROCESS\nonan\sharebill\frontend\src\features\expenses\ExpenseList.tsx', replacements_expense_list)

# File 6: SettlementPanel.tsx
replacements_settlement_panel = {
    'Ban can tra': 'Bạn cần trả',
    'Ban se nhan lai': 'Bạn sẽ nhận lại',
    'So no': 'Sổ nợ',
    'viec can xu ly': 'việc cần xử lý',
    'Giao dich': 'Giao dịch',
    'Am duong': 'Âm dương',
    'Nhom hien khong co khoan no nao.': 'Nhóm hiện không có khoản nợ nào.',
    '} tra ${': '} trả ${',
    'Dieu chinh so no': 'Điều chỉnh sổ nợ',
    'Hoan tac da tra': 'Hoàn tác đã trả',
    'Danh dau da tra xong': 'Đánh dấu đã trả xong',
    'Nhom dang can bang, khong co so du am duong.': 'Nhóm đang cân bằng, không có số dư âm dương.',
    'Dieu chinh so du': 'Điều chỉnh số dư',
    '"dang am" : "dang duong"': '"đang âm" : "đang dương"',
    'Ghi no voi ai': 'Ghi nợ với ai',
    'Nhan/doi ung voi ai': 'Nhận/đối ứng với ai',
    'Chon nguoi': 'Chọn người',
    '>Giam no<': '>Giảm nợ<',
    '>Tang no<': '>Tăng nợ<',
    'So tien': 'Số tiền',
    'Giam no se tru bot so tien cua nguoi dang am va giam so tien nguoi doi ung se nhan.': 'Giảm nợ sẽ trừ bớt số tiền của người đang âm và giảm số tiền người đối ứng sẽ nhận.',
    'Tang no se cong them vao nguoi dang am va cong them vao so tien nguoi doi ung se nhan.': 'Tăng nợ sẽ cộng thêm vào người đang âm và cộng thêm vào số tiền người đối ứng sẽ nhận.',
    '>Huy<': '>Hủy<',
    '>Ap nam<': '>Áp dụng<'
}

replace_in_file(r'D:\FPT_PROCESS\nonan\sharebill\frontend\src\features\settlements\SettlementPanel.tsx', replacements_settlement_panel)

print("Translation completed successfully.")
