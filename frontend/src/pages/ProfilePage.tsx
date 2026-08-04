import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Punishment, Stats, Submission, User } from "../types";
import { useAuth } from "../store/auth";
import { Avatar, PageLoader, ProgressBar, EmptyState } from "../components/ui";
import { SubmissionCard } from "../components/SubmissionCard";
import { Toast, useToast } from "../components/modal";
import { AVATARS } from "../lib/format";
import { sfx } from "../lib/sound";
import { useInstallPrompt } from "../lib/pwa";

export function ProfilePage() {
  const { user, setUser } = useAuth();
  const qc = useQueryClient();
  const { toast, show } = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    display_name: user?.display_name ?? "",
    bio: user?.bio ?? "",
    avatar: user?.avatar ?? "😎",
  });

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
      show("Profile updated ✅");
    },
    onError: (err: any) => show(err.message || "Failed to save"),
  });

  const completePunishment = useMutation({
    mutationFn: (id: number) => api.post(`/punishments/${id}/complete`),
    onSuccess: () => {
      qc.invalidateQueries();
      show("Punishment done! Respect. 🫡");
    },
  });

  if (!user || !stats) return <PageLoader />;

  return (
    <div className="space-y-5">
      <Toast message={toast} />

      <header className="card relative overflow-hidden">
        <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-fuchsia-500/20 blur-2xl" />
        <div className="flex items-center gap-4">
          <Avatar emoji={user.avatar} size="xl" />
          <div className="flex-1">
            <h1 className="font-display text-2xl font-extrabold">{user.display_name}</h1>
            <div className="text-sm text-white/50">@{user.username}</div>
            {user.bio && <div className="mt-1 text-sm italic text-white/60">{user.bio}</div>}
            <div className="mt-2 flex gap-2">
              <span className="chip bg-fuchsia-500/20 text-fuchsia-300">💎 {stats.total_points} pts</span>
              <span className="chip bg-white/10 text-white/60"># {stats.rank} rank</span>
              <span className={`chip ${stats.streak > 0 ? "bg-orange-500/20 text-orange-300" : "bg-white/10 text-white/40"}`}>
                🔥 {stats.streak}-day streak
              </span>
            </div>
          </div>
          <button className="btn-ghost !px-3 !py-1.5 !text-xs" onClick={() => setEditing(true)}>
            Edit
          </button>
        </div>
      </header>

      {/* Badges */}
      <section>
        <h2 className="mb-2 font-display text-lg font-bold">🎖️ Badges</h2>
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
        <h2 className="font-display text-lg font-bold">📊 Progress</h2>
        <div>
          <div className="mb-1 flex justify-between text-xs font-bold text-white/50">
            <span>Completion rate</span>
            <span className="text-fuchsia-300">{stats.completion_rate}%</span>
          </div>
          <ProgressBar value={stats.completion_rate} />
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { v: stats.quests_completed, l: "Completed" },
            { v: stats.quests_pending, l: "In progress" },
            { v: stats.quests_rejected, l: "Failed" },
          ].map((x) => (
            <div key={x.l} className="rounded-xl bg-white/5 py-2.5">
              <div className="font-display text-lg font-extrabold">{x.v}</div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-white/40">{x.l}</div>
            </div>
          ))}
        </div>
        {stats.favorite_category && (
          <div className="text-center text-xs font-bold text-white/50">
            Favorite category: <span className="text-amber-300">{stats.favorite_category}</span>
          </div>
        )}
      </section>

      {/* Settings */}
      <section className="card space-y-3">
        <h2 className="font-display text-lg font-bold">⚙️ Settings</h2>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-bold">Sound effects</div>
            <div className="text-xs text-white/40">Ticks, dings, and victory jingles</div>
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
        {canInstall && (
          <button className="btn-primary w-full" onClick={install}>
            📲 Install the app
          </button>
        )}
      </section>

      {/* Punishments */}
      {punishments && punishments.length > 0 && (
        <section>
          <h2 className="mb-2 font-display text-lg font-bold text-rose-300">🧨 My punishments</h2>
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
        <h2 className="mb-2 font-display text-lg font-bold">🗂️ My quests</h2>
        {!subs || subs.length === 0 ? (
          <EmptyState icon="🌱" title="Nothing here yet" subtitle="Head to the quest board and start your first quest." />
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
          <div className="relative z-10 w-full max-w-lg animate-slide-up rounded-t-3xl bg-panel p-5 sm:rounded-3xl">
            <h2 className="mb-4 font-display text-xl font-bold">Edit profile</h2>
            <div className="space-y-3">
              <input
                className="input"
                placeholder="Display name"
                value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
              />
              <textarea
                className="input min-h-16 resize-none"
                placeholder="Bio"
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
              />
              <div>
                <div className="mb-1.5 text-xs font-bold text-white/50">Avatar</div>
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
                  Cancel
                </button>
                <button className="btn-primary flex-1" onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
