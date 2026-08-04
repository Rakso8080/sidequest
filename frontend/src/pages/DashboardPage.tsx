import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Dashboard } from "../types";
import { useAuth } from "../store/auth";
import { Avatar, PageLoader } from "../components/ui";
import { SubmissionCard } from "../components/SubmissionCard";
import { VotingCard } from "../components/VotingCard";
import { EmptyState } from "../components/ui";
import { RANK_EMOJI } from "../lib/format";

export function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery<Dashboard>({
    queryKey: ["dashboard"],
    queryFn: () => api.get("/dashboard"),
    refetchInterval: 20_000,
  });

  if (isLoading || !data) return <PageLoader />;

  const { stats, active_quests, pending_votes, leaderboard, my_punishments, unread_notifications } = data;
  const name = user?.display_name?.split(" ")[0] ?? "Player";

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-white/40">Squad HQ</div>
          <h1 className="font-display text-2xl font-extrabold">
            Yo, {name}! <span className="text-fuchsia-400">👋</span>
          </h1>
        </div>
        <Link
          to="/notifications"
          className="relative rounded-xl bg-white/5 p-2.5 text-xl hover:bg-white/10"
        >
          🔔
          {unread_notifications > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-fuchsia-500 px-1 text-[10px] font-bold">
              {unread_notifications}
            </span>
          )}
        </Link>
      </header>

      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Points", value: stats.total_points, icon: "💎" },
          { label: "Streak", value: stats.streak, icon: "🔥" },
          { label: "Rank", value: `#${stats.rank}`, icon: "🏅" },
          { label: "Done", value: stats.quests_completed, icon: "✅" },
        ].map((s) => (
          <div key={s.label} className="card !p-3 text-center">
            <div className="text-lg leading-none">{s.icon}</div>
            <div className="mt-1 font-display text-xl font-extrabold">{s.value}</div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-white/40">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Pending votes */}
      {pending_votes.length > 0 && (
        <section>
          <h2 className="mb-2 font-display text-lg font-bold text-amber-300">
            🗳️ Needs your vote ({pending_votes.length})
          </h2>
          <div className="space-y-3">
            {pending_votes.map((sub) => (
              <VotingCard key={sub.id} sub={sub} />
            ))}
          </div>
        </section>
      )}

      {/* Active quests */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">⚔️ Active quests</h2>
          <Link to="/quests" className="text-xs font-bold text-fuchsia-300">
            Browse all →
          </Link>
        </div>
        {active_quests.length === 0 ? (
          <EmptyState
            icon="🌱"
            title="No active quests"
            subtitle="Pick one from the quest board and start earning."
          />
        ) : (
          <div className="space-y-3">
            {active_quests.map((sub) => (
              <SubmissionCard key={sub.id} sub={sub} />
            ))}
          </div>
        )}
      </section>

      {/* Leaderboard snapshot */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">🏆 Leaderboard</h2>
          <Link to="/leaderboard" className="text-xs font-bold text-fuchsia-300">
            Full board →
          </Link>
        </div>
        <div className="card divide-y divide-white/5 !p-2">
          {leaderboard.map((e) => (
            <div key={e.user_id} className="flex items-center gap-3 px-2 py-2.5">
              <span className="w-7 text-center text-lg">
                {RANK_EMOJI[e.rank] ?? <span className="text-sm font-bold text-white/40">{e.rank}</span>}
              </span>
              <Avatar emoji={e.avatar} size="sm" />
              <div className="flex-1">
                <div className="text-sm font-bold">
                  {e.display_name}
                  {e.is_admin && <span className="ml-1 text-[10px] text-amber-300">★</span>}
                </div>
                <div className="text-xs text-white/40">🔥 {e.streak} streak</div>
              </div>
              <div className="font-display text-base font-extrabold text-fuchsia-300">{e.total_points}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Punishments */}
      {my_punishments.length > 0 && (
        <section>
          <h2 className="mb-2 font-display text-lg font-bold text-rose-300">😈 Your punishments</h2>
          <div className="space-y-2">
            {my_punishments.map((p) => (
              <div key={p.id} className="card flex items-center gap-3 !p-3.5">
                <span className="text-2xl">🧨</span>
                <div className="flex-1">
                  <div className="text-sm font-bold">{p.description}</div>
                  <div className={`text-xs font-bold ${p.status === "overdue" ? "text-rose-400" : "text-white/40"}`}>
                    due {new Date(p.due_date).toLocaleDateString()}
                    {p.status === "overdue" && " · OVERDUE"}
                  </div>
                </div>
                {p.status === "assigned" && <span className="chip bg-amber-500/20 text-amber-300">Assigned</span>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
