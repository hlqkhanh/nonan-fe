import type {
  Expense,
  Group,
  Settlement,
  LedgerCycle,
  LedgerCycleDetail,
  User,
  BillTitleTemplate,
  Friend,
  FriendRequests,
  FriendSearchResult,
  Contact,
  FavoriteTargetType,
  ParticipantType
} from "../types/sharebill";

const TOKEN_KEY = "sharebill.token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  unauthorizedFired = false; // reset on new login
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// Prevent multiple concurrent 401s from each dispatching the unauthorized event
// and clearing the token redundantly (race condition when parallel requests 401).
let unauthorizedFired = false;

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const response = await fetch(url, {
    ...init,
    headers: { ...headers, ...(init?.headers as Record<string, string> | undefined) }
  });

  if (response.status === 401) {
    if (!unauthorizedFired) {
      unauthorizedFired = true;
      clearToken();
      window.dispatchEvent(new Event("sharebill:unauthorized"));
    }
    throw new Error("Unauthorized");
  }

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    try {
      const body = await response.json();
      if (body?.message) message = body.message;
    } catch {
      // ignore body parse failure
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

// ----------------- Auth -----------------

type AuthResponse = { token: string; user: User };

export async function signup(email: string, password: string, displayName: string): Promise<User> {
  const result = await fetchJson<AuthResponse>("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password, displayName })
  });
  setToken(result.token);
  return result.user;
}

export async function login(email: string, password: string): Promise<User> {
  const result = await fetchJson<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  setToken(result.token);
  return result.user;
}

export async function getMe(): Promise<User> {
  return fetchJson<User>("/api/auth/me");
}

// ----------------- Profile -----------------

