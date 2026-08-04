import { assetUrl } from "../lib/format";

export function Spinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const cls = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-10 w-10" : "h-6 w-6";
  return (
    <div className="flex items-center justify-center py-8">
      <div
        className={`${cls} animate-spin rounded-full border-[3px] border-white/10 border-t-fuchsia-400`}
      />
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-white/10 border-t-fuchsia-400" />
    </div>
  );
}

export function EmptyState({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <div className="card flex flex-col items-center gap-1 py-10 text-center">
      <div className="text-5xl">{icon}</div>
      <div className="mt-2 font-display text-lg font-bold">{title}</div>
      {subtitle && <div className="text-sm text-white/50">{subtitle}</div>}
    </div>
  );
}

export function Avatar({
  emoji,
  file,
  size = "md",
}: {
  emoji: string;
  file?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
}) {
  const cls =
    size === "xs"
      ? "h-7 w-7 text-sm"
      : size === "sm"
        ? "h-8 w-8 text-lg"
        : size === "lg"
          ? "h-14 w-14 text-3xl"
          : size === "xl"
            ? "h-20 w-20 text-5xl"
            : "h-11 w-11 text-2xl";
  if (file) {
    return (
      <img
        src={assetUrl(file)}
        alt="avatar"
        className={`${cls} shrink-0 rounded-full object-cover ring-1 ring-white/20`}
      />
    );
  }
  return (
    <div
      className={`${cls} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/30 to-fuchsia-500/20 ring-1 ring-white/15`}
    >
      <span>{emoji || "😎"}</span>
    </div>
  );
}

export function ProgressBar({ value, className = "" }: { value: number; className?: string }) {
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-white/10 ${className}`}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-400 transition-all"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function Confetti() {
  const pieces = Array.from({ length: 24 });
  const colors = ["bg-violet-400", "bg-fuchsia-400", "bg-amber-400", "bg-emerald-400", "bg-sky-400"];
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((_, i) => (
        <div
          key={i}
          className={`absolute h-2 w-2 rounded-sm ${colors[i % colors.length]} animate-[confetti_1.2s_ease-in_forwards]`}
          style={{
            left: `${(i * 4.2) % 100}%`,
            top: `${(i % 5) * 10}%`,
            animationDelay: `${(i % 8) * 0.05}s`,
            transform: `rotate(${i * 37}deg)`,
          }}
        />
      ))}
    </div>
  );
}
