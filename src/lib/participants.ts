import { resolveAvatarUrl } from "./avatar";
import type { Contact, Friend, Group, Participant, User } from "../types/sharebill";

export type ParticipantInfo = { name: string; avatarUrl?: string };
export type ParticipantMap = Map<string, ParticipantInfo>;

/**
 * Builds a lookup from prefixed participant id ("user:<id>" / "contact:<id>")
 * to display name + avatar, from the data the frontend already has locally
 * (the current user, their friends, and their contacts). Used to resolve
 * settlement pair ids, which the backend returns without embedded names.
 */
export function buildParticipantMap(self: User | null, friends: Friend[], contacts: Contact[], groups: Group[] = []): ParticipantMap {
  const map: ParticipantMap = new Map();
  if (self) {
    map.set(`user:${self.id}`, { name: self.displayName, avatarUrl: self.avatarUrl });
  }
  for (const friend of friends) {
    map.set(`user:${friend.userId}`, { name: friend.displayName, avatarUrl: friend.avatarUrl });
  }
  for (const contact of contacts) {
    map.set(`contact:${contact.id}`, { name: contact.name, avatarUrl: contact.avatarUrl });
  }
  // Group bundles may reference participants not otherwise known locally
  // (defensive fallback only; normally already covered by friends/contacts above).
  for (const group of groups) {
    for (const member of group.members) {
      if (!map.has(member.participantId)) {
        map.set(member.participantId, { name: member.name, avatarUrl: member.avatarUrl });
      }
    }
  }
  return map;
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
