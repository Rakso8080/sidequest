import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Squad } from "../types";
import { useAuth } from "../store/auth";
import { Avatar, PageLoader } from "../components/ui";
import { Toast, useToast } from "../components/modal";
import { useI18n } from "../lib/i18n";

export function SquadPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast, show } = useToast();
  const { t } = useI18n();
  const [createName, setCreateName] = useState("");
  const [invite, setInvite] = useState("");
  const [copied, setCopied] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [newPun, setNewPun] = useState("");

  const { data: squad, isLoading } = useQuery<Squad>({
    queryKey: ["squad"],
    queryFn: () => api.get("/squads/me"),
    enabled: !!user?.squad_id,
  });

  const isAdmin = squad?.admin_id === user?.id;

  const createSquad = useMutation({
    mutationFn: (name: string) => api.post<Squad>("/squads", { name }),
    onSuccess: (s) => {
      useAuth.setState({ user: { ...user!, squad_id: s.id } });
      qc.invalidateQueries();
      show("Squad created! Invite your friends. 🎉");
    },
    onError: (err: any) => show(err.message || "Failed to create squad"),
  });

  const joinSquad = useMutation({
    mutationFn: (code: string) => api.post<Squad>("/squads/join", { invite_code: code }),
    onSuccess: (s) => {
      useAuth.setState({ user: { ...user!, squad_id: s.id } });
      qc.invalidateQueries();
      show("Welcome to the squad! 🎉");
    },
    onError: (err: any) => show(err.message || "Failed to join"),
  });

  const updateSettings = useMutation({
    mutationFn: (patch: Record<string, unknown>) => api.patch("/squads/me/settings", patch),
    onSuccess: () => {
      qc.invalidateQueries();
      show("Settings saved ✅");
    },
    onError: (err: any) => show(err.message || "Failed to save"),
  });

  const rotateInvite = useMutation({
    mutationFn: () => api.post("/squads/invite/rotate"),
    onSuccess: () => qc.invalidateQueries(),
  });

  const leaveSquad = useMutation({
    mutationFn: () => api.post("/squads/leave"),
    onSuccess: () => {
      useAuth.setState({ user: { ...user!, squad_id: null } });
      qc.invalidateQueries();
      show("You left the squad 👋");
    },
    onError: (err: any) => show(err.message || "Failed to leave"),
  });

  const disbandSquad = useMutation({
    mutationFn: () => api.post("/squads/disband"),
    onSuccess: () => {
      useAuth.setState({ user: { ...user!, squad_id: null } });
      qc.invalidateQueries();
      show("Squad disbanded");
    },
    onError: (err: any) => show(err.message || "Failed to disband"),
  });

  async function copyCode() {
    if (!squad) return;
    try {
      await navigator.clipboard.writeText(squad.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  function inviteLink(): string {
    return `${window.location.origin}/invite?code=${squad?.invite_code ?? ""}`;
  }

  async function copyInviteLink() {
    if (!squad) return;
    try {
      await navigator.clipboard.writeText(inviteLink());
      show("Invite link copied! 📋");
    } catch {
      /* ignore */
    }
  }

  async function shareInvite() {
    if (!squad) return;
    const url = inviteLink();
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "Join my SideQuest squad!",
          text: "Come do quests with me 💪",
          url,
        });
        return;
      } catch {
        /* user closed the share sheet */
      }
    }
    copyInviteLink();
  }

  if (isLoading) return <PageLoader />;

  if (!squad) {
    return (
      <div className="space-y-5">
        <header className="text-center">
          <h1 className="font-display text-2xl font-extrabold">👥 {t("squad.find")}</h1>
          <p className="text-sm text-white/50">{t("squad.worksWithFriends")}</p>
        </header>
        <Toast message={toast} />

        <div className="card space-y-3">
          <h2 className="font-display font-bold">{t("squad.create")}</h2>
          <div className="flex gap-2">
            <input
              className="input"
              placeholder={t("squad.squadName")}
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
            />
            <button
              className="btn-primary shrink-0"
              disabled={!createName.trim() || createSquad.isPending}
              onClick={() => createSquad.mutate(createName.trim())}
            >
              {t("squad.create")}
            </button>
          </div>
        </div>

        <div className="relative py-2 text-center">
          <div className="absolute inset-x-0 top-1/2 h-px bg-white/10" />
          <span className="relative bg-ink px-3 text-xs font-bold text-white/40">OR</span>
        </div>

        <div className="card space-y-3">
          <h2 className="font-display font-bold">{t("squad.join")}</h2>
          <div className="flex gap-2">
            <input
              className="input uppercase"
              placeholder={t("squad.inviteCode")}
              maxLength={10}
              value={invite}
              onChange={(e) => setInvite(e.target.value.toUpperCase())}
            />
            <button
              className="btn-primary shrink-0"
              disabled={!invite.trim() || joinSquad.isPending}
              onClick={() => joinSquad.mutate(invite.trim())}
            >
              {t("squad.join")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Toast message={toast} />
      <header className="flex items-center justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-white/40">Squad</div>
          <h1 className="font-display text-2xl font-extrabold">{squad.name}</h1>
        </div>
        {isAdmin && <span className="chip bg-amber-500/20 text-amber-300">★ Admin</span>}
      </header>

      {/* Invite */}
      <div className="card space-y-2">
        <div className="text-xs font-bold uppercase tracking-wide text-white/40">{t("squad.invite")}</div>
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-xl bg-white/5 px-4 py-3 text-center font-display text-2xl font-extrabold tracking-[0.3em] text-fuchsia-300">
            {squad.invite_code}
          </div>
          <button className="btn-ghost shrink-0" onClick={copyCode}>
            {copied ? t("squad.copied") : t("squad.copy")}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-primary" onClick={shareInvite}>
            🎁 {t("squad.inviteFriends")}
          </button>
          <button className="btn-ghost" onClick={copyInviteLink}>
            🔗 {t("squad.copyLink")}
          </button>
        </div>
        {isAdmin && (
          <button
            className="w-full text-xs font-bold text-white/40 underline-offset-2 hover:underline"
            onClick={() => rotateInvite.mutate()}
          >
            Regenerate
          </button>
        )}
      </div>

      {/* Members */}
      <section>
        <h2 className="mb-2 font-display text-lg font-bold">👥 {t("squad.members")} ({squad.members.length})</h2>
        <div className="card divide-y divide-white/5 !p-2">
          {squad.members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-2 py-2.5">
              <Avatar emoji={m.avatar} file={m.avatar_file} size="sm" />
              <div className="flex-1">
                <div className="text-sm font-bold">
                  {m.display_name}
                  {m.is_admin && <span className="ml-1 text-[10px] text-amber-300">★ admin</span>}
                </div>
                <div className="text-xs text-white/40">@{m.username} · 💎 {m.total_points} · 🔥 {m.streak}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Settings (admin only) */}
      {isAdmin && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-bold">⚙️ Squad rules</h2>

          <div className="card space-y-4">
            <div>
              <div className="mb-1.5 text-xs font-bold text-white/50">Voting rule</div>
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-white/5 p-1">
                {(
                  [
                    ["majority", "Majority"],
                    ["unanimous", "Unanimous"],
                    ["quorum", "Quorum %"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => updateSettings.mutate({ voting_rule: value })}
                    className={`rounded-lg py-2 text-xs font-bold transition ${
                      squad.settings.voting_rule === value ? "bg-violet-500 text-white" : "text-white/50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {squad.settings.voting_rule === "quorum" && (
              <div>
                <div className="mb-1.5 flex justify-between text-xs font-bold text-white/50">
                  <span>Approval needed</span>
                  <span className="text-fuchsia-300">{squad.settings.quorum_pct}%</span>
                </div>
                <input
                  type="range"
                  min={30}
                  max={100}
                  step={5}
                  value={squad.settings.quorum_pct}
                  onChange={(e) => updateSettings.mutate({ quorum_pct: Number(e.target.value) })}
                  className="w-full accent-fuchsia-500"
                />
              </div>
            )}

            <div>
              <div className="mb-1.5 flex justify-between text-xs font-bold text-white/50">
                <span>Voting window</span>
                <span className="text-fuchsia-300">{squad.settings.voting_hours}h</span>
              </div>
              <input
                type="range"
                min={6}
                max={72}
                step={6}
                value={squad.settings.voting_hours}
                onChange={(e) => updateSettings.mutate({ voting_hours: Number(e.target.value) })}
                className="w-full accent-fuchsia-500"
              />
            </div>

            <label className="flex items-center justify-between">
              <span className="text-xs font-bold text-white/60">Anonymous votes</span>
              <button
                onClick={() => updateSettings.mutate({ anonymous_votes: !squad.settings.anonymous_votes })}
                className={`relative h-6 w-11 rounded-full transition ${squad.settings.anonymous_votes ? "bg-fuchsia-500" : "bg-white/15"}`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${squad.settings.anonymous_votes ? "left-[22px]" : "left-0.5"}`}
                />
              </button>
            </label>

            <div>
              <div className="mb-1.5 flex justify-between text-xs font-bold text-white/50">
                <span>Punishment due in</span>
                <span className="text-fuchsia-300">{squad.settings.punishment_due_days} days</span>
              </div>
              <input
                type="range"
                min={1}
                max={14}
                value={squad.settings.punishment_due_days}
                onChange={(e) => updateSettings.mutate({ punishment_due_days: Number(e.target.value) })}
                className="w-full accent-fuchsia-500"
              />
            </div>
          </div>

          <div className="card space-y-3">
            <div className="text-xs font-bold uppercase tracking-wide text-white/40">Categories</div>
            <div className="flex flex-wrap gap-1.5">
              {squad.settings.categories.map((c) => (
                <span key={c} className="chip bg-white/10 text-white/70">
                  {c}
                  <button
                    onClick={() =>
                      updateSettings.mutate({ categories: squad.settings.categories.filter((x) => x !== c) })
                    }
                    className="ml-1 text-rose-300"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="input"
                placeholder="New category"
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
              />
              <button
                className="btn-ghost shrink-0"
                disabled={!newCat.trim()}
                onClick={() => {
                  updateSettings.mutate({ categories: [...squad.settings.categories, newCat.trim()] });
                  setNewCat("");
                }}
              >
                Add
              </button>
            </div>
          </div>

          <div className="card space-y-3">
            <div className="text-xs font-bold uppercase tracking-wide text-white/40">Punishment pool</div>
            {squad.settings.punishments.map((p) => (
              <div key={p} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-sm">
                <span>😈 {p}</span>
                <button
                  onClick={() =>
                    updateSettings.mutate({ punishments: squad.settings.punishments.filter((x) => x !== p) })
                  }
                  className="text-rose-300"
                >
                  ×
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                className="input"
                placeholder="New punishment"
                value={newPun}
                onChange={(e) => setNewPun(e.target.value)}
              />
              <button
                className="btn-ghost shrink-0"
                disabled={!newPun.trim()}
                onClick={() => {
                  updateSettings.mutate({ punishments: [...squad.settings.punishments, newPun.trim()] });
                  setNewPun("");
                }}
              >
                Add
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Danger zone */}
      <section className="card space-y-2 border-rose-500/20">
        <h2 className="font-display text-sm font-extrabold text-rose-300">⚠️ {t("squad.leaveTitle")}</h2>
        {isAdmin ? (
          <button
            className="btn-danger w-full"
            onClick={() => {
              if (window.confirm("Disband the whole squad? Everyone loses access to this group.")) {
                disbandSquad.mutate();
              }
            }}
          >
            {t("squad.disband")}
          </button>
        ) : (
          <button
            className="btn-danger w-full"
            onClick={() => {
              if (window.confirm("Leave this squad?")) leaveSquad.mutate();
            }}
          >
            {t("squad.leave")}
          </button>
        )}
      </section>
    </div>
  );
}
