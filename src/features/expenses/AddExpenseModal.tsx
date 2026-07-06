import { Camera, Check, ChevronLeft, ImagePlus, ReceiptText, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatVnd, formatVndInput, parseVndInput } from "../../lib/money/format";
import { calculateCustomSplit } from "../../lib/split/customSplit";
import { calculateEqualSplit } from "../../lib/split/equalSplit";
import type { Expense, Group, Member, PayerContribution, SplitMode } from "../../types/sharebill";

type AddExpenseModalProps = {
  group: Group;
  initialExpense?: Expense;
  mode?: "create" | "edit";
  titleBadges?: string[];
  onClose: () => void;
  onCreate: (expense: Expense) => void;
  onAddMember: (member: Member) => Promise<Member>;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function createTempMember(name: string): Member {
  return {
    id: `temp:${encodeURIComponent(name)}:${Date.now()}`,
    name
  };
}

export function AddExpenseModal({
  group,
  initialExpense,
  mode = "create",
  titleBadges = [],
  onClose,
  onCreate,
  onAddMember
}: AddExpenseModalProps) {
  const [step, setStep] = useState(1);
  const [imageUrl, setImageUrl] = useState<string | undefined>(initialExpense?.imageUrl);
  const [title, setTitle] = useState(initialExpense?.title ?? "");
  const [totalAmount, setTotalAmount] = useState(initialExpense?.totalAmount ?? 0);
  const [paidDate, setPaidDate] = useState(initialExpense?.paidDate ?? todayIso());
  const [payerAmounts, setPayerAmounts] = useState<Record<string, number>>(() => {
    if (!initialExpense) return {};
    const map: Record<string, number> = {};
    for (const p of initialExpense.payers) map[p.memberId] = p.amount;
    return map;
  });
  const [selectedPayerIds, setSelectedPayerIds] = useState<string[]>(initialExpense?.payers.map(p => p.memberId) ?? []);
  const [availableMembers, setAvailableMembers] = useState<Member[]>(group.members);
  const [participantIds, setParticipantIds] = useState<string[]>(
    initialExpense ? initialExpense.participants.map(p => p.memberId) : group.members.map(m => m.id)
  );
  const [splitMode, setSplitMode] = useState<SplitMode>(initialExpense?.splitMode ?? "equal");
  const [customAmounts, setCustomAmounts] = useState<Record<string, number | undefined>>(() => {
    if (!initialExpense || initialExpense.splitMode !== "custom") return {};
    const map: Record<string, number | undefined> = {};
    for (const p of initialExpense.participants) {
      if (p.isCustom) map[p.memberId] = p.amount;
    }
    return map;
  });
  const [tempMemberName, setTempMemberName] = useState("");
  const [error, setError] = useState("");

  const participants = availableMembers.filter((member) => participantIds.includes(member.id));
  const payers = useMemo<PayerContribution[]>(
    () =>
      Object.entries(payerAmounts)
        .filter(([, amount]) => amount > 0)
        .map(([memberId, amount]) => ({ memberId, amount })),
    [payerAmounts]
  );
  const payerTotal = payers.reduce((sum, payer) => sum + payer.amount, 0);

  useEffect(() => {
    // If we are editing and have temp members in participants not in group, we should add them to availableMembers
    const groupMemberIds = new Set(group.members.map(m => m.id));
    const extraMembers: Member[] = [];
    if (initialExpense) {
      for (const p of initialExpense.participants) {
        if (!groupMemberIds.has(p.memberId) && p.memberName && p.memberId.startsWith("temp:")) {
           extraMembers.push({ id: p.memberId, name: p.memberName });
           groupMemberIds.add(p.memberId);
        }
      }
    }
    setAvailableMembers([...group.members, ...extraMembers]);
  }, [group.members, initialExpense]);

  const previewShares = useMemo(() => {
    if (participants.length === 0) return [];
    try {
      return splitMode === "equal"
        ? calculateEqualSplit(totalAmount, participants)
        : calculateCustomSplit({ totalAmount, participants, customAmounts });
    } catch {
      return [];
    }
  }, [customAmounts, participants, splitMode, totalAmount]);

  function toggleParticipant(memberId: string) {
    setParticipantIds((current) =>
      current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId]
    );
  }

  function togglePayer(memberId: string) {
    if (totalAmount <= 0) {
      setError("Nhập tổng tiền trước khi chọn người trả.");
      return;
    }

    setError("");
    setSelectedPayerIds((current) => {
      if (current.includes(memberId)) {
        const next = current.filter((id) => id !== memberId);
        setPayerAmounts((prev) => {
          const copy = { ...prev };
          delete copy[memberId];
          if (next.length === 1) {
            copy[next[0]] = totalAmount;
          }
          return copy;
        });
        return next;
      } else {
        const next = [...current, memberId];
        setPayerAmounts((prev) => {
          const copy = { ...prev };
          if (next.length === 1) {
            copy[memberId] = totalAmount;
          } else {
            if (next.length === 2) {
              copy[next[0]] = 0;
            }
            copy[memberId] = 0;
          }
          return copy;
        });
        return next;
      }
    });
  }

  async function addTempMember() {
    const name = tempMemberName.trim();
    if (!name) return;

    const member = createTempMember(name);
    await onAddMember(member);
    setAvailableMembers((current) => [...current, member]);
    setParticipantIds((current) => [...current, member.id]);
    setTempMemberName("");
  }

  async function handleImageChange(file?: File) {
    if (!file) return;
    setImageUrl(await readImageAsDataUrl(file));
    setStep(2);
  }

  function validateBasics(): boolean {
    if (!title.trim()) {
      setError("Hãy nhập tên bill.");
      return false;
    }
    if (totalAmount <= 0) {
      setError("Tổng tiền phải lớn hơn 0.");
      return false;
    }
    if (payerTotal !== totalAmount) {
      setError("Tổng tiền người trả phải bằng tổng bill.");
      return false;
    }
    setError("");
    return true;
  }

  function submit() {
    try {
      if (participants.length === 0) {
        setError("Cần chọn ít nhất một người tham gia.");
        return;
      }

      const shares =
        splitMode === "equal"
          ? calculateEqualSplit(totalAmount, participants)
          : calculateCustomSplit({ totalAmount, participants, customAmounts });
      const sharesWithNames = shares.map((share) => ({
        ...share,
        memberName: availableMembers.find((member) => member.id === share.memberId)?.name
      }));

      onCreate({
        id: initialExpense?.id || crypto.randomUUID(),
        groupId: group.id,
        title: title.trim(),
        totalAmount,
        paidDate,
        imageUrl,
        payers,
        participants: sharesWithNames,
        splitMode,
        ledgerCycleId: initialExpense?.ledgerCycleId
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể tạo bill.");
    }
  }

  return (
    <div className="fixed inset-0 z-20 grid place-items-end bg-black/76 sm:place-items-center">
      <div className="max-h-[94vh] w-full max-w-[480px] overflow-y-auto rounded-t-[18px] border border-white/10 bg-ink shadow-2xl sm:rounded-[18px]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-ink/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            {step > 1 && (
              <button
                className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.06] text-white/80 transition-colors hover:bg-white/10"
                type="button"
                onClick={() => setStep(step - 1)}
                title="Quay lại"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            <div>
              <p className="text-xs text-white/40">Bước {step}/3</p>
              <h2 className="text-lg font-semibold text-mist">{mode === "create" ? "Tạo Bill Mới" : "Sửa Bill"}</h2>
            </div>
          </div>
          <button className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.06] transition-colors hover:bg-white/10" type="button" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4">
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid aspect-[4/5] place-items-center rounded-[12px] border border-white/10 bg-panel">
                {imageUrl ? (
                  <img className="h-full w-full rounded-[12px] object-cover" src={imageUrl} alt="Bill preview" />
                ) : (
                  <div className="text-center">
                    <Camera className="mx-auto h-14 w-14 text-coral" />
                    <p className="mt-3 text-sm text-white/55">Thêm ảnh món ăn hoặc hóa đơn</p>
                  </div>
                )}
              </div>
              <label className="flex h-14 cursor-pointer items-center justify-center gap-2 rounded-full bg-mist font-semibold text-ink">
                <ImagePlus className="h-5 w-5" />
                Upload ảnh
                <input className="hidden" type="file" accept="image/*" onChange={(event) => handleImageChange(event.target.files?.[0])} />
              </label>
              <button className="h-12 w-full rounded-full border border-white/14 text-sm font-semibold text-mist" type="button" onClick={() => setStep(2)}>
                Bỏ qua ảnh
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm text-white/55">Tên bill</span>
                <input
                  className="h-12 w-full rounded-[8px] border border-white/10 bg-white/[0.06] px-3 text-mist outline-none focus:border-coral"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Ví dụ: Lẩu tối thứ sáu"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {titleBadges.map((badge) => (
                     <button
                      key={badge}
                      className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-mist"
                      type="button"
                      onClick={() => setTitle(badge)}
                    >
                      {badge}
                    </button>
                  ))}
                </div>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-white/55">Tổng tiền</span>
                <input
                  className="h-12 w-full rounded-[8px] border border-white/10 bg-white/[0.06] px-3 text-mist outline-none focus:border-coral"
                  inputMode="numeric"
                  value={formatVndInput(totalAmount)}
                  onChange={(event) => setTotalAmount(parseVndInput(event.target.value))}
                  placeholder="80.000"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-white/55">Ngày thanh toán</span>
                <input
                  className="h-12 w-full rounded-[8px] border border-white/10 bg-white/[0.06] px-3 text-mist outline-none focus:border-coral"
                  type="date"
                  value={paidDate}
                  onChange={(event) => setPaidDate(event.target.value)}
                />
              </label>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm text-white/55">Người trả tiền</span>
                  <span className={payerTotal === totalAmount ? "text-xs text-mint" : "text-xs text-coral"}>
                    {formatVnd(payerTotal)} / {formatVnd(totalAmount)}
                  </span>
                </div>
                <div className="mb-4 flex gap-4 overflow-x-auto no-scrollbar pb-2 pt-1">
                  {group.members.map((member) => {
                    const isSelected = selectedPayerIds.includes(member.id);
                    return (
                      <button
                        key={member.id}
                        className="flex shrink-0 flex-col items-center gap-1.5"
                        type="button"
                        onClick={() => togglePayer(member.id)}
                      >
                        <div className={`rounded-full p-[2px] ${isSelected ? "border-[2px] border-coral" : "border-[2px] border-transparent"}`}>
                          <div className="relative h-[52px] w-[52px] overflow-hidden rounded-full border-[3px] border-white/10 bg-white/5">
                            <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${member.name}`} alt={member.name} className="h-full w-full object-cover opacity-90" />
                          </div>
                        </div>
                        <span className={`text-xs font-bold ${isSelected ? "text-coral" : "text-white/60"}`}>
                          {member.name.split(" ")[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {selectedPayerIds.length > 1 && (
                  <div className="space-y-2 border-t border-white/10 pt-4">
                    {selectedPayerIds.map((memberId) => {
                      const member = availableMembers.find(m => m.id === memberId);
                      if (!member) return null;
                      return (
                        <div key={member.id} className="flex items-center gap-3 rounded-[8px] border border-white/10 bg-white/[0.04] p-2">
                          <span className="w-24 truncate px-2 text-sm font-semibold text-mist">
                            {member.name}
                          </span>
                          <input
                            className="h-10 min-w-0 flex-1 rounded-[8px] border border-white/10 bg-ink px-3 text-right text-mist outline-none focus:border-coral"
                            inputMode="numeric"
                            value={formatVndInput(payerAmounts[member.id] ?? 0)}
                            onChange={(event) =>
                              setPayerAmounts((current) => ({ ...current, [member.id]: parseVndInput(event.target.value) }))
                            }
                            placeholder="0"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {error && <p className="rounded-[8px] bg-coral/12 p-3 text-sm text-coral">{error}</p>}
              <button
                className="h-12 w-full rounded-full bg-mist font-semibold text-ink"
                type="button"
                onClick={() => validateBasics() && setStep(3)}
              >
                Tiếp tục
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <div className="mb-2">
                  <span className="text-sm text-white/55">Thành viên tham gia</span>
                </div>
                <div className="mb-4 flex gap-4 overflow-x-auto no-scrollbar pb-2 pt-1">
                  <button
                    className="flex shrink-0 flex-col items-center gap-1.5"
                    type="button"
                    onClick={() =>
                      setParticipantIds(
                        participantIds.length === availableMembers.length ? [] : availableMembers.map((member) => member.id)
                      )
                    }
                  >
                    <div className={`rounded-full p-[2px] ${participantIds.length === availableMembers.length ? "border-[2px] border-coral" : "border-[2px] border-transparent"}`}>
                      <div className="grid h-[52px] w-[52px] place-items-center rounded-full bg-white/20">
                        <Users className="h-6 w-6 text-white" />
                      </div>
                    </div>
                    <span className={`text-xs font-bold ${participantIds.length === availableMembers.length ? "text-coral" : "text-white/60"}`}>
                      Tất cả
                    </span>
                  </button>

                  {availableMembers.map((member) => {
                    const isSelected = participantIds.includes(member.id);
                    const showCoralBorder = isSelected && participantIds.length !== availableMembers.length;
                    return (
                      <button
                        key={member.id}
                        className="flex shrink-0 flex-col items-center gap-1.5"
                        type="button"
                        onClick={() => toggleParticipant(member.id)}
                      >
                        <div className={`rounded-full p-[2px] ${showCoralBorder ? "border-[2px] border-coral" : "border-[2px] border-transparent"}`}>
                          <div className="relative h-[52px] w-[52px] overflow-hidden rounded-full border-[3px] border-white/10 bg-white/5">
                            <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${member.name}`} alt={member.name} className="h-full w-full object-cover opacity-90" />
                            {member.id.startsWith("temp:") && (
                              <div className="absolute inset-x-0 bottom-0 bg-black/60 pb-0.5 text-center text-[8px] font-bold text-coral">tạm</div>
                            )}
                          </div>
                        </div>
                        <span className={`text-xs font-bold ${showCoralBorder ? "text-coral" : "text-white/60"}`}>
                          {member.name.split(" ")[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="mb-3 flex gap-2">
                  <input
                    className="h-11 min-w-0 flex-1 rounded-[8px] border border-white/10 bg-white/[0.06] px-3 text-sm text-mist outline-none focus:border-coral"
                    value={tempMemberName}
                    onChange={(event) => setTempMemberName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addTempMember();
                      }
                    }}
                    placeholder="Thêm user tạm thời"
                  />
                  <button className="h-11 rounded-[8px] bg-mist px-4 text-sm font-semibold text-ink" type="button" onClick={addTempMember}>
                    Thêm
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 rounded-[10px] bg-white/[0.05] p-1">
                {(["equal", "custom"] as SplitMode[]).map((mode) => (
                  <button
                    key={mode}
                    className={`h-10 rounded-[8px] text-sm font-semibold ${
                      splitMode === mode ? "bg-mist text-ink" : "text-white/56"
                    }`}
                    type="button"
                    onClick={() => setSplitMode(mode)}
                  >
                    {mode === "equal" ? "Chia đều" : "Tùy chỉnh"}
                  </button>
                ))}
              </div>

              {splitMode === "custom" && (
                <div className="space-y-2">
                  {participants.map((member) => (
                    <label key={member.id} className="flex items-center gap-3 rounded-[8px] border border-white/10 bg-white/[0.04] p-2">
                      <span className="w-24 truncate text-sm">{member.name}</span>
                      <input
                        className="h-10 min-w-0 flex-1 rounded-[8px] border border-white/10 bg-ink px-3 text-right text-mist outline-none"
                        inputMode="numeric"
                        value={formatVndInput(customAmounts[member.id] ?? 0)}
                        onChange={(event) =>
                          setCustomAmounts((current) => ({
                            ...current,
                            [member.id]: event.target.value ? parseVndInput(event.target.value) : undefined
                          }))
                        }
                        placeholder="Tự động"
                      />
                    </label>
                  ))}
                </div>
              )}

              <div className="rounded-[8px] border border-white/10 bg-white/[0.04] p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-mist">
                  <ReceiptText className="h-4 w-4 text-coral" />
                  Preview chia tiền
                </div>
                <div className="space-y-1">
                  {previewShares.map((share) => (
                    <div key={share.memberId} className="flex justify-between text-sm text-white/64">
                      <span>{availableMembers.find((member) => member.id === share.memberId)?.name}</span>
                      <span>
                        {formatVnd(share.amount)} {share.isCustom ? "(custom)" : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {error && <p className="rounded-[8px] bg-coral/12 p-3 text-sm text-coral">{error}</p>}
              <button className="h-12 w-full rounded-full bg-coral font-semibold text-white" type="button" onClick={submit}>
                {mode === "create" ? "Tạo bill" : "Lưu bill"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
