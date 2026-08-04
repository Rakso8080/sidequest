import { useEffect, useState } from "react";
import { api } from "../api/client";
import { AdminOverview, GlobalQuest } from "../types";
import { Avatar, EmptyState, PageLoader, Spinner } from "../components/ui";
import { useI18n } from "../lib/i18n";

const ADMIN_KEY = "sq_admin_token";

const EMPTY: GlobalQuest = {
  id: 0,
  title: "",
  description: "",
  category: "Social",
  difficulty: "medium",
  points: 60,
  proof_type: "photo",
  time_limit_hours: 72,
};

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(ADMIN_KEY));
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [data, setData] = useState<AdminOverview | null>(null);
  const [tab, setTab] = useState<"quests" | "users" | "squads">("quests");
  const [draft, setDraft] = useState<GlobalQuest | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [announceText, setAnnounceText] = useState("");
  const { t } = useI18n();

  async function doLogin() {
    setError("");
    try {
      const res = await api.post<{ token: string }>("/admin/login", { password: pw });
      sessionStorage.setItem(ADMIN_KEY, res.token);
      setToken(res.token);
    } catch (e: any) {
      setError(e.message || t("admin.password"));
    }
  }

  function authHeaders() {
    return { Authorization: `Bearer ${token}` };
  }

  async function load() {
    setBusy(true);
    try {
      const d = await api.get<AdminOverview>("/admin/overview", { headers: authHeaders() } as any);
      setData(d);
    } catch {
      sessionStorage.removeItem(ADMIN_KEY);
      setToken(null);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (token) load();
  }, [token]);

  function flash(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(""), 2500);
  }

  async function save() {
    if (!draft) return;
    const payload = { ...draft };
    delete (payload as any).id;
    setBusy(true);
    try {
      if (draft.id) await api.patch(`/admin/quests/${draft.id}`, payload, { headers: authHeaders() } as any);
      else await api.post("/admin/quests", payload, { headers: authHeaders() } as any);
      setDraft(null);
      flash(t("admin.saved"));
      load();
    } catch (e: any) {
      setError(e.message || "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(q: GlobalQuest) {
    if (!confirm(`Delete "${q.title}"?`)) return;
    await api.del(`/admin/quests/${q.id}`, { headers: authHeaders() } as any);
    load();
  }

  async function push(q: GlobalQuest) {
    if (!confirm(`Push "${q.title}" to every squad's board?`)) return;
    setBusy(true);
    try {
      const r = await api.post<{ pushed: number }>(`/admin/quests/${q.id}/push`, undefined, {
        headers: authHeaders(),
      } as any);
      flash(t("admin.pushed", { n: r.pushed }));
      load();
    } finally {
      setBusy(false);
    }
  }

  async function adjustPoints(userId: number, delta: number) {
    await api.post(`/admin/users/${userId}/adjust-points`, { points: delta }, { headers: authHeaders() } as any);
    load();
  }

  async function resetStreak(userId: number) {
    if (!confirm("Reset this user's streak?")) return;
    await api.post(`/admin/users/${userId}/reset-streak`, undefined, { headers: authHeaders() } as any);
    load();
  }

  async function deleteUser(userId: number, name: string) {
    if (!confirm(`Delete user "${name}"? This removes their account and submissions.`)) return;
    await api.del(`/admin/users/${userId}`, { headers: authHeaders() } as any);
    load();
  }

  async function addTemplateToSquad(squadId: number, templateId: number, title: string) {
    if (!confirm(`Add "${title}" to this squad's board?`)) return;
    await api.post(`/admin/squads/${squadId}/add-quest/${templateId}`, undefined, { headers: authHeaders() } as any);
    load();
  }

  async function deleteSquad(squadId: number, name: string) {
    if (!confirm(`Delete squad "${name}" and all its data?`)) return;
    await api.del(`/admin/squads/${squadId}`, { headers: authHeaders() } as any);
    load();
  }

  async function announce() {
    const text = announceText.trim();
    if (!text) return;
    setBusy(true);
    try {
      const r = await api.post<{ posted: number }>("/admin/announce", { text }, { headers: authHeaders() } as any);
      flash(t("admin.pushed", { n: r.posted }));
      setAnnounceText("");
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="mx-auto max-w-md pt-16">
        <div className="card space-y-4 p-6">
          <div className="text-center">
            <div className="text-4xl">🛠️</div>
            <h1 className="mt-2 font-display text-2xl font-bold">{t("admin.title")}</h1>
            <p className="text-sm text-white/50">{t("admin.password")}</p>
          </div>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doLogin()}
            placeholder="••••••"
            className="input w-full"
            autoFocus
          />
          {error && <div className="text-sm text-rose-400">{error}</div>}
          <button onClick={doLogin} className="btn-primary w-full" disabled={busy}>
            {t("admin.unlock")}
          </button>
        </div>
      </div>
    );
  }

  if (!data) return <PageLoader />;

  const stats = data.stats;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">🛠️ {t("admin.title")}</h1>
          <p className="text-sm text-white/50">
            {data.quests.length} {t("admin.subtitle")}
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          {(["quests", "users", "squads"] as const).map((tb) => (
            <button
              key={tb}
              onClick={() => setTab(tb)}
              className={`rounded-xl px-3 py-1.5 capitalize transition ${
                tab === tb ? "bg-fuchsia-500/25 text-fuchsia-200" : "text-white/50 hover:bg-white/5"
              }`}
            >
              {tb === "quests" ? t("admin.quests") : tb === "users" ? t("admin.users") : t("admin.squads")}
            </button>
          ))}
        </div>
      </div>

      {notice && <div className="rounded-xl bg-emerald-500/15 px-4 py-2 text-sm text-emerald-300">{notice}</div>}
      {error && <div className="rounded-xl bg-rose-500/15 px-4 py-2 text-sm text-rose-300">{error}</div>}

      {/* Platform stats */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { l: t("admin.totalUsers"), v: stats.users, icon: "👤" },
          { l: t("admin.totalSquads"), v: stats.squads, icon: "👥" },
          { l: t("admin.approved"), v: stats.approved, icon: "✅" },
          { l: t("admin.weekApproved"), v: stats.week_approved, icon: "📈" },
        ].map((s) => (
          <div key={s.l} className="card !p-2.5 text-center">
            <div className="text-base leading-none">{s.icon}</div>
            <div className="mt-1 font-display text-lg font-extrabold">{s.v}</div>
            <div className="text-[9px] font-bold uppercase tracking-wide text-white/40">{s.l}</div>
          </div>
        ))}
      </div>

      {/* Announce */}
      <div className="card space-y-2">
        <div className="text-xs font-bold uppercase tracking-wide text-white/40">{t("admin.announce")}</div>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder={t("admin.announcePlaceholder")}
            value={announceText}
            onChange={(e) => setAnnounceText(e.target.value)}
          />
          <button className="btn-primary shrink-0" onClick={announce} disabled={!announceText.trim() || busy}>
            {busy ? <Spinner size="sm" /> : t("admin.send")}
          </button>
        </div>
      </div>

      {tab === "quests" && (
        <div className="space-y-3">
          <button onClick={() => setDraft({ ...EMPTY })} className="btn-primary w-full">
            + {t("admin.new")}
          </button>

          {draft && (
            <div className="card space-y-3 p-4">
              <h2 className="font-display font-bold">{draft.id ? t("admin.edit") : t("admin.new")}</h2>
              <input className="input w-full" placeholder={t("admin.titleLbl")} value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              <textarea className="input w-full" placeholder={t("admin.description")} value={draft.description} rows={2}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              <div className="grid grid-cols-2 gap-2 text-sm">
                <input className="input" placeholder={t("admin.category")} value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
                <select className="input" value={draft.difficulty}
                  onChange={(e) => setDraft({ ...draft, difficulty: e.target.value as any })}>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
                <input className="input" type="number" placeholder={t("admin.points")} value={draft.points}
                  onChange={(e) => setDraft({ ...draft, points: Number(e.target.value) })} />
                <input className="input" type="number" placeholder={t("admin.timeLimit")} value={draft.time_limit_hours}
                  onChange={(e) => setDraft({ ...draft, time_limit_hours: Number(e.target.value) })} />
                <select className="input" value={draft.proof_type}
                  onChange={(e) => setDraft({ ...draft, proof_type: e.target.value as any })}>
                  <option value="photo">📸 Photo</option>
                  <option value="video">🎬 Video</option>
                  <option value="text">✍️ Text</option>
                  <option value="self_report">✅ Self report</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={save} className="btn-primary flex-1" disabled={busy}>
                  {busy ? <Spinner size="sm" /> : t("admin.save")}
                </button>
                <button onClick={() => setDraft(null)} className="btn-ghost">{t("admin.quit")}</button>
              </div>
            </div>
          )}

          {data.quests.map((q) => (
            <div key={q.id} className="card flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold">{q.title}</span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/60">{q.category}</span>
                  <span className="rounded-full bg-fuchsia-500/20 px-2 py-0.5 text-[11px] text-fuchsia-200">{q.points} pts</span>
                </div>
                {q.description && <div className="mt-1 text-xs text-white/50 line-clamp-1">{q.description}</div>}
              </div>
              <div className="flex shrink-0 gap-1.5 text-xs">
                <button onClick={() => setDraft({ ...q })} className="rounded-lg bg-white/10 px-2.5 py-1.5 hover:bg-white/20">{t("admin.editBtn")}</button>
                <button onClick={() => push(q)} className="rounded-lg bg-sky-500/20 px-2.5 py-1.5 text-sky-200 hover:bg-sky-500/30">{t("admin.push")}</button>
                <button onClick={() => remove(q)} className="rounded-lg bg-rose-500/20 px-2.5 py-1.5 text-rose-200 hover:bg-rose-500/30">{t("admin.del")}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "users" && (
        <div className="space-y-2">
          {data.users.length === 0 && <EmptyState icon="👤" title={t("admin.users")} />}
          {data.users.map((u) => (
            <div key={u.id} className="card flex items-center gap-3 p-3">
              <Avatar emoji={u.avatar} file={u.avatar_file} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{u.display_name}</div>
                <div className="truncate text-xs text-white/50">
                  @{u.username} · 💎 {u.total_points} · 🔥 {u.streak}
                </div>
              </div>
              <div className="flex shrink-0 gap-1.5 text-xs">
                <button onClick={() => adjustPoints(u.id, 10)} className="rounded-lg bg-emerald-500/20 px-2 py-1.5 text-emerald-200 hover:bg-emerald-500/30" title="+10">+10</button>
                <button onClick={() => adjustPoints(u.id, -10)} className="rounded-lg bg-rose-500/20 px-2 py-1.5 text-rose-200 hover:bg-rose-500/30" title="-10">−10</button>
                <button onClick={() => resetStreak(u.id)} className="rounded-lg bg-amber-500/20 px-2 py-1.5 text-amber-200 hover:bg-amber-500/30" title={t("admin.resetStreak")}>🔥</button>
                <button onClick={() => deleteUser(u.id, u.display_name)} className="rounded-lg bg-rose-500/20 px-2 py-1.5 text-rose-200 hover:bg-rose-500/30" title={t("admin.deleteUser")}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "squads" && (
        <div className="space-y-2">
          {data.squads.length === 0 && <EmptyState icon="👥" title={t("admin.squads")} />}
          {data.squads.map((s) => (
            <div key={s.id} className="card space-y-2 p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/30 to-fuchsia-500/20 text-lg">
                  👥
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{s.name}</div>
                  <div className="text-xs text-white/50">
                    {s.invite_code} · {s.member_count} {s.member_count === 1 ? t("common.member") : t("common.members")}
                  </div>
                </div>
                <button onClick={() => deleteSquad(s.id, s.name)} className="rounded-lg bg-rose-500/20 px-2.5 py-1.5 text-xs text-rose-200 hover:bg-rose-500/30">
                  🗑️ {t("admin.deleteSquad")}
                </button>
              </div>
              <details className="rounded-xl bg-white/5 p-2">
                <summary className="cursor-pointer text-xs font-bold text-white/50">{t("admin.addTemplate")}</summary>
                <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                  {data.quests.slice(0, 100).map((q) => (
                    <button
                      key={q.id}
                      onClick={() => addTemplateToSquad(s.id, q.id, q.title)}
                      className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs hover:bg-white/10"
                    >
                      <span className="truncate">{q.title}</span>
                      <span className="ml-2 shrink-0 font-bold text-fuchsia-300">+{q.points}</span>
                    </button>
                  ))}
                </div>
              </details>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