export async function updateProfile(input: { displayName: string; username: string; avatarUrl?: string }): Promise<User> {
  return fetchJson<User>("/api/me", {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await fetchJson<void>("/api/me/password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword })
  });
}

export type AvatarUploadSignature = {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
};

export async function getAvatarUploadSignature(): Promise<AvatarUploadSignature> {
  return fetchJson<AvatarUploadSignature>("/api/me/avatar/signature", { method: "POST" });
}

export async function uploadImageToCloudinary(file: File, signature: AvatarUploadSignature): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append("api_key", signature.apiKey);
  form.append("timestamp", String(signature.timestamp));
  form.append("signature", signature.signature);
  form.append("folder", signature.folder);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`, {
    method: "POST",
    body: form
  });

  if (!response.ok) {
    throw new Error("Không thể tải ảnh lên.");
  }

  const data = await response.json();
  return data.secure_url as string;
}

// Kept as an alias — existing callers (avatar picker) still read naturally as "upload avatar".
export const uploadAvatarToCloudinary = uploadImageToCloudinary;

export async function getBillTemplates(): Promise<BillTitleTemplate[]> {
  return fetchJson<BillTitleTemplate[]>("/api/me/bill-templates");
}

export async function saveBillTemplates(labels: string[]): Promise<BillTitleTemplate[]> {
  return fetchJson<BillTitleTemplate[]>("/api/me/bill-templates", {
    method: "PUT",
    body: JSON.stringify({ labels })
  });
}

// ----------------- Groups -----------------

export type GroupMemberSelection = { targetType: ParticipantType; targetId: string };

export async function getGroups(): Promise<Group[]> {
  return fetchJson<Group[]>("/api/groups");
}

export async function createGroup(name: string, members: GroupMemberSelection[] = []): Promise<Group> {
  return fetchJson<Group>("/api/groups", {
    method: "POST",
    body: JSON.stringify({ name, members })
  });
}

export async function renameGroup(groupId: string, name: string): Promise<Group> {
  return fetchJson<Group>(`/api/groups/${groupId}`, {
    method: "PATCH",
    body: JSON.stringify({ name })
  });
}

export async function addGroupMember(groupId: string, targetType: ParticipantType, targetId: string): Promise<Group> {
  return fetchJson<Group>(`/api/groups/${groupId}/members`, {
    method: "POST",
    body: JSON.stringify({ targetType, targetId })
  });
}

export async function removeGroupMember(groupId: string, targetType: ParticipantType, targetId: string): Promise<Group> {
  return fetchJson<Group>(`/api/groups/${groupId}/members/${targetType}/${targetId}`, { method: "DELETE" });
}

export async function deleteGroup(groupId: string): Promise<void> {
  await fetchJson<void>(`/api/groups/${groupId}`, { method: "DELETE" });
}

// ----------------- Ledger (shared: a cycle is visible to every -----------------
// -------------------- user-participant of the bills inside it) --------------------

export async function getCurrentLedgerCycle(): Promise<LedgerCycleDetail> {
  return fetchJson<LedgerCycleDetail>("/api/ledger/current");
}

// All cycles the current user is a member of (their own + shared-in).
export async function getLedgerCycles(): Promise<LedgerCycle[]> {
  return fetchJson<LedgerCycle[]>("/api/ledger/cycles");
}

export async function getLedgerCycleDetail(cycleId: string): Promise<LedgerCycleDetail> {
  return fetchJson<LedgerCycleDetail>(`/api/ledger/cycles/${cycleId}`);
}

export async function settleLedgerCycle(cycleId: string): Promise<LedgerCycleDetail> {
  return fetchJson<LedgerCycleDetail>(`/api/ledger/cycles/${cycleId}/settle`, { method: "POST" });
}

export async function archiveLedgerCycle(cycleId: string): Promise<LedgerCycleDetail> {
  return fetchJson<LedgerCycleDetail>(`/api/ledger/cycles/${cycleId}/archive`, { method: "POST" });
}

// "Hủy tất toán" — reopens a settled/archived cycle so bills can be added/edited again.
export async function reopenLedgerCycle(cycleId: string): Promise<LedgerCycleDetail> {
  return fetchJson<LedgerCycleDetail>(`/api/ledger/cycles/${cycleId}/reopen`, { method: "POST" });
}

// "Đưa lên trang chủ" — per-viewer: activates this cycle on the viewer's home
// screen, swapping off whichever cycle was previously active for them. Does
// not affect any other member.
export async function setActiveLedgerCycle(cycleId: string): Promise<LedgerCycleDetail> {
  return fetchJson<LedgerCycleDetail>(`/api/ledger/cycles/${cycleId}/set-active`, { method: "POST" });
}

// ----------------- Expenses (shared with every member of the bill's cycle) -----------------

export async function getExpenses(): Promise<Expense[]> {
  return fetchJson<Expense[]>("/api/expenses");
}

export async function createExpense(expense: Expense): Promise<Expense> {
  return fetchJson<Expense>("/api/expenses", {
    method: "POST",
    body: JSON.stringify(expense)
  });
}

export async function updateExpense(expenseId: string, expense: Expense): Promise<Expense> {
  return fetchJson<Expense>(`/api/expenses/${expenseId}`, {
    method: "PUT",
    body: JSON.stringify(expense)
  });
}

export async function deleteExpense(expenseId: string): Promise<void> {
  await fetchJson<void>(`/api/expenses/${expenseId}`, { method: "DELETE" });
}

export async function getBillPhotoUploadSignature(): Promise<AvatarUploadSignature> {
  return fetchJson<AvatarUploadSignature>("/api/expenses/photo/signature", { method: "POST" });
}

// ----------------- Settlements -----------------

export async function getSettlements(): Promise<Settlement[]> {
  return fetchJson<Settlement[]>("/api/settlements");
}

export async function markSettlementPaid(cycleId: string, settlementId: string): Promise<Settlement[]> {
  return fetchJson<Settlement[]>(`/api/ledger/cycles/${cycleId}/settlements/mark-paid`, {
    method: "POST",
    body: JSON.stringify({ settlementId })
  });
}

export async function adjustSettlement(cycleId: string, settlementId: string, deltaAmount: number): Promise<Settlement[]> {
  return fetchJson<Settlement[]>(`/api/ledger/cycles/${cycleId}/settlements/adjust`, {
    method: "POST",
    body: JSON.stringify({ settlementId, deltaAmount })
  });
}

// ----------------- Friends -----------------

export async function getFriends(): Promise<Friend[]> {
  return fetchJson<Friend[]>("/api/friends");
}

export async function getFriendRequests(): Promise<FriendRequests> {
  return fetchJson<FriendRequests>("/api/friends/requests");
}

export async function searchFriends(query: string): Promise<FriendSearchResult[]> {
  return fetchJson<FriendSearchResult[]>(`/api/friends/search?q=${encodeURIComponent(query)}`);
}

export async function sendFriendRequest(username: string): Promise<void> {
  await fetchJson<void>("/api/friends/requests", {
    method: "POST",
    body: JSON.stringify({ username })
  });
}

export async function acceptFriendRequest(requestId: string): Promise<void> {
  await fetchJson<void>(`/api/friends/requests/${requestId}/accept`, { method: "POST" });
}

export async function rejectFriendRequest(requestId: string): Promise<void> {
  await fetchJson<void>(`/api/friends/requests/${requestId}/reject`, { method: "POST" });
}

export async function removeFriend(friendUserId: string): Promise<void> {
  await fetchJson<void>(`/api/friends/${friendUserId}`, { method: "DELETE" });
}

// ----------------- Contacts -----------------

export async function getContacts(): Promise<Contact[]> {
  return fetchJson<Contact[]>("/api/contacts");
}

export async function createContact(name: string, avatarUrl?: string): Promise<Contact> {
  return fetchJson<Contact>("/api/contacts", {
    method: "POST",
    body: JSON.stringify({ name, avatarUrl })
  });
}

export async function updateContact(contactId: string, name: string, avatarUrl?: string): Promise<Contact> {
  return fetchJson<Contact>(`/api/contacts/${contactId}`, {
    method: "PATCH",
    body: JSON.stringify({ name, avatarUrl })
  });
}

export async function deleteContact(contactId: string): Promise<void> {
  await fetchJson<void>(`/api/contacts/${contactId}`, { method: "DELETE" });
}

// ----------------- Favorites -----------------

export async function addFavorite(targetType: FavoriteTargetType, targetId: string): Promise<void> {
  await fetchJson<void>("/api/favorites", {
    method: "POST",
    body: JSON.stringify({ targetType, targetId })
  });
}

export async function removeFavorite(targetType: FavoriteTargetType, targetId: string): Promise<void> {
  await fetchJson<void>(`/api/favorites/${targetType}/${targetId}`, { method: "DELETE" });
}
