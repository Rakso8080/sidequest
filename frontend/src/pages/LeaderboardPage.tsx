import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import type { LeaderboardEntry } from "../types";
import { Avatar, PageLoader } from "../components/ui";
import { RANK_EMOJI } from "../lib/format";

export function LeaderboardPage() {
  const { data, isLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ["leaderboard"],
    queryFn: () => api.get("/leaderboard"),
    refetchInterval: 20_000,
  });

  if (isLoading || !data) return <PageLoader />;

  return (
    <div className="space-y-4">
      <header className="text-center">
        <h1 className="font-display text-2xl font-extrabold">🏆 Squad ranks</h1>
        <p className="text-sm text-white/50">Live points, eternal glory. Mostly points.</p>
      </header>

      <div className="card !p-2">
        {data.map((e) => {
          const podium = e.rank <= 3;
          return (
            <div
              key={e.user_id}
              className={`flex items-center gap-3 rounded-2xl px-3 py-3 ${
                podium ? (e.rank === 1 ? "bg-amber-500/10" : "bg-white/5") : ""
              }`}
            >
              <span className="w-8 text-center text-xl">
                {RANK_EMOJI[e.rank] ?? <span className="text-sm font-bold text-white/40">{e.rank}</span>}
              </span>
              <Avatar emoji={e.avatar} />
              <div className="flex-1">
                <div className="font-bold">
                  {e.display_name}
                  {e.is_admin && <span className="ml-1 text-[10px] text-amber-300">★ admin</span>}
                </div>
                <div className="flex items-center gap-2 text-xs text-white/40">
                  <span>✅ {e.quests_completed} done</span>
                  <span>🔥 {e.streak} streak</span>
                </div>
              </div>
              <div className="text-right">
                <div className="font-display text-xl font-extrabold text-fuchsia-300">{e.total_points}</div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-white/30">pts</div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-white/30">Season resets and champion archive coming in v2.</p>
    </div>
  );
}
