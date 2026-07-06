import { Check, Heart, Search, UserMinus, UserPlus, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  acceptFriendRequest,
  addFavorite,
  getFriendRequests,
  getFriends,
  rejectFriendRequest,
  removeFavorite,
  removeFriend,
  searchFriends,
  sendFriendRequest
} from "../../data/api";
import { resolveAvatarUrl } from "../../lib/avatar";
import type { Friend, FriendRequests, FriendSearchResult } from "../../types/sharebill";

type FriendsModalProps = {
  onClose: () => void;
};

type FriendsTab = "friends" | "requests" | "search";

export function FriendsModal({ onClose }: FriendsModalProps) {
  const [tab, setTab] = useState<FriendsTab>("friends");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequests>({ incoming: [], outgoing: [] });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FriendSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    const [nextFriends, nextRequests] = await Promise.all([getFriends(), getFriendRequests()]);
    setFriends(nextFriends);
    setRequests(nextRequests);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleToggleFavorite(friend: Friend) {
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
    <div className="fixed inset-0 z-30 grid place-items-end bg-black/76 sm:place-items-center">
      <div className="flex max-h-[90vh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-[18px] border border-white/10 bg-ink shadow-2xl sm:rounded-[18px]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 className="text-lg font-semibold text-mist">Bạn bè</h2>
          <button
            className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.06] transition-colors hover:bg-white/10"
            type="button"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-4 pt-3">
          <div className="grid grid-cols-3 gap-2 rounded-[10px] bg-white/[0.05] p-1">
            {(["friends", "requests", "search"] as FriendsTab[]).map((t) => (
              <button
                key={t}
                className={`h-10 rounded-[8px] text-sm font-semibold ${tab === t ? "bg-mist text-ink" : "text-white/56"}`}
                type="button"
                onClick={() => setTab(t)}
              >
                {t === "friends"
                  ? "Bạn bè"
                  : t === "requests"
                    ? `Lời mời${requests.incoming.length ? ` (${requests.incoming.length})` : ""}`
                    : "Tìm"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {error && <p className="mb-3 rounded-[8px] bg-coral/12 p-3 text-sm text-coral">{error}</p>}

          {tab === "friends" && (
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
                    onClick={() => handleToggleFavorite(friend)}
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
          )}

          {tab === "requests" && (
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

          {tab === "search" && (
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
  );
}
