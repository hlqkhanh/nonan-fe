export const AVATAR_PRESET_SEEDS = [
  "Nova",
  "Comet",
  "Sunny",
  "Pixel",
  "Luna",
  "Marble",
  "Ivy",
  "Otto"
];

export function diceBearUrl(seed: string): string {
  return `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(seed)}`;
}

export function resolveAvatarUrl(name: string, avatarUrl?: string | null): string {
  return avatarUrl && avatarUrl.trim() ? avatarUrl : diceBearUrl(name);
}
