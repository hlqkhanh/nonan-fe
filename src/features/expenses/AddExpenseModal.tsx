import { BookUser, Camera, ChevronLeft, ImagePlus, Loader2, ReceiptText, RotateCw, UserPlus, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createContact, getBillPhotoUploadSignature, uploadImageToCloudinary } from "../../data/api";
import { resolveAvatarUrl } from "../../lib/avatar";
import { formatVnd, formatVndInput, parseVndInput } from "../../lib/money/format";
import { calculateCustomSplit } from "../../lib/split/customSplit";
import type { SplitParticipant } from "../../lib/split/customSplit";
import { calculateEqualSplit } from "../../lib/split/equalSplit";
import type { Contact, Expense, Friend, Group, Participant, PayerContribution, SplitMode, User } from "../../types/sharebill";
import { CameraCapture } from "./CameraCapture";

type DrawerTarget = "payer" | "participant" | null;

type AddExpenseModalProps = {
  initialExpense?: Expense;
  mode?: "create" | "edit";
  titleBadges?: string[];
  currentUser: User;
  friends: Friend[];
  contacts: Contact[];
  groups: Group[];
  // When set (from "+ Thêm bill" on a specific Sổ nợ cycle), the created
  // bill targets this cycle instead of the viewer's home/active cycle.
  targetCycleId?: string;
  onContactCreated: (contact: Contact) => void;
  onClose: () => void;
  onCreate: (expense: Expense) => Promise<void>;
};

function nowLocalIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function AddExpenseModal({
  initialExpense,
  mode = "create",
  titleBadges = [],
  currentUser,
  friends,
  contacts,
  groups,
  targetCycleId,
  onContactCreated,
  onClose,
  onCreate
}: AddExpenseModalProps) {
  const [step, setStep] = useState(1);
  const [imageUrl, setImageUrl] = useState<string | undefined>(initialExpense?.imageUrl);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [photoUploadState, setPhotoUploadState] = useState<"idle" | "uploading" | "error" | "done">("idle");
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState(initialExpense?.title ?? "");
  const [totalAmount, setTotalAmount] = useState(initialExpense?.totalAmount ?? 0);
  const [paidDate, setPaidDate] = useState(initialExpense?.paidDate ? initialExpense.paidDate.slice(0, 16) : nowLocalIso());
  const [payerAmounts, setPayerAmounts] = useState<Record<string, number>>(() => {
    if (!initialExpense) return {};
    const map: Record<string, number> = {};
    for (const p of initialExpense.payers) map[p.memberId] = p.amount;
    return map;
  });
  const [selectedPayerIds, setSelectedPayerIds] = useState<string[]>(initialExpense?.payers.map((p) => p.memberId) ?? []);
  const [participantIds, setParticipantIds] = useState<string[]>(
    initialExpense
      ? initialExpense.participants.map((p) => p.memberId)
      : [`user:${currentUser.id}`]
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
  const [localContacts, setLocalContacts] = useState<Contact[]>(contacts);
  const [drawerTarget, setDrawerTarget] = useState<DrawerTarget>(null);
  const [drawerSelected, setDrawerSelected] = useState<string[]>([]);
  const [instantNamePayer, setInstantNamePayer] = useState("");
  const [instantNameParticipant, setInstantNameParticipant] = useState("");
  const [creatingContact, setCreatingContact] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setLocalContacts(contacts);
  }, [contacts]);

  const selfParticipant = useMemo<Participant>(
    () => ({
      participantId: `user:${currentUser.id}`,
      name: currentUser.displayName,
      avatarUrl: currentUser.avatarUrl,
      type: "user"
    }),
    [currentUser]
  );

  const directory = useMemo<Participant[]>(() => {
    const map = new Map<string, Participant>();
    map.set(selfParticipant.participantId, selfParticipant);
    for (const friend of friends) {
      map.set(`user:${friend.userId}`, {
        participantId: `user:${friend.userId}`,
        name: friend.displayName,
        avatarUrl: friend.avatarUrl,
        type: "user"
      });
    }
    for (const contact of localContacts) {
      map.set(`contact:${contact.id}`, {
        participantId: `contact:${contact.id}`,
        name: contact.name,
        avatarUrl: contact.avatarUrl,
        type: "contact"
      });
    }
    for (const group of groups) {
      for (const member of group.members) {
        if (!map.has(member.participantId)) map.set(member.participantId, member);
      }
    }
    if (initialExpense) {
      for (const payer of initialExpense.payers) {
        if (!map.has(payer.memberId)) {
          map.set(payer.memberId, {
            participantId: payer.memberId,
            name: payer.name ?? payer.memberId,
            avatarUrl: payer.avatarUrl,
            type: payer.memberId.startsWith("contact:") ? "contact" : "user"
          });
        }
      }
      for (const participant of initialExpense.participants) {
        if (!map.has(participant.memberId)) {
          map.set(participant.memberId, {
            participantId: participant.memberId,
            name: participant.memberName ?? participant.memberId,
            avatarUrl: participant.avatarUrl,
            type: participant.memberId.startsWith("contact:") ? "contact" : "user"
          });
        }
      }
    }
    return Array.from(map.values());
  }, [selfParticipant, friends, localContacts, groups, initialExpense]);

  function findParticipant(id: string): Participant | undefined {
    return directory.find((p) => p.participantId === id);
  }

  const favoriteParticipants = useMemo<Participant[]>(() => {
    const favFriends = friends
      .filter((f) => f.isFavorite)
      .map<Participant>((f) => ({ participantId: `user:${f.userId}`, name: f.displayName, avatarUrl: f.avatarUrl, type: "user" }));
    const favContacts = localContacts
      .filter((c) => c.isFavorite)
      .map<Participant>((c) => ({ participantId: `contact:${c.id}`, name: c.name, avatarUrl: c.avatarUrl, type: "contact" }));
    return [selfParticipant, ...favFriends, ...favContacts];
  }, [friends, localContacts, selfParticipant]);

  function quickRow(selectedIds: string[]): Participant[] {
    const map = new Map<string, Participant>();
    for (const p of favoriteParticipants) map.set(p.participantId, p);
    for (const id of selectedIds) {
      const p = findParticipant(id);
      if (p) map.set(p.participantId, p);
    }
    return Array.from(map.values());
  }

  const participants = participantIds.map((id) => findParticipant(id)).filter((p): p is Participant => Boolean(p));
  const splitParticipants: SplitParticipant[] = participants.map((p) => ({ id: p.participantId, name: p.name }));

  const payers = useMemo<PayerContribution[]>(
    () =>
      Object.entries(payerAmounts)
        .filter(([, amount]) => amount > 0)
        .map(([memberId, amount]) => ({ memberId, amount })),
    [payerAmounts]
  );
  const payerTotal = payers.reduce((sum, payer) => sum + payer.amount, 0);

  const previewShares = useMemo(() => {
    if (splitParticipants.length === 0) return [];
    try {
      return splitMode === "equal"
        ? calculateEqualSplit(totalAmount, splitParticipants)
        : calculateCustomSplit({ totalAmount, participants: splitParticipants, customAmounts });
    } catch {
      return [];
    }
  }, [customAmounts, splitParticipants, splitMode, totalAmount]);

  function toggleParticipant(memberId: string) {
    setParticipantIds((current) =>
      current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId]
    );
  }

  function addToParticipantSelection(ids: string[]) {
    setParticipantIds((current) => Array.from(new Set([...current, ...ids])));
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

  function addToPayerSelection(ids: string[]) {
    if (totalAmount <= 0) {
      setError("Nhập tổng tiền trước khi chọn người trả.");
      return;
    }
    setError("");
    setSelectedPayerIds((current) => {
      const merged = Array.from(new Set([...current, ...ids]));
      setPayerAmounts((prev) => {
        const copy = { ...prev };
        if (merged.length === 1) {
          copy[merged[0]] = totalAmount;
        } else {
          for (const id of merged) {
            if (!(id in copy)) copy[id] = 0;
          }
        }
        return copy;
      });
      return merged;
    });
  }

  async function handleInstantContact(name: string, target: "payer" | "participant") {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCreatingContact(true);
    setError("");
    try {
      const contact = await createContact(trimmed);
      onContactCreated(contact);
      setLocalContacts((current) => [...current, contact]);
      const participantId = `contact:${contact.id}`;
      if (target === "payer") {
        addToPayerSelection([participantId]);
        setInstantNamePayer("");
      } else {
        addToParticipantSelection([participantId]);
        setInstantNameParticipant("");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể thêm thành viên tạm thời.");
    } finally {
      setCreatingContact(false);
    }
  }

  function openDrawer(target: "payer" | "participant") {
    setDrawerTarget(target);
    setDrawerSelected([]);
  }

  function toggleDrawerSelected(id: string) {
    setDrawerSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  }

  function applyDrawer() {
    if (drawerTarget === "payer") addToPayerSelection(drawerSelected);
    if (drawerTarget === "participant") addToParticipantSelection(drawerSelected);
    setDrawerTarget(null);
  }

  async function handleImageChange(file?: File) {
    if (!file) return;
    setImageUrl(await readImageAsDataUrl(file));
    setStep(2);
  }

  // Create-mode camera flow: the captured frame is previewed locally right
  // away (so step 2 never blocks on the network), while the Cloudinary
  // upload runs in the background — "Tiếp tục" just waits on its result.
  function handleCameraCapture(file: File) {
    setCapturedFile(file);
    setImageUrl(URL.createObjectURL(file));
    setStep(2);
    void uploadCapturedPhoto(file);
  }

  async function uploadCapturedPhoto(file: File) {
    setPhotoUploadState("uploading");
    try {
      const signature = await getBillPhotoUploadSignature();
      const url = await uploadImageToCloudinary(file, signature);
      setImageUrl(url);
      setPhotoUploadState("done");
    } catch {
      // Keep the local preview; bill creation isn't blocked on this, and the
      // user can retry the upload from the step-2 banner.
      setPhotoUploadState("error");
    }
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

  async function submit() {
    if (splitParticipants.length === 0) {
      setError("Cần chọn ít nhất một người tham gia.");
      return;
    }

    setSubmitting(true);
    try {
      const shares =
        splitMode === "equal"
          ? calculateEqualSplit(totalAmount, splitParticipants)
          : calculateCustomSplit({ totalAmount, participants: splitParticipants, customAmounts });

      await onCreate({
        id: initialExpense?.id || crypto.randomUUID(),
        title: title.trim(),
        totalAmount,
        paidDate,
        imageUrl,
        payers,
        participants: shares.map((share) => ({ memberId: share.memberId, amount: share.amount, isCustom: share.isCustom })),
        splitMode,
        ledgerCycleId: initialExpense?.ledgerCycleId ?? targetCycleId
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể tạo bill.");
    } finally {
      setSubmitting(false);
    }
  }

  const payerQuickRow = quickRow(selectedPayerIds);
  const participantQuickRow = quickRow(participantIds);
  const allQuickSelected = participantQuickRow.length > 0 && participantQuickRow.every((p) => participantIds.includes(p.participantId));

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
          <button className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.06] transition-colors hover:bg-white/10" type="button" title="Đóng" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4">
          {step === 1 && mode === "create" && (
            <CameraCapture onCapture={handleCameraCapture} onSkip={() => setStep(2)} />
          )}

          {step === 1 && mode === "edit" && (
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
                <span className="mb-1 block text-sm text-white/55">Ngày giờ thanh toán</span>
                <input
                  className="h-12 w-full rounded-[8px] border border-white/10 bg-white/[0.06] px-3 text-mist outline-none focus:border-coral"
                  type="datetime-local"
                  value={paidDate}
                  onChange={(event) => setPaidDate(event.target.value)}
                />
              </label>

              {photoUploadState === "uploading" && (
                <div className="flex items-center gap-2 rounded-[8px] bg-white/[0.04] p-3 text-xs text-white/60">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Đang tải ảnh lên...
                </div>
              )}
              {photoUploadState === "error" && (
                <div className="flex items-center justify-between gap-2 rounded-[8px] bg-coral/12 p-3 text-xs text-coral">
                  <span>Tải ảnh lên thất bại — vẫn dùng được ảnh tạm để tạo bill.</span>
                  <button
                    type="button"
                    className="flex shrink-0 items-center gap-1 rounded-[8px] bg-coral/20 px-2 py-1 font-semibold"
                    onClick={() => capturedFile && void uploadCapturedPhoto(capturedFile)}
                  >
                    <RotateCw className="h-3 w-3" />
                    Thử lại
                  </button>
                </div>
              )}

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm text-white/55">Người trả tiền</span>
                  <span className={payerTotal === totalAmount ? "text-xs text-mint" : "text-xs text-coral"}>
                    {formatVnd(payerTotal)} / {formatVnd(totalAmount)}
                  </span>
                </div>
                <div className="mb-3 flex gap-4 overflow-x-auto no-scrollbar pb-2 pt-1">
                  {payerQuickRow.map((participant) => {
                    const isSelected = selectedPayerIds.includes(participant.participantId);
                    return (
                      <button
                        key={participant.participantId}
                        className="flex shrink-0 flex-col items-center gap-1.5"
                        type="button"
                        onClick={() => togglePayer(participant.participantId)}
                      >
                        <div className={`rounded-full p-[2px] ${isSelected ? "border-[2px] border-coral" : "border-[2px] border-transparent"}`}>
                          <div className="relative h-[52px] w-[52px] overflow-hidden rounded-full border-[3px] border-white/10 bg-white/5">
                            <img src={resolveAvatarUrl(participant.name, participant.avatarUrl)} alt={participant.name} className="h-full w-full object-cover opacity-90" />
                          </div>
                        </div>
                        <span className={`text-xs font-bold ${isSelected ? "text-coral" : "text-white/60"}`}>
                          {participant.name.split(" ")[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {groups.length > 0 && (
                  <div className="mb-3 flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {groups.map((group) => (
                      <button
                        key={group.id}
                        type="button"
                        className="shrink-0 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-mist"
                        onClick={() => addToPayerSelection(group.members.map((m) => m.participantId))}
                      >
                        {group.name}
                      </button>
                    ))}
                  </div>
                )}

                {groups.length === 0 && payerQuickRow.length <= 1 && (
                  <p className="mb-3 text-xs text-white/40">
                    Đánh dấu ♥ bạn bè yêu thích hoặc tạo nhóm để hiện nhanh ở đây.
                  </p>
                )}

                <div className="mb-3 flex gap-2">
                  <button
                    className="inline-flex h-9 w-auto self-start items-center justify-center gap-1.5 rounded-[8px] border border-white/10 bg-white/[0.05] px-3 text-xs font-semibold text-mist"
                    type="button"
                    onClick={() => openDrawer("payer")}
                  >
                    <BookUser className="h-3.5 w-3.5" />
                    Danh bạ
                  </button>
                </div>
                <div className="mb-4 flex gap-2">
                  <input
                    className="h-10 min-w-0 flex-1 rounded-[8px] border border-white/10 bg-white/[0.06] px-3 text-xs text-mist outline-none focus:border-coral"
                    value={instantNamePayer}
                    onChange={(event) => setInstantNamePayer(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void handleInstantContact(instantNamePayer, "payer");
                      }
                    }}
                    placeholder="Thêm thành viên tạm thời"
                  />
                  <button
                    className="flex h-10 shrink-0 items-center gap-1 rounded-[8px] bg-mist px-3 text-xs font-semibold text-ink disabled:opacity-50"
                    type="button"
                    disabled={creatingContact}
                    onClick={() => handleInstantContact(instantNamePayer, "payer")}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Thêm
                  </button>
                </div>

                {selectedPayerIds.length > 1 && (
                  <div className="space-y-2 border-t border-white/10 pt-4">
                    {selectedPayerIds.map((memberId) => {
                      const participant = findParticipant(memberId);
                      if (!participant) return null;
                      return (
                        <div key={memberId} className="flex items-center gap-3 rounded-[8px] border border-white/10 bg-white/[0.04] p-2">
                          <span className="w-24 truncate px-2 text-sm font-semibold text-mist">
                            {participant.name}
                          </span>
                          <input
                            className="h-10 min-w-0 flex-1 rounded-[8px] border border-white/10 bg-ink px-3 text-right text-mist outline-none focus:border-coral"
                            inputMode="numeric"
                            value={formatVndInput(payerAmounts[memberId] ?? 0)}
                            onChange={(event) =>
                              setPayerAmounts((current) => ({ ...current, [memberId]: parseVndInput(event.target.value) }))
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
                className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-mist font-semibold text-ink disabled:opacity-50"
                type="button"
                disabled={photoUploadState === "uploading"}
                onClick={() => validateBasics() && setStep(3)}
              >
                {photoUploadState === "uploading" && <Loader2 className="h-4 w-4 animate-spin" />}
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
                <div className="mb-3 flex gap-4 overflow-x-auto no-scrollbar pb-2 pt-1">
                  <button
                    className="flex shrink-0 flex-col items-center gap-1.5"
                    type="button"
                    onClick={() => {
                      if (allQuickSelected) {
                        setParticipantIds((current) => current.filter((id) => !participantQuickRow.some((p) => p.participantId === id)));
                      } else {
                        addToParticipantSelection(participantQuickRow.map((p) => p.participantId));
                      }
                    }}
                  >
                    <div className={`rounded-full p-[2px] ${allQuickSelected ? "border-[2px] border-coral" : "border-[2px] border-transparent"}`}>
                      <div className="grid h-[52px] w-[52px] place-items-center rounded-full bg-white/20">
                        <Users className="h-6 w-6 text-white" />
                      </div>
                    </div>
                    <span className={`text-xs font-bold ${allQuickSelected ? "text-coral" : "text-white/60"}`}>Tất cả</span>
                  </button>

                  {participantQuickRow.map((participant) => {
                    const isSelected = participantIds.includes(participant.participantId);
                    return (
                      <button
                        key={participant.participantId}
                        className="flex shrink-0 flex-col items-center gap-1.5"
                        type="button"
                        onClick={() => toggleParticipant(participant.participantId)}
                      >
                        <div className={`rounded-full p-[2px] ${isSelected ? "border-[2px] border-coral" : "border-[2px] border-transparent"}`}>
                          <div className="relative h-[52px] w-[52px] overflow-hidden rounded-full border-[3px] border-white/10 bg-white/5">
                            <img src={resolveAvatarUrl(participant.name, participant.avatarUrl)} alt={participant.name} className="h-full w-full object-cover opacity-90" />
                            {participant.type === "contact" && (
                              <div className="absolute inset-x-0 bottom-0 bg-black/60 pb-0.5 text-center text-[8px] font-bold text-coral">danh bạ</div>
                            )}
                          </div>
                        </div>
                        <span className={`text-xs font-bold ${isSelected ? "text-coral" : "text-white/60"}`}>
                          {participant.name.split(" ")[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {groups.length > 0 && (
                  <div className="mb-3 flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {groups.map((group) => (
                      <button
                        key={group.id}
                        type="button"
                        className="shrink-0 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-mist"
                        onClick={() => addToParticipantSelection(group.members.map((m) => m.participantId))}
                      >
                        {group.name}
                      </button>
                    ))}
                  </div>
                )}

                {groups.length === 0 && participantQuickRow.length <= 1 && (
                  <p className="mb-3 text-xs text-white/40">
                    Đánh dấu ♥ bạn bè yêu thích hoặc tạo nhóm để hiện nhanh ở đây.
                  </p>
                )}

                <div className="mb-3 flex gap-2">
                  <button
                    className="inline-flex h-9 w-auto self-start items-center justify-center gap-1.5 rounded-[8px] border border-white/10 bg-white/[0.05] px-3 text-xs font-semibold text-mist"
                    type="button"
                    onClick={() => openDrawer("participant")}
                  >
                    <BookUser className="h-3.5 w-3.5" />
                    Danh bạ
                  </button>
                </div>
                <div className="mb-3 flex gap-2">
                  <input
                    className="h-10 min-w-0 flex-1 rounded-[8px] border border-white/10 bg-white/[0.06] px-3 text-xs text-mist outline-none focus:border-coral"
                    value={instantNameParticipant}
                    onChange={(event) => setInstantNameParticipant(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void handleInstantContact(instantNameParticipant, "participant");
                      }
                    }}
                    placeholder="Thêm thành viên tạm thời"
                  />
                  <button
                    className="flex h-10 shrink-0 items-center gap-1 rounded-[8px] bg-mist px-3 text-xs font-semibold text-ink disabled:opacity-50"
                    type="button"
                    disabled={creatingContact}
                    onClick={() => handleInstantContact(instantNameParticipant, "participant")}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Thêm
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 rounded-[10px] bg-white/[0.05] p-1">
                {(["equal", "custom"] as SplitMode[]).map((splitOption) => (
                  <button
                    key={splitOption}
                    className={`h-10 rounded-[8px] text-sm font-semibold ${
                      splitMode === splitOption ? "bg-mist text-ink" : "text-white/56"
                    }`}
                    type="button"
                    onClick={() => setSplitMode(splitOption)}
                  >
                    {splitOption === "equal" ? "Chia đều" : "Tùy chỉnh"}
                  </button>
                ))}
              </div>

              {splitMode === "custom" && (
                <div className="space-y-2">
                  {participants.map((participant) => (
                    <label key={participant.participantId} className="flex items-center gap-3 rounded-[8px] border border-white/10 bg-white/[0.04] p-2">
                      <span className="w-24 truncate text-sm">{participant.name}</span>
                      <input
                        className="h-10 min-w-0 flex-1 rounded-[8px] border border-white/10 bg-ink px-3 text-right text-mist outline-none"
                        inputMode="numeric"
                        value={formatVndInput(customAmounts[participant.participantId] ?? 0)}
                        onChange={(event) =>
                          setCustomAmounts((current) => ({
                            ...current,
                            [participant.participantId]: event.target.value ? parseVndInput(event.target.value) : undefined
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
                      <span>{findParticipant(share.memberId)?.name ?? share.memberId}</span>
                      <span>
                        {formatVnd(share.amount)} {share.isCustom ? "(custom)" : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {error && <p className="rounded-[8px] bg-coral/12 p-3 text-sm text-coral">{error}</p>}
              <button
                className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-coral font-semibold text-white disabled:opacity-50"
                type="button"
                disabled={submitting}
                onClick={submit}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {mode === "create" ? "Tạo bill" : "Lưu bill"}
              </button>
            </div>
          )}
        </div>
      </div>

      {drawerTarget && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/76 sm:items-center">
          <div className="flex max-h-[80vh] w-full max-w-[440px] flex-col overflow-hidden rounded-t-[18px] border border-white/10 bg-ink shadow-2xl sm:rounded-[18px]">
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
              <h3 className="text-lg font-semibold text-mist">Chọn từ danh bạ</h3>
              <button className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.06]" type="button" title="Đóng" onClick={() => setDrawerTarget(null)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-4">
              {directory.map((participant) => (
                <label
                  key={participant.participantId}
                  className="flex items-center gap-3 rounded-[8px] border border-white/10 bg-white/[0.04] p-2.5"
                >
                  <input
                    className="h-4 w-4 shrink-0"
                    type="checkbox"
                    checked={drawerSelected.includes(participant.participantId)}
                    onChange={() => toggleDrawerSelected(participant.participantId)}
                  />
                  <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/5">
                    <img src={resolveAvatarUrl(participant.name, participant.avatarUrl)} alt={participant.name} className="h-full w-full object-cover" />
                  </div>
                  <span className="min-w-0 flex-1 truncate text-sm text-mist">{participant.name}</span>
                </label>
              ))}
            </div>
            <div className="shrink-0 border-t border-white/10 p-4">
              <button className="h-12 w-full rounded-full bg-coral text-sm font-semibold text-white" type="button" onClick={applyDrawer}>
                Xong
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
