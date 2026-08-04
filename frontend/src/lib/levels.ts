const LEVELS = [
  [0, "Rookie", "🐣"],
  [50, "Go-Getter", "🐥"],
  [150, "Challenger", "⚡"],
  [300, "Rising Star", "🌟"],
  [500, "Quest Addict", "🎯"],
  [800, "Squad Legend", "🔥"],
  [1200, "Fearless", "🦁"],
  [1800, "Unstoppable", "🚀"],
  [2500, "SideQuest King", "👑"],
  [4000, "Mythic", "💎"],
] as const;

export function levelFor(points: number): number {
  for (let i = 0; i < LEVELS.length; i++) {
    if (points < LEVELS[i][0]) return Math.max(1, i);
  }
  return LEVELS.length;
}

export function levelTitle(points: number): string {
  return LEVELS[levelFor(points) - 1][1];
}

export function levelIcon(points: number): string {
  return LEVELS[levelFor(points) - 1][2];
}

export function levelProgress(points: number): { fraction: number; into: number; span: number; level: number } {
  const level = levelFor(points);
  const lo = LEVELS[level - 1][0];
  const hi = LEVELS[Math.min(level, LEVELS.length - 1)][0];
  const span = hi - lo;
  if (span <= 0) return { fraction: 1, into: 0, span: 0, level };
  return { fraction: Math.min(1, (points - lo) / span), into: points - lo, span, level };
}
