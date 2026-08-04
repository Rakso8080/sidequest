import { useEffect, useState } from "react";
import { api } from "../api/client";
import { AdminOverview, GlobalQuest } from "../types";
import { Avatar, EmptyState, PageLoader, Spinner } from "../components/ui";

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

  async function doLogin() {
    setError("");
    try {
      const res = await api.post<{ token: string }>("/admin/login", { password: pw });
      sessionStorage.setItem(ADMIN_KEY, res.token);
      setToken(res.token);
    } catch (e: any) {
      setError(e.message || "Wrong password");
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

  async function save() {
    if (!draft) return;
    const payload = { ...draft };
    delete (payload as any).id;
    setBusy(true);
    try {
      if (draft.id) await api.patch(`/admin/quests/${draft.id}`, payload, { headers: authHeaders() } as any);
      else await api.post("/admin/quests", payload, { headers: authHeaders() } as any);
      setDraft(null);
      setNotice("Quest saved");
      setTimeout(() => setNotice(""), 2000);
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
      setNotice(`Pushed to ${r.pushed} squad(s)`);
      setTimeout(() => setNotice(""), 2500);
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
            <h1 className="mt-2 font-display text-2xl font-bold">Admin</h1>
            <p className="text-sm text-white/50">Enter the admin password</p>
          </div>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doLogin()}
            placeholder="Password"
            className="input w-full"
            autoFocus
          />
          {error && <div className="text-sm text-rose-400">{error}</div>}
          <button onClick={doLogin} className="btn-primary w-full" disabled={busy}>
            Unlock
          </button>
        </div>
      </div>
    );
  }

  if (!data) return <PageLoader />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">🛠️ Admin panel</h1>
          <p className="text-sm text-white/50">{data.quests.length} challenges in the pool</p>
        </div>
        <div className="flex gap-2 text-sm">
          {(["quests", "users", "squads"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-xl px-3 py-1.5 capitalize transition ${
                tab === t ? "bg-fuchsia-500/25 text-fuchsia-200" : "text-white/50 hover:bg-white/5"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {notice && <div className="rounded-xl bg-emerald-500/15 px-4 py-2 text-sm text-emerald-300">{notice}</div>}
      {error && <div className="rounded-xl bg-rose-500/15 px-4 py-2 text-sm text-rose-300">{error}</div>}

      {tab === "quests" && (
        <div className="space-y-3">
          <button
            onClick={() => setDraft({ ...EMPTY })}
            className="btn-primary w-full"
          >
            + New challenge
          </button>

          {draft && (
            <div className="card space-y-3 p-4">
              <h2 className="font-display font-bold">{draft.id ? "Edit" : "New"} challenge</h2>
              <input className="input w-full" placeholder="Title" value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              <textarea className="input w-full" placeholder="Description" value={draft.description} rows={2}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              <div className="grid grid-cols-2 gap-2 text-sm">
                <input className="input" placeholder="Category" value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
                <select className="input" value={draft.difficulty}
                  onChange={(e) => setDraft({ ...draft, difficulty: e.target.value as any })}>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
                <input className="input" type="number" placeholder="Points" value={draft.points}
                  onChange={(e) => setDraft({ ...draft, points: Number(e.target.value) })} />
                <input className="input" type="number" placeholder="Time limit (hours)" value={draft.time_limit_hours}
                  onChange={(e) => setDraft({ ...draft, time_limit_hours: Number(e.target.value) })} />
                <select className="input" value={draft.proof_type}
                  onChange={(e) => setDraft({ ...draft, proof_type: e.target.value as any })}>
                  <option value="photo">Photo</option>
                  <option value="video">Video</option>
                  <option value="text">Text</option>
                  <option value="self_report">Self report</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={save} className="btn-primary flex-1" disabled={busy}>
                  {busy ? <Spinner size="sm" /> : "Save"}
                </button>
                <button onClick={() => setDraft(null)} className="btn-ghost">Cancel</button>
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
                <button onClick={() => setDraft({ ...q })} className="rounded-lg bg-white/10 px-2.5 py-1.5 hover:bg-white/20">Edit</button>
                <button onClick={() => push(q)} className="rounded-lg bg-sky-500/20 px-2.5 py-1.5 text-sky-200 hover:bg-sky-500/30">Push</button>
                <button onClick={() => remove(q)} className="rounded-lg bg-rose-500/20 px-2.5 py-1.5 text-rose-200 hover:bg-rose-500/30">Del</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "users" && (
        <div className="space-y-2">
          {data.users.length === 0 && <EmptyState icon="👤" title="No users" />}
          {data.users.map((u) => (
            <div key={u.id} className="card flex items-center gap-3 p-3">
              <Avatar emoji={u.avatar} file={u.avatar_file} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{u.display_name}</div>
                <div className="truncate text-xs text-white/50">@{u.username} · {u.email}</div>
              </div>
              <div className="shrink-0 text-right text-xs text-white/50">
                <div>{u.total_points} pts</div>
                <div>streak {u.streak}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "squads" && (
        <div className="space-y-2">
          {data.squads.length === 0 && <EmptyState icon="👥" title="No squads" />}
          {data.squads.map((s) => (
            <div key={s.id} className="card flex items-center gap-3 p-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/30 to-fuchsia-500/20 text-lg">
                👥
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{s.name}</div>
                <div className="text-xs text-white/50">code {s.invite_code}</div>
              </div>
              <div className="shrink-0 text-xs text-white/50">{s.member_count} members</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
