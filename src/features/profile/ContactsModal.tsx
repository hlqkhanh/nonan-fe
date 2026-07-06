import { Heart, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { addFavorite, createContact, deleteContact, getContacts, removeFavorite, updateContact } from "../../data/api";
import { resolveAvatarUrl } from "../../lib/avatar";
import type { Contact } from "../../types/sharebill";
import { AvatarPickerModal } from "./AvatarPickerModal";

type ContactsModalProps = {
  onClose: () => void;
};

export function ContactsModal({ onClose }: ContactsModalProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function refresh() {
    setContacts(await getContacts());
  }

  useEffect(() => {
    void refresh();
  }, []);

  function openCreateForm() {
    setEditingContact(null);
    setName("");
    setAvatarUrl(undefined);
    setError("");
    setShowForm(true);
  }

  function openEditForm(contact: Contact) {
    setEditingContact(contact);
    setName(contact.name);
    setAvatarUrl(contact.avatarUrl);
    setError("");
    setShowForm(true);
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("Hãy nhập tên.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      if (editingContact) {
        await updateContact(editingContact.id, name.trim(), avatarUrl);
      } else {
        await createContact(name.trim(), avatarUrl);
      }
      setShowForm(false);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể lưu liên hệ.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(contact: Contact) {
    if (!confirm(`Xóa liên hệ ${contact.name}?`)) return;
    await deleteContact(contact.id);
    await refresh();
  }

  async function handleToggleFavorite(contact: Contact) {
    if (contact.isFavorite) {
      await removeFavorite("contact", contact.id);
    } else {
      await addFavorite("contact", contact.id);
    }
    await refresh();
  }

  return (
    <>
      <div className="fixed inset-0 z-30 grid place-items-end bg-black/76 sm:place-items-center">
        <div className="flex max-h-[90vh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-[18px] border border-white/10 bg-ink shadow-2xl sm:rounded-[18px]">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <h2 className="text-lg font-semibold text-mist">Danh bạ tạm</h2>
            <div className="flex items-center gap-2">
              {!showForm && (
                <button
                  className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.06] transition-colors hover:bg-white/10"
                  type="button"
                  onClick={openCreateForm}
                  title="Thêm liên hệ"
                >
                  <Plus className="h-5 w-5" />
                </button>
              )}
              <button
                className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.06] transition-colors hover:bg-white/10"
                type="button"
                onClick={onClose}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {!showForm ? (
              <div className="space-y-2">
                {contacts.length === 0 && <p className="text-sm text-white/45">Chưa có liên hệ tạm thời nào.</p>}
                {contacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center gap-3 rounded-[8px] border border-white/10 bg-white/[0.04] p-2.5"
                  >
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/5">
                      <img
                        src={resolveAvatarUrl(contact.name, contact.avatarUrl)}
                        alt={contact.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold text-mist">{contact.name}</p>
                    <button
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 ${contact.isFavorite ? "text-coral" : "text-white/40"}`}
                      type="button"
                      title={contact.isFavorite ? "Bỏ yêu thích" : "Đánh dấu yêu thích"}
                      onClick={() => handleToggleFavorite(contact)}
                    >
                      <Heart className="h-4 w-4" fill={contact.isFavorite ? "currentColor" : "none"} />
                    </button>
                    <button
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 text-white/50"
                      type="button"
                      title="Sửa"
                      onClick={() => openEditForm(contact)}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 text-white/40 hover:text-coral"
                      type="button"
                      title="Xóa"
                      onClick={() => handleDelete(contact)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <button className="mx-auto block" type="button" onClick={() => setShowAvatarPicker(true)}>
                  <div className="mx-auto h-16 w-16 overflow-hidden rounded-full border-2 border-white/10 bg-white/10">
                    <img
                      src={resolveAvatarUrl(name || "?", avatarUrl)}
                      alt="avatar"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <p className="mt-1 text-center text-xs text-white/40">Chọn avatar</p>
                </button>

                <label className="block">
                  <span className="mb-1 block text-sm text-white/55">Tên</span>
                  <input
                    className="h-12 w-full rounded-[8px] border border-white/10 bg-white/[0.06] px-3 text-mist outline-none focus:border-coral"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Tên thành viên tạm thời"
                  />
                </label>

                {error && <p className="rounded-[8px] bg-coral/12 p-3 text-sm text-coral">{error}</p>}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    className="h-12 rounded-full border border-white/14 text-sm font-semibold text-mist"
                    type="button"
                    onClick={() => setShowForm(false)}
                  >
                    Hủy
                  </button>
                  <button
                    className="h-12 rounded-full bg-coral text-sm font-semibold text-white disabled:opacity-50"
                    type="button"
                    disabled={submitting}
                    onClick={handleSave}
                  >
                    Lưu
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showAvatarPicker && (
        <AvatarPickerModal
          currentAvatarUrl={avatarUrl}
          onClose={() => setShowAvatarPicker(false)}
          onSelect={async (url) => setAvatarUrl(url)}
        />
      )}
    </>
  );
}
