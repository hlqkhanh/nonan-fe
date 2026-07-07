import { Pencil, Plus, Trash2, UserMinus, UserPlus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { addGroupMember, createGroup, deleteGroup, getGroups, removeGroupMember, renameGroup } from "../../data/api";
import { AddGroupMemberModal } from "../groups/AddGroupMemberModal";
import { CreateGroupModal, type GroupMemberSelection } from "../groups/CreateGroupModal";
import { resolveAvatarUrl } from "../../lib/avatar";
import type { Group, User } from "../../types/sharebill";

type GroupsModalProps = {
  currentUser: User;
  onClose: () => void;
};

export function GroupsModal({ currentUser, onClose }: GroupsModalProps) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [renamingGroup, setRenamingGroup] = useState<Group | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [addingMembersGroup, setAddingMembersGroup] = useState<Group | null>(null);
  const [error, setError] = useState("");

  async function refresh() {
    setGroups(await getGroups());
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleCreate(name: string, members: GroupMemberSelection[]) {
    await createGroup(name, members);
    setShowCreate(false);
    await refresh();
  }

  async function handleDelete(group: Group) {
    if (!confirm(`Xóa nhóm ${group.name}?`)) return;
    setError("");
    try {
      await deleteGroup(group.id);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể xóa nhóm.");
    }
  }

  function openRename(group: Group) {
    setRenamingGroup(group);
    setRenameValue(group.name);
    setError("");
  }

  async function handleRename() {
    if (!renamingGroup) return;
    if (!renameValue.trim()) {
      setError("Hãy nhập tên nhóm.");
      return;
    }
    try {
      await renameGroup(renamingGroup.id, renameValue.trim());
      setRenamingGroup(null);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể đổi tên nhóm.");
    }
  }

  async function handleRemoveMember(group: Group, participantId: string, type: "user" | "contact") {
    const targetId = participantId.slice(participantId.indexOf(":") + 1);
    try {
      await removeGroupMember(group.id, type, targetId);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể xóa thành viên.");
    }
  }

  async function handleAddMembers(group: Group, members: GroupMemberSelection[]) {
    for (const member of members) {
      await addGroupMember(group.id, member.targetType, member.targetId);
    }
    setAddingMembersGroup(null);
    await refresh();
  }

  return (
    <>
      <div className="fixed inset-0 z-30 grid place-items-end bg-black/76 sm:place-items-center">
        <div className="flex max-h-[90vh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-[18px] border border-white/10 bg-ink shadow-2xl sm:rounded-[18px]">
          <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
            <h2 className="text-lg font-semibold text-mist">Nhóm</h2>
            <div className="flex items-center gap-2">
              <button
                className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.06] transition-colors hover:bg-white/10"
                type="button"
                title="Tạo nhóm"
                onClick={() => setShowCreate(true)}
              >
                <Plus className="h-5 w-5" />
              </button>
              <button
                className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.06] transition-colors hover:bg-white/10"
                type="button"
                title="Đóng"
                onClick={onClose}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {error && <p className="rounded-[8px] bg-coral/12 p-3 text-sm text-coral">{error}</p>}
            {groups.length === 0 && <p className="text-sm text-white/45">Chưa có nhóm nào.</p>}
            {groups.map((group) => (
              <div key={group.id} className="rounded-[8px] border border-white/10 bg-white/[0.04] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="min-w-0">
                    <span className="font-semibold text-mist">{group.name}</span>
                    {group.createdByUserId && group.createdByUserId !== currentUser.id && (
                      <span className="ml-2 text-xs text-white/35">Chia sẻ</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="grid h-8 w-8 place-items-center rounded-full border border-white/10 text-white/50"
                      type="button"
                      title="Thêm thành viên"
                      onClick={() => setAddingMembersGroup(group)}
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      className="grid h-8 w-8 place-items-center rounded-full border border-white/10 text-white/50"
                      type="button"
                      title="Đổi tên"
                      onClick={() => openRename(group)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {(!group.createdByUserId || group.createdByUserId === currentUser.id) && (
                      <button
                        className="grid h-8 w-8 place-items-center rounded-full border border-white/10 text-white/40 hover:text-coral"
                        type="button"
                        title="Xóa nhóm"
                        onClick={() => handleDelete(group)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {group.members.length === 0 && <span className="text-xs text-white/40">Chưa có thành viên.</span>}
                  {group.members.map((member) => (
                    <div
                      key={member.participantId}
                      className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] py-1 pl-1 pr-2"
                    >
                      <div className="h-6 w-6 shrink-0 overflow-hidden rounded-full bg-white/10">
                        <img
                          src={resolveAvatarUrl(member.name, member.avatarUrl)}
                          alt={member.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <span className="text-xs text-mist">{member.name}</span>
                      <button
                        className="text-white/40 hover:text-coral"
                        type="button"
                        title="Xóa khỏi nhóm"
                        onClick={() => handleRemoveMember(group, member.participantId, member.type)}
                      >
                        <UserMinus className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showCreate && <CreateGroupModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />}

      {addingMembersGroup && (
        <AddGroupMemberModal
          group={addingMembersGroup}
          onClose={() => setAddingMembersGroup(null)}
          onConfirm={(members) => handleAddMembers(addingMembersGroup, members)}
        />
      )}

      {renamingGroup && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/76 p-4">
          <div className="w-full max-w-[400px] rounded-[14px] border border-white/10 bg-ink p-4 shadow-2xl">
            <h3 className="mb-3 text-lg font-semibold text-mist">Đổi tên nhóm</h3>
            <input
              className="mb-3 h-12 w-full rounded-[8px] border border-white/10 bg-white/[0.06] px-3 text-mist outline-none focus:border-coral"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
            />
            {error && <p className="mb-3 rounded-[8px] bg-coral/12 p-3 text-sm text-coral">{error}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button
                className="h-12 rounded-full border border-white/14 text-sm font-semibold text-mist"
                type="button"
                onClick={() => setRenamingGroup(null)}
              >
                Hủy
              </button>
              <button
                className="h-12 rounded-full bg-coral text-sm font-semibold text-white"
                type="button"
                onClick={handleRename}
              >
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
