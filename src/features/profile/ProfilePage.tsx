import { ChevronRight, Contact as ContactIcon, KeyRound, LogOut, Pencil, Tags, Users } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { changePassword, updateProfile } from "../../data/api";
import { resolveAvatarUrl } from "../../lib/avatar";
import type { BillTitleTemplate } from "../../types/sharebill";
import { AvatarPickerModal } from "./AvatarPickerModal";
import { BillTemplatesModal } from "./BillTemplatesModal";
import { ChangePasswordModal } from "./ChangePasswordModal";
import { ContactsModal } from "./ContactsModal";
import { EditProfileModal } from "./EditProfileModal";
import { FriendsModal } from "./FriendsModal";

type ProfilePageProps = {
  billTemplates: BillTitleTemplate[];
  onSaveBillTemplates: (labels: string[]) => Promise<void>;
};

type ProfileModal = "avatar" | "edit" | "password" | "badges" | "friends" | "contacts" | null;

export function ProfilePage({ billTemplates, onSaveBillTemplates }: ProfilePageProps) {
  const { user, logout, updateUser } = useAuth();
  const [openModal, setOpenModal] = useState<ProfileModal>(null);

  if (!user) return null;

  async function handleAvatarSelect(avatarUrl: string) {
    const updated = await updateProfile({ displayName: user!.displayName, username: user!.username, avatarUrl });
    updateUser(updated);
  }

  async function handleProfileSave(input: { displayName: string; username: string }) {
    const updated = await updateProfile({ ...input, avatarUrl: user!.avatarUrl });
    updateUser(updated);
  }

  async function handlePasswordSave(currentPassword: string, newPassword: string) {
    await changePassword(currentPassword, newPassword);
  }

  return (
    <div className="px-4 pb-24 pt-8">
      <div className="text-center">
        <button className="relative mx-auto mb-4 block" type="button" onClick={() => setOpenModal("avatar")} title="Đổi avatar">
          <div className="mx-auto h-20 w-20 overflow-hidden rounded-full border-2 border-white/10 bg-white/10">
            <img
              src={resolveAvatarUrl(user.displayName, user.avatarUrl)}
              alt={user.displayName}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="absolute -bottom-1 right-0 grid h-7 w-7 place-items-center rounded-full border-2 border-ink bg-coral">
            <Pencil className="h-3.5 w-3.5 text-white" />
          </div>
        </button>
        <p className="font-semibold text-mist">{user.displayName}</p>
        <p className="text-sm text-white/45">@{user.username}</p>
        <p className="mb-6 text-sm text-white/45">{user.email}</p>
      </div>

      <div className="space-y-2">
        <button
          className="flex w-full items-center gap-3 rounded-[8px] border border-white/10 bg-white/[0.04] p-3 text-left"
          type="button"
          onClick={() => setOpenModal("edit")}
        >
          <Pencil className="h-4 w-4 text-white/50" />
          <span className="flex-1 text-sm font-medium text-mist">Sửa hồ sơ</span>
          <ChevronRight className="h-4 w-4 text-white/30" />
        </button>

        <button
          className="flex w-full items-center gap-3 rounded-[8px] border border-white/10 bg-white/[0.04] p-3 text-left"
          type="button"
          onClick={() => setOpenModal("password")}
        >
          <KeyRound className="h-4 w-4 text-white/50" />
          <span className="flex-1 text-sm font-medium text-mist">Đổi mật khẩu</span>
          <ChevronRight className="h-4 w-4 text-white/30" />
        </button>

        <button
          className="flex w-full items-center gap-3 rounded-[8px] border border-white/10 bg-white/[0.04] p-3 text-left"
          type="button"
          onClick={() => setOpenModal("badges")}
        >
          <Tags className="h-4 w-4 text-white/50" />
          <span className="flex-1 text-sm font-medium text-mist">Mẫu tên bill</span>
          <span className="text-xs text-white/35">{billTemplates.length}/5</span>
          <ChevronRight className="h-4 w-4 text-white/30" />
        </button>

        <button
          className="flex w-full items-center gap-3 rounded-[8px] border border-white/10 bg-white/[0.04] p-3 text-left"
          type="button"
          onClick={() => setOpenModal("friends")}
        >
          <Users className="h-4 w-4 text-white/50" />
          <span className="flex-1 text-sm font-medium text-mist">Bạn bè</span>
          <ChevronRight className="h-4 w-4 text-white/30" />
        </button>

        <button
          className="flex w-full items-center gap-3 rounded-[8px] border border-white/10 bg-white/[0.04] p-3 text-left"
          type="button"
          onClick={() => setOpenModal("contacts")}
        >
          <ContactIcon className="h-4 w-4 text-white/50" />
          <span className="flex-1 text-sm font-medium text-mist">Danh bạ tạm</span>
          <ChevronRight className="h-4 w-4 text-white/30" />
        </button>
      </div>

      <button
        className="mx-auto mt-8 flex h-11 items-center gap-2 rounded-full border border-white/14 px-5 text-sm font-semibold text-white/70"
        type="button"
        onClick={logout}
      >
        <LogOut className="h-4 w-4" />
        Đăng xuất
      </button>

      {openModal === "avatar" && (
        <AvatarPickerModal currentAvatarUrl={user.avatarUrl} onClose={() => setOpenModal(null)} onSelect={handleAvatarSelect} />
      )}
      {openModal === "edit" && <EditProfileModal user={user} onClose={() => setOpenModal(null)} onSave={handleProfileSave} />}
      {openModal === "password" && <ChangePasswordModal onClose={() => setOpenModal(null)} onSave={handlePasswordSave} />}
      {openModal === "badges" && (
        <BillTemplatesModal templates={billTemplates} onClose={() => setOpenModal(null)} onSave={onSaveBillTemplates} />
      )}
      {openModal === "friends" && <FriendsModal onClose={() => setOpenModal(null)} />}
      {openModal === "contacts" && <ContactsModal onClose={() => setOpenModal(null)} />}
    </div>
  );
}
