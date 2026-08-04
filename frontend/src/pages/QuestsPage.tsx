import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Quest, QuestProposal, Squad } from "../types";
import { countdownTo, difficultyStyle, proofIcon, proofLabel } from "../lib/format";
import { EmptyState, PageLoader } from "../components/ui";
import { useToast, Toast } from "../components/modal";
import { NewQuestModal } from "../components/NewQuestModal";
import { ProposeQuestModal } from "../components/ProposeQuestModal";
import { ProposalsModal } from "../components/ProposalsModal";
import { SpinWheelModal } from "../components/SpinWheelModal";
import { PlanQuestModal } from "../components/PlanQuestModal";
import { useAuth } from "../store/auth";
import { sfx } from "../lib/sound";
import { useI18n } from "../lib/i18n";

export function QuestsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast, show } = useToast();
  const { t } = useI18n();
  const [category, setCategory] = useState<string>("all");
  const [showMine, setShowMine] = useState(false);
  const [newQuestOpen, setNewQuestOpen] = useState(false);
  const [proposeOpen, setProposeOpen] = useState(false);
  const [proposalsOpen, setProposalsOpen] = useState(false);
  const [wheelOpen, setWheelOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);

  const { data: quests, isLoading } = useQuery<Quest[]>({
    queryKey: ["quests"],
    queryFn: () => api.get("/quests"),
  });
  const { data: squad } = useQuery<Squad>({
    queryKey: ["squad"],
    queryFn: () => api.get("/squads/me"),
    enabled: !!user?.squad_id,
  });
  const { data: proposals } = useQuery<QuestProposal[]>({
    queryKey: ["quest-proposals"],
    queryFn: () => api.get("/quests/proposals"),
    enabled: !!user?.squad_id,
  });

  const startQuest = useMutation({
    mutationFn: (id: number) => api.post<Quest>("/quests/start", { quest_id: id }),
    onSuccess: (q: Quest) => {
      sfx.pop();
      show(`Started “${q.title}” — go earn it! ⚔️`);
      qc.invalidateQueries();
    },
    onError: (err: any) => {
      sfx.error();
      show(err.message || "Couldn't start quest");
    },
  });

  const categories = squad?.settings?.categories ?? [];
  const isAdmin = squad?.admin_id === user?.id;
  const now = Date.now();
  const allFiltered = (quests ?? []).filter(
    (q) => (category === "all" || q.category === category) && (showMine ? q.my_status === "in_progress" || q.my_status === "pending" : true),
  );
  const planned = allFiltered.filter((q) => q.scheduled_for && new Date(q.scheduled_for).getTime() > now);
  const list = allFiltered.filter((q) => !q.scheduled_for || new Date(q.scheduled_for).getTime() <= now);
  const pendingCount = proposals?.filter((p) => p.status === "pending").length ?? 0;

  if (isLoading || !quests || !squad) return <PageLoader />;

  return (
    <div className="space-y-4">
      <Toast message={toast} />
      <header className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold">🎯 {t("quests.title")}</h1>
          <p className="text-sm text-white/50">{t("quests.subtitle")}</p>
        </div>
        {isAdmin && (
          <button className="btn-primary shrink-0 !px-3 !py-2 !text-xs" onClick={() => setNewQuestOpen(true)}>
            + {t("quests.addQuest")}
          </button>
        )}
      </header>

      <div className="grid grid-cols-2 gap-2">
        <button className="btn-primary !py-3" onClick={() => setWheelOpen(true)} disabled={list.length === 0}>
          🎡 {t("quests.title")} spin
        </button>
        <div className="grid grid-cols-3 gap-2">
          <button className="btn-ghost !py-3 !px-2 !text-[11px]" onClick={() => setProposeOpen(true)}>
            💡 {t("quests.propose")}
          </button>
          <button className="btn-ghost !py-3 !px-2 !text-[11px]" onClick={() => setPlanOpen(true)}>
            🗓️ {t("quests.plan")}
          </button>
          <button className="btn-ghost relative !py-3 !px-2" onClick={() => setProposalsOpen(true)}>
            🗒️
            {pendingCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold">
                {pendingCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          onClick={() => setCategory("all")}
          className={`chip shrink-0 ${category === "all" ? "bg-violet-500 text-white" : "bg-white/10 text-white/60"}`}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`chip shrink-0 ${category === c ? "bg-violet-500 text-white" : "bg-white/10 text-white/60"}`}
          >
            {c}
          </button>
        ))}
        <button
          onClick={() => setShowMine(!showMine)}
          className={`chip shrink-0 ${showMine ? "bg-fuchsia-500 text-white" : "bg-white/10 text-white/60"}`}
        >
          ⚔️ In progress
        </button>
      </div>

      {planned.length > 0 && (
        <section>
          <h2 className="mb-2 font-display text-lg font-bold text-sky-300">🗓️ {t("quests.planned")} ({planned.length})</h2>
          <div className="space-y-3">
            {planned.map((q) => {
              const diff = difficultyStyle(q.difficulty);
              return (
                <div key={q.id} className="card animate-slide-up opacity-90">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="chip bg-white/10 text-white/60">{q.category}</span>
                        <span className={`chip ${diff.cls}`}>{diff.label}</span>
                        <span className="chip bg-sky-500/20 text-sky-300">📅 {countdownTo(q.scheduled_for!)}</span>
                      </div>
                      <h3 className="mt-2 font-display text-base font-bold">{q.title}</h3>
                      {q.description && <p className="mt-0.5 text-sm text-white/55">{q.description}</p>}
                      {q.created_by_name && (
                        <div className="mt-1.5 text-xs text-white/40">planned by {q.created_by_name}</div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-display text-2xl font-extrabold text-fuchsia-300">+{q.points}</div>
                      <span className="chip mt-1 bg-sky-500/20 text-sky-300">coming soon</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {list.length === 0 ? (
        <EmptyState icon="🗺️" title={t("dashboard.noActive")} />
      ) : (
        <div className="space-y-3">
          {list.map((q) => {
            const diff = difficultyStyle(q.difficulty);
            return (
              <div key={q.id} className="card animate-slide-up">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="chip bg-white/10 text-white/60">{q.category}</span>
                      <span className={`chip ${diff.cls}`}>{diff.label}</span>
                      {q.squad_quest && <span className="chip bg-rose-500/20 text-rose-300">👥 Squad quest</span>}
                      {q.my_status && (
                        <span className="chip bg-sky-500/20 text-sky-300">
                          {q.my_status === "in_progress" ? "⏳ In progress" : "🗳️ Awaiting votes"}
                        </span>
                      )}
                    </div>
                    <h3 className="mt-2 font-display text-base font-bold">{q.title}</h3>
                    <p className="mt-0.5 text-sm text-white/55">{q.description}</p>
                    <div className="mt-2 flex items-center gap-3 text-xs text-white/45">
                      <span>
                        {proofIcon(q.proof_type)} {proofLabel(q.proof_type)}
                      </span>
                      <span>⏱️ {q.time_limit_hours >= 24 ? `${Math.round(q.time_limit_hours / 24)}d` : `${q.time_limit_hours}h`} limit</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-2xl font-extrabold text-fuchsia-300">+{q.points}</div>
                    <button
                      className="btn-primary mt-2 !px-3 !py-1.5 !text-xs"
                      disabled={!!q.my_status || startQuest.isPending}
                      onClick={() => startQuest.mutate(q.id)}
                    >
                      {q.my_status ? t("quests.started") : t("quests.start")}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <NewQuestModal open={newQuestOpen} onClose={() => setNewQuestOpen(false)} squad={squad} />
      <ProposeQuestModal open={proposeOpen} onClose={() => setProposeOpen(false)} squad={squad} />
      <PlanQuestModal open={planOpen} onClose={() => setPlanOpen(false)} squad={squad} />
      <ProposalsModal
        open={proposalsOpen}
        onClose={() => setProposalsOpen(false)}
        proposals={proposals ?? []}
        isAdmin={isAdmin}
      />
      <SpinWheelModal open={wheelOpen} onClose={() => setWheelOpen(false)} quests={list} />
    </div>
  );
}
