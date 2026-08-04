import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Punishment, Stats, Submission, User } from "../types";
import { useAuth } from "../store/auth";
import { Avatar, PageLoader, ProgressBar, EmptyState } from "../components/ui";
import { SubmissionCard } from "../components/SubmissionCard";
import { Toast, useToast } from "../components/modal";
import { AVATARS } from "../lib/format";
import { levelIcon, levelProgress, levelTitle } from "../lib/levels";
import { sfx } from "../lib/sound";
import { useInstallPrompt } from "../lib/pwa";
import { LANGS, useI18n } from "../lib/i18n";

const BANNER_COLORS = [
  "#7c3aed",
  "#db2777",
  "#0891b2",
  "#ea580c",
  "#059669",
  "#4f46e5",
  "#e11d48",
  "#111827",
];

export function ProfilePage() {
  const { user, setUser } = useAuth();
  const qc = useQueryClient();
  const { toast, show } = useToast();
  const { t, lang, setLang } = useI18n();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    display_name: user?.display_name ?? "",
    username: user?.username ?? "",
    bio: user?.bio ?? "",
    avatar: user?.avatar ?? "😎",
    status_text: user?.status_text ?? "",
    status_emoji: user?.status_emoji ?? "",
    pronouns: user?.pronouns ?? "",
    banner_color: user?.banner_color ?? BANNER_COLORS[0],
  });
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: stats } = useQuery<Stats>({
    queryKey: ["stats"],
    queryFn: () => api.get("/stats"),
  });
  const { data: subs } = useQuery<Submission[]>({
    queryKey: ["my-submissions"],
    queryFn: () => api.get("/submissions?mine=true"),
  });
  const { data: punishments } = useQuery<Punishment[]>({
    queryKey: ["my-punishments"],
    queryFn: () => api.get("/punishments/mine"),
  });
  const { canInstall, install } = useInstallPrompt();
  const [soundOn, setSoundOn] = useState(!sfx.isMuted());

  const saveProfile = useMutation({
    mutationFn: () => api.patch<User>("/users/me", form),
    onSuccess: (u) => {
      setUser(u);
      setEditing(false);
      qc.invalidateQueries();
      show(t("profile.updated"));
    },
    onError: (err: any) => show(err.message || t("profile.saveFailed")),
  });

  const buyShield = useMutation({
    mutationFn: () => api.post<User>("/users/me/shields"),
    onSuccess: (u) => {
      setUser(u);
      qc.invalidateQueries();
      show("🛡️ Shield acquired!");
      sfx.pop();
    },
    onError: (err: any) => show(err.message || "Couldn't buy shield"),
  });

  const uploadAvatar = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return api.postForm<User>("/users/me/avatar", fd);
    },
    onSuccess: (u) => {
      setUser(u);
      qc.invalidateQueries();
      show(t("profile.photoUpdated"));
    },
    onError: (err: any) => show(err.message || t("profile.saveFailed")),
  });

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    await uploadAvatar.mutateAsync(file);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  const completePunishment = useMutation({
    mutationFn: (id: number) => api.post(`/punishments/${id}/complete`),
    onSuccess: () => {
      qc.invalidateQueries();
      show("Punishment done! Respect. 🫡");
    },
  });

  if (!user || !stats) return <PageLoader />;

  const prog = levelProgress(user.total_points);
  const lvlTitle = levelTitle(user.total_points);
  const lvlIcon = levelIcon(user.total_points);
  const banner = user.banner_color || BANNER_COLORS[0];
  const statusText = user.status_text;
  const statusEmoji = user.status_emoji;

  return (
    <div className="space-y-5">
      <Toast message={toast} />

      {/* Banner + profile card (Discord style) */}
      <header className="card relative overflow-hidden">
        <div
          className="relative h-24 w-full"
          style={{ background: `linear-gradient(135deg, ${banner} 0%, ${banner}88 100%)` }}
        >
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 20% 80%, white, transparent 40%)" }} />
        </div>
        <div className="relative px-4 pb-4">
          <div className="-mt-10 flex items-end gap-3">
            <button onClick={() => fileRef.current?.click()} title="Change photo">
              <Avatar emoji={user.avatar} file={user.avatar_file} size="xl" />
            </button>
            <div className="flex-1 pb-1">
              <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold">
                {user.display_name}
                <span title={lvlTitle}>{lvlIcon}</span>
              </h1>
              <div className="flex items-center gap-2 text-sm text-white/50">
                @{user.username}
                {user.pronouns && (
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/50">
                    {user.pronouns}
                  </span>
                )}
                {statusEmoji || statusText ? (
                  <span className="text-xs text-fuchsia-300/90">
                    {statusEmoji} {statusText}
                  </span>
                ) : null}
              </div>
            </div>
            <button className="btn-ghost !px-3 !py-1.5 !text-xs" onClick={() => setEditing(true)}>
              Edit
            </button>
          </div>
          {user.bio && <div className="mt-2 text-sm italic text-white/60">{user.bio}</div>}
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="chip bg-fuchsia-500/20 text-fuchsia-300">💎 {stats.total_points} pts</span>
            <span className="chip bg-white/10 text-white/60">
              {lvlIcon} {lvlTitle} · Lv{prog.level}
            </span>
            <span className="chip bg-white/10 text-white/60"># {stats.rank} rank</span>
            <span className={`chip ${stats.streak > 0 ? "bg-orange-500/20 text-orange-300" : "bg-white/10 text-white/40"}`}>
              🔥 {stats.streak}-day streak
            </span>
            <span className="chip bg-sky-500/15 text-sky-300">🛡️ {user.streak_shields || 0}</span>
          </div>
          <div className="mt-2">
            <div className="mb-1 flex justify-between text-[10px] font-bold text-white/40">
              <span>
                {lvlIcon} Lv{prog.level} → Lv{prog.level + 1}
              </span>
              <span>
                {prog.into}/{prog.span} pts
              </span>
            </div>
            <ProgressBar value={prog.fraction * 100} className="!bg-white/5" />
          </div>
        </div>
      </header>

      {/* Badges */}
      <section>
        <h2 className="mb-2 font-display text-lg font-bold">🎖️ {t("profile.badges")}</h2>
        <div className="flex flex-wrap gap-2">
          {stats.badges.map((b) => (
            <div key={b.key} className="card flex items-center gap-2 !p-2.5">
              <span className="text-2xl">{b.icon}</span>
              <span className="text-xs font-bold">{b.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="card space-y-3">
        <h2 className="font-display text-lg font-bold">📊 {t("profile.progress")}</h2>
        <div>
          <div className="mb-1 flex justify-between text-xs font-bold text-white/50">
            <span>{t("profile.completionRate")}</span>
            <span className="text-fuchsia-300">{stats.completion_rate}%</span>
          </div>
          <ProgressBar value={stats.completion_rate} />
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { v: stats.quests_completed, l: t("profile.completed") },
            { v: stats.quests_pending, l: t("profile.inProgress") },
            { v: stats.quests_rejected, l: t("profile.failed") },
          ].map((x) => (
            <div key={x.l} className="rounded-xl bg-white/5 py-2.5">
              <div className="font-display text-lg font-extrabold">{x.v}</div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-white/40">{x.l}</div>
            </div>
          ))}
        </div>
        {stats.favorite_category && (
          <div className="text-center text-xs font-bold text-white/50">
            {t("profile.favorite")}: <span className="text-amber-300">{stats.favorite_category}</span>
          </div>
        )}
      </section>

      {/* Streak shield */}
      <section className="card space-y-2">
        <h2 className="font-display text-lg font-bold">🛡️ {t("profile.shields")}</h2>
        <p className="text-xs text-white/50">{t("profile.shieldsHint")}</p>
        <button
          className="btn-primary w-full"
          onClick={() => buyShield.mutate()}
          disabled={buyShield.isPending || (user.total_points ?? 0) < 50}
        >
          {buyShield.isPending ? "…" : `Buy shield — 50 pts (${user.total_points ?? 0} available)`}
        </button>
      </section>

      {/* Settings */}
      <section className="card space-y-3">
        <h2 className="font-display text-lg font-bold">⚙️ {t("profile.settings")}</h2>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-bold">{t("profile.sound")}</div>
            <div className="text-xs text-white/40">{t("profile.soundHint")}</div>
          </div>
          <button
            className={`h-9 w-16 rounded-full p-1 transition ${soundOn ? "bg-emerald-500" : "bg-white/10"}`}
            onClick={() => {
              const next = !soundOn;
              setSoundOn(next);
              sfx.setMuted(!next);
              if (next) sfx.pop();
            }}
            aria-label="Toggle sound"
          >
            <div className={`h-7 w-7 rounded-full bg-white transition ${soundOn ? "translate-x-7" : ""}`} />
          </button>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-bold">{t("profile.language")}</div>
            <div className="text-xs text-white/40">{t("nav.you")}</div>
          </div>
          <div className="flex gap-1 rounded-full bg-white/5 p-1">
            {LANGS.map((l) => (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                title={l.label}
                className={`rounded-full px-2 py-1 text-xs font-bold transition ${
                  lang === l.code ? "bg-violet-500/40 text-white" : "text-white/50"
                }`}
              >
                {l.flag}
              </button>
            ))}
          </div>
        </div>
        {canInstall && (
          <button className="btn-primary w-full" onClick={install}>
            📲 {t("profile.install")}
          </button>
        )}
        <Link
          to="https://buymeacoffee.com/rakso8080"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost w-full"
        >
          ☕ Support SideQuest
        </Link>
        <Link to="/admin" className="btn-ghost w-full">
          🛠️ {t("profile.admin")}
        </Link>
      </section>

      {/* Punishments */}
      {punishments && punishments.length > 0 && (
        <section>
          <h2 className="mb-2 font-display text-lg font-bold text-rose-300">🧨 {t("profile.myPunishments")}</h2>
          <div className="space-y-2">
            {punishments.map((p) => (
              <div key={p.id} className="card flex items-center gap-3 !p-3.5">
                <span className="text-2xl">{p.status === "completed" ? "✅" : "🧨"}</span>
                <div className="flex-1">
                  <div className={`text-sm font-bold ${p.status === "completed" ? "line-through opacity-50" : ""}`}>
                    {p.description}
                  </div>
                  <div className="text-xs text-white/40">
                    {p.status === "completed"
                      ? "Completed 🎉"
                      : `due ${new Date(p.due_date).toLocaleDateString()}${p.status === "overdue" ? " · OVERDUE" : ""}`}
                  </div>
                </div>
                {p.status !== "completed" && (
                  <button className="btn-ghost !px-3 !py-1.5 !text-xs" onClick={() => completePunishment.mutate(p.id)}>
                    Done ✓
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* My submissions */}
      <section>
        <h2 className="mb-2 font-display text-lg font-bold">🗂️ {t("profile.myQuests")}</h2>
        {!subs || subs.length === 0 ? (
          <EmptyState icon="🌱" title={t("profile.nothingHere")} subtitle={t("profile.goToBoard")} />
        ) : (
          <div className="space-y-3">
            {subs.map((s) => (
              <SubmissionCard key={s.id} sub={s} />
            ))}
          </div>
        )}
      </section>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setEditing(false)} />
          <div className="relative z-10 max-h-[90vh] w-full max-w-lg animate-slide-up overflow-y-auto rounded-t-3xl bg-panel p-5 sm:rounded-3xl">
            <h2 className="mb-4 font-display text-xl font-bold">{t("profile.editProfile")}</h2>
            <div className="space-y-3">
              <input
                className="input"
                placeholder={t("auth.displayName")}
                value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
              />
              <input
                className="input"
                placeholder={t("profile.username")}
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
              <textarea
                className="input min-h-16 resize-none"
                placeholder={t("profile.bio")}
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
              />
              <input
                className="input"
                placeholder='Status — e.g. "out on a quest"'
                value={form.status_text}
                maxLength={120}
                onChange={(e) => setForm({ ...form, status_text: e.target.value })}
              />
              <div>
                <div className="mb-1.5 text-xs font-bold text-white/50">Status emoji</div>
                <div className="grid grid-cols-8 gap-1">
                  {["🟢", "🎮", "🏋️", "🧠", "🛌", "⚡", "🎧", "🌮", "💼", "🏃", "🧘", "🍕", "📚", "🎬", "⛰️", "💪"].map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setForm({ ...form, status_emoji: e })}
                      className={`rounded-lg py-1.5 text-lg transition ${
                        form.status_emoji === e ? "bg-violet-500/40 ring-1 ring-violet-300" : "bg-white/5"
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
              <input
                className="input"
                placeholder="Pronouns — e.g. they/them"
                value={form.pronouns}
                maxLength={40}
                onChange={(e) => setForm({ ...form, pronouns: e.target.value })}
              />
              <div>
                <div className="mb-1.5 text-xs font-bold text-white/50">Banner color</div>
                <div className="flex flex-wrap gap-2">
                  {BANNER_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm({ ...form, banner_color: c })}
                      className={`h-8 w-8 rounded-full transition ${
                        form.banner_color === c ? "ring-2 ring-white" : "ring-1 ring-white/20"
                      }`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-1.5 text-xs font-bold text-white/50">{t("profile.profilePhoto")}</div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onPickFile}
                />
                <button
                  className="btn-ghost mb-2 w-full !text-xs"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? t("profile.uploading") : `📷 ${t("profile.uploadPhoto")}`}
                </button>
                <div className="mb-1.5 text-xs font-bold text-white/50">{t("profile.pickEmoji")}</div>
                <div className="grid grid-cols-8 gap-1">
                  {AVATARS.map((a) => (
                    <button
                      key={a}
                      onClick={() => setForm({ ...form, avatar: a })}
                      className={`rounded-lg py-1.5 text-lg transition ${
                        form.avatar === a ? "bg-violet-500/40 ring-1 ring-violet-300" : "bg-white/5"
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button className="btn-ghost flex-1" onClick={() => setEditing(false)}>
                  {t("profile.cancel")}
                </button>
                <button className="btn-primary flex-1" onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
                  {t("profile.save")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
