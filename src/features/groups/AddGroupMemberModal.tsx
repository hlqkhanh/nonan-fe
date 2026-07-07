import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { getContacts, getFriends, type GroupMemberSelection } from "../../data/api";
import { resolveAvatarUrl } from "../../lib/avatar";
import type { Contact, Friend, Group } from "../../types/sharebill";

type AddGroupMemberModalProps = {
  group: Group;
  onClose: () => void;
  onConfirm: (members: GroupMemberSelection[]) => Promise<void>;
};

export function AddGroupMemberModal({ group, onClose, onConfirm }: AddGroupMemberModalProps) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<GroupMemberSelection[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void (async () => {
      const [nextFriends, nextContacts] = await Promise.all([getFriends(), getContacts()]);
      setFriends(nextFriends);
      setContacts(nextContacts);
    })();
  }, []);

  function isMember(targetType: "user" | "contact", targetId: string): boolean {
    return group.members.some((member) => member.participantId === `${targetType}:${targetId}`);
  }

  function isSelected(targetType: "user" | "contact", targetId: string): boolean {
    return selected.some((member) => member.targetType === targetType && member.targetId === targetId);
  }

  function toggle(targetType: "user" | "contact", targetId: string) {
    setSelected((current) => {
      if (current.some((member) => member.targetType === targetType && member.targetId === targetId)) {
        return current.filter((member) => !(member.targetType === targetType && member.targetId === targetId));
      }
      return [...current, { targetType, targetId }];
    });
  }

  const availableFriends = friends.filter((friend) => !isMember("user", friend.userId));
  const availableContacts = contacts.filter((contact) => !isMember("contact", contact.id));

  async function handleSubmit() {
    if (selected.length === 0) {
      setError("Hãy chọn ít nhất một thành viên.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await onConfirm(selected);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể thêm thành viên.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-end bg-black/76 sm:place-items-center">
      <div className="flex max-h-[90vh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-[18px] border border-white/10 bg-ink shadow-2xl sm:rounded-[18px]">
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 className="text-lg font-semibold text-mist">Thêm thành viên</h2>
          <button
            className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.06] transition-colors hover:bg-white/10"
            type="button"
            title="Đóng"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">Bạn bè</p>
            <div className="space-y-2">
              {availableFriends.length === 0 && (
                <p className="text-sm text-white/45">Không có bạn bè nào để thêm.</p>
              )}
              {availableFriends.map((friend) => (
                <label
                  key={friend.userId}
                  className="flex items-center gap-3 rounded-[8px] border border-white/10 bg-white/[0.04] p-2.5"
                >
                  <input
                    className="h-4 w-4 shrink-0"
                    type="checkbox"
                    checked={isSelected("user", friend.userId)}
                    onChange={() => toggle("user", friend.userId)}
                  />
                  <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/5">
                    <img
                      src={resolveAvatarUrl(friend.displayName, friend.avatarUrl)}
                      alt={friend.displayName}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <span className="min-w-0 flex-1 truncate text-sm text-mist">{friend.displayName}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">Danh bạ tạm</p>
            <div className="space-y-2">
              {availableContacts.length === 0 && (
                <p className="text-sm text-white/45">Không có liên hệ tạm thời nào để thêm.</p>
              )}
              {availableContacts.map((contact) => (
                <label
                  key={contact.id}
                  className="flex items-center gap-3 rounded-[8px] border border-white/10 bg-white/[0.04] p-2.5"
                >
                  <input
                    className="h-4 w-4 shrink-0"
                    type="checkbox"
                    checked={isSelected("contact", contact.id)}
                    onChange={() => toggle("contact", contact.id)}
                  />
                  <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/5">
                    <img
                      src={resolveAvatarUrl(contact.name, contact.avatarUrl)}
                      alt={contact.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <span className="min-w-0 flex-1 truncate text-sm text-mist">{contact.name}</span>
                </label>
              ))}
            </div>
          </div>

          {error && <p className="rounded-[8px] bg-coral/12 p-3 text-sm text-coral">{error}</p>}

          <button
            className="h-12 w-full rounded-full bg-coral font-semibold text-white disabled:opacity-50"
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
          >
            Thêm thành viên
          </button>
        </div>
      </div>
    </div>
  );
}
