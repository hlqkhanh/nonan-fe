import { Check, Heart, Pencil, Plus, Search, Trash2, UserMinus, UserPlus, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  acceptFriendRequest,
  addFavorite,
  createContact,
  deleteContact,
  getContacts,
  getFriendRequests,
  getFriends,
  rejectFriendRequest,
  removeFavorite,
  removeFriend,
  searchFriends,
  sendFriendRequest,
  updateContact
} from "../../data/api";
import { resolveAvatarUrl } from "../../lib/avatar";
import type { Contact, Friend, FriendRequests, FriendSearchResult } from "../../types/sharebill";
import { AvatarPickerModal } from "./AvatarPickerModal";

type DirectoryModalProps = {
  onClose: () => void;
};

type DirectoryView = "directory" | "search" | "requests";

export function DirectoryModal({ onClose }: DirectoryModalProps) {
  const [view, setView] = useState<DirectoryView>("directory");

  const [friends, setFriends] = useState<Friend[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [requests, setRequests] = useState<FriendRequests>({ incoming: [], outgoing: [] });
  const [error, setError] = useState("");

  // Inline temp-contact create/edit form
  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Search tab state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FriendSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  async function refresh() {
    const [nextFriends, nextContacts, nextRequests] = await Promise.all([
      getFriends(),
      getContacts(),
      getFriendRequests()
    ]);
    setFriends(nextFriends);
    setContacts(nextContacts);
    setRequests(nextRequests);
  }

  useEffect(() => {
    void refresh();
  }, []);

  // ----- Friends actions -----

  async function handleToggleFriendFavorite(friend: Friend) {
    setError("");
    try {
      if (friend.isFavorite) {
        await removeFavorite("user", friend.userId);
      } else {
        await addFavorite("user", friend.userId);
      }
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể cập nhật yêu thích.");
    }
  }

  async function handleRemoveFriend(friend: Friend) {
    if (!confirm(`Xóa ${friend.displayName} khỏi danh sách bạn bè?`)) return;
    setError("");
    try {
      await removeFriend(friend.userId);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể xóa bạn.");
    }
  }

  // ----- Contacts actions -----

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

  async function handleSaveContact() {
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

  async function handleDeleteContact(contact: Contact) {
    if (!confirm(`Xóa liên hệ ${contact.name}?`)) return;
    setError("");
    try {
      await deleteContact(contact.id);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể xóa liên hệ.");
    }
  }

  async function handleToggleContactFavorite(contact: Contact) {
    setError("");
    try {
      if (contact.isFavorite) {
        await removeFavorite("contact", contact.id);
      } else {
        await addFavorite("contact", contact.id);
      }
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể cập nhật yêu thích.");
    }
  }

  // ----- Friend requests actions -----

  async function handleAccept(requestId: string) {
    setError("");
    try {
      await acceptFriendRequest(requestId);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể chấp nhận lời mời.");
    }
  }

  async function handleReject(requestId: string) {
    setError("");
    try {
      await rejectFriendRequest(requestId);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể từ chối lời mời.");
    }
  }

  // ----- Search actions -----

  async function handleSearch() {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    setError("");
    try {
      setSearchResults(await searchFriends(trimmed));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể tìm kiếm.");
    } finally {
      setSearching(false);
    }
  }

  async function handleSendRequest(username: string) {
    setError("");
    try {
      await sendFriendRequest(username);
      await Promise.all([refresh(), handleSearch()]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể gửi lời mời.");
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-30 grid place-items-end bg-black/76 sm:place-items-center">
        <div className="flex max-h-[90vh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-[18px] border border-white/10 bg-ink shadow-2xl sm:rounded-[18px]">
          <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
            <h2 className="text-lg font-semibold text-mist">Danh bạ</h2>
            <button
              className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.06] transition-colors hover:bg-white/10"
              type="button"
              title="Đóng"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="px-4 pt-3">
            <div className="grid grid-cols-3 gap-2 rounded-[10px] bg-white/[0.05] p-1">
              {(["directory", "search", "requests"] as DirectoryView[]).map((v) => (
                <button
                  key={v}
                  className={`h-10 rounded-[8px] text-sm font-semibold ${view === v ? "bg-mist text-ink" : "text-white/56"}`}
                  type="button"
                  onClick={() => setView(v)}
                >
                  {v === "directory"
                    ? "Danh bạ"
                    : v === "search"
                      ? "Tìm"
                      : `Lời mời${requests.incoming.length ? ` (${requests.incoming.length})` : ""}`}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {error && <p className="mb-3 rounded-[8px] bg-coral/12 p-3 text-sm text-coral">{error}</p>}

            {view === "directory" && !showForm && (
              <div className="space-y-4">
                <button
                  className="flex w-full items-center gap-3 rounded-[8px] border border-dashed border-white/14 bg-white/[0.03] p-2.5 text-left"
                  type="button"
                  onClick={openCreateForm}
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.06]">
                    <Plus className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium text-mist">Thêm thành viên tạm thời</span>
                </button>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">Bạn bè</p>
                  <div className="space-y-2">
                    {friends.length === 0 && <p className="text-sm text-white/45">Chưa có bạn bè nào.</p>}
                    {friends.map((friend) => (
                      <div
                        key={friend.userId}
                        className="flex items-center gap-3 rounded-[8px] border border-white/10 bg-white/[0.04] p-2.5"
                      >
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/5">
                          <img
                            src={resolveAvatarUrl(friend.displayName, friend.avatarUrl)}
                            alt={friend.displayName}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-mist">{friend.displayName}</p>
                          <p className="truncate text-xs text-white/40">@{friend.username}</p>
                        </div>
                        <button
                          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 ${friend.isFavorite ? "text-coral" : "text-white/40"}`}
                          type="button"
                          title={friend.isFavorite ? "Bỏ yêu thích" : "Đánh dấu yêu thích"}
                          onClick={() => handleToggleFriendFavorite(friend)}
                        >
                          <Heart className="h-4 w-4" fill={friend.isFavorite ? "currentColor" : "none"} />
                        </button>
                        <button
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 text-white/40 hover:text-coral"
                          type="button"
                          title="Xóa bạn"
                          onClick={() => handleRemoveFriend(friend)}
                        >
                          <UserMinus className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">Tạm thời</p>
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
                          onClick={() => handleToggleContactFavorite(contact)}
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
                          onClick={() => handleDeleteContact(contact)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {view === "directory" && showForm && (
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
                    onClick={handleSaveContact}
                  >
                    Lưu
                  </button>
                </div>
              </div>
            )}

            {view === "requests" && (
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">Lời mời đến</p>
                  <div className="space-y-2">
                    {requests.incoming.length === 0 && <p className="text-sm text-white/45">Không có lời mời nào.</p>}
                    {requests.incoming.map((request) => (
                      <div
                        key={request.id}
                        className="flex items-center gap-3 rounded-[8px] border border-white/10 bg-white/[0.04] p-2.5"
                      >
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/5">
                          <img
                            src={resolveAvatarUrl(request.displayName, request.avatarUrl)}
                            alt={request.displayName}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-mist">{request.displayName}</p>
                          <p className="truncate text-xs text-white/40">@{request.username}</p>
                        </div>
                        <button
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-mint/20 text-mint"
                          type="button"
                          title="Chấp nhận"
                          onClick={() => handleAccept(request.id)}
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-coral/12 text-coral"
                          type="button"
                          title="Từ chối"
                          onClick={() => handleReject(request.id)}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">Đã gửi</p>
                  <div className="space-y-2">
                    {requests.outgoing.length === 0 && <p className="text-sm text-white/45">Chưa gửi lời mời nào.</p>}
                    {requests.outgoing.map((request) => (
                      <div
                        key={request.id}
                        className="flex items-center gap-3 rounded-[8px] border border-white/10 bg-white/[0.04] p-2.5 opacity-70"
                      >
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/5">
                          <img
                            src={resolveAvatarUrl(request.displayName, request.avatarUrl)}
                            alt={request.displayName}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-mist">{request.displayName}</p>
                          <p className="truncate text-xs text-white/40">@{request.username}</p>
                        </div>
                        <span className="text-xs text-white/40">Đang chờ</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {view === "search" && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    className="h-11 min-w-0 flex-1 rounded-[8px] border border-white/10 bg-white/[0.06] px-3 text-sm text-mist outline-none focus:border-coral"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleSearch();
                      }
                    }}
                    placeholder="Nhập username, vd: kientrung"
                  />
                  <button
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-[8px] bg-mist text-ink disabled:opacity-50"
                    type="button"
                    onClick={handleSearch}
                    disabled={searching}
                  >
                    <Search className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-2">
                  {searchResults.map((result) => (
                    <div
                      key={result.userId}
                      className="flex items-center gap-3 rounded-[8px] border border-white/10 bg-white/[0.04] p-2.5"
                    >
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/5">
                        <img
                          src={resolveAvatarUrl(result.displayName, result.avatarUrl)}
                          alt={result.displayName}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-mist">{result.displayName}</p>
                        <p className="truncate text-xs text-white/40">@{result.username}</p>
                      </div>
                      {result.relationship === "none" && (
                        <button
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-mist text-ink"
                          type="button"
                          title="Gửi lời mời"
                          onClick={() => handleSendRequest(result.username)}
                        >
                          <UserPlus className="h-4 w-4" />
                        </button>
                      )}
                      {result.relationship === "friend" && <span className="text-xs text-mint">Bạn bè</span>}
                      {result.relationship === "pending_outgoing" && (
                        <span className="text-xs text-white/40">Đã gửi lời mời</span>
                      )}
                      {result.relationship === "pending_incoming" && (
                        <span className="text-xs text-white/40">Đã mời bạn</span>
                      )}
                    </div>
                  ))}
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
