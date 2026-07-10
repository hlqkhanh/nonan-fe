import { resolveAvatarUrl } from "./avatar";
import type { Contact, Friend, Group, LedgerCycleMemberInfo, Participant, User } from "../types/sharebill";

export type ParticipantInfo = { name: string; avatarUrl?: string };
export type ParticipantMap = Map<string, ParticipantInfo>;

/**
 * Builds a lookup from prefixed participant id ("user:<id>" / "contact:<id>")
 * to display name + avatar.
 *
 * Ledger cycles are now shared: a bill's payers/participants can reference
 * `user:<id>` for someone who isn't a friend of the viewer (they were just a
 * co-participant on a shared bill). The backend resolves those ids for us in
 * `LedgerCycleDetail.members` — prefer that when present, and only fall back
 * to the viewer's own directory (self/friends/contacts/groups) for ids the
 * backend payload didn't cover.
 */
export function buildParticipantMap(
  self: User | null,
  friends: Friend[],
  contacts: Contact[],
  groups: Group[] = [],
  membersFromBackend: Record<string, LedgerCycleMemberInfo> = {}
): ParticipantMap {
  const map: ParticipantMap = new Map();

  // Backend-resolved members first: authoritative for shared cycles.
  for (const member of Object.values(membersFromBackend)) {
    map.set(member.memberId, { name: member.displayName, avatarUrl: member.avatarUrl });
  }

  // Fallback: viewer's own local directory, for anything the backend payload
  // didn't include (e.g. before any cycle detail has loaded).
  if (self && !map.has(`user:${self.id}`)) {
    map.set(`user:${self.id}`, { name: self.displayName, avatarUrl: self.avatarUrl });
  }
  for (const friend of friends) {
    if (!map.has(`user:${friend.userId}`)) {
      map.set(`user:${friend.userId}`, { name: friend.displayName, avatarUrl: friend.avatarUrl });
    }
  }
  for (const contact of contacts) {
    if (!map.has(`contact:${contact.id}`)) {
      map.set(`contact:${contact.id}`, { name: contact.name, avatarUrl: contact.avatarUrl });
    }
  }
  // Group bundles may reference participants not otherwise known locally
  // (defensive fallback only; normally already covered above).
  for (const group of groups) {
    for (const member of group.members) {
      if (!map.has(member.participantId)) {
        map.set(member.participantId, { name: member.name, avatarUrl: member.avatarUrl });
      }
    }
  }
  return map;
}

/**
 * Merges a backend-resolved members map (from a freshly fetched
 * LedgerCycleDetail) into an existing participant map, in place-safe
 * fashion (returns a new map). Backend entries win over what's already
 * there, since they're authoritative for the cycle just fetched.
 */
export function mergeParticipantMembers(
  map: ParticipantMap,
  membersFromBackend: Record<string, LedgerCycleMemberInfo> = {}
): ParticipantMap {
  const next: ParticipantMap = new Map(map);
  for (const member of Object.values(membersFromBackend)) {
    next.set(member.memberId, { name: member.displayName, avatarUrl: member.avatarUrl });
  }
  return next;
}

export function toParticipants(map: ParticipantMap): Participant[] {
  return Array.from(map.entries()).map(([participantId, info]) => ({
    participantId,
    name: info.name,
    avatarUrl: info.avatarUrl,
    type: participantId.startsWith("contact:") ? "contact" : "user"
  }));
}

export function participantName(map: ParticipantMap, participantId: string): string {
  return map.get(participantId)?.name ?? participantId;
}

export function participantAvatar(map: ParticipantMap, participantId: string): string {
  const info = map.get(participantId);
  return resolveAvatarUrl(info?.name ?? participantId, info?.avatarUrl);
}
