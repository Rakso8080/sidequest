const DIFFICULTY_STYLES: Record<string, { label: string; cls: string }> = {
  easy: { label: "Easy", cls: "bg-emerald-500/20 text-emerald-300" },
  medium: { label: "Medium", cls: "bg-amber-500/20 text-amber-300" },
  hard: { label: "Hard", cls: "bg-rose-500/20 text-rose-300" },
};

const PROOF_ICONS: Record<string, string> = {
  photo: "📸",
  video: "🎬",
  text: "✍️",
  self_report: "✅",
};

export function difficultyStyle(d: string) {
  return DIFFICULTY_STYLES[d] ?? DIFFICULTY_STYLES.medium;
}

export function proofIcon(t: string) {
  return PROOF_ICONS[t] ?? "📎";
}

export function proofLabel(t: string) {
  const map: Record<string, string> = {
    photo: "Photo",
    video: "Video",
    text: "Text",
    self_report: "Self report",
  };
  return map[t] ?? t;
}

export function timeLeft(iso: string): { text: string; urgent: boolean; done: boolean } {
  const deadline = new Date(iso).getTime();
  const now = Date.now();
  const ms = deadline - now;
  if (ms <= 0) return { text: "Time's up", urgent: true, done: true };
  const hours = Math.floor(ms / 3600000);
  if (hours < 1) return { text: `${Math.ceil(ms / 60000)}m left`, urgent: true, done: false };
  if (hours < 24) return { text: `${hours}h left`, urgent: true, done: false };
  const days = Math.floor(hours / 24);
  const rem = hours % 24;
  return { text: `${days}d ${rem}h left`, urgent: false, done: false };
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return formatDate(iso);
}

export const AVATARS = ["😎", "🦉", "🦊", "🐻", "🐸", "🦁", "🐼", "🐯", "🐵", "🦄", "🐙", "🍕", "⚡", "🌟", "🔥", "🎯"];

export const RANK_EMOJI: Record<number, string> = {
  1: "🥇",
  2: "🥈",
  3: "🥉",
};
