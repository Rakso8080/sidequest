import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Notification } from "../types";
import { EmptyState, PageLoader } from "../components/ui";
import { timeAgo } from "../lib/format";

const TYPE_ICON: Record<string, string> = {
  vote: "🗳️",
  success: "🎉",
  punishment: "😈",
  info: "🔔",
};

export function NotificationsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: () => api.get("/notifications"),
  });

  const markAll = useMutation({
    mutationFn: () => api.post("/notifications/read-all"),
    onSuccess: () => qc.invalidateQueries(),
  });

  if (isLoading || !data) return <PageLoader />;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-extrabold">🔔 Notifications</h1>
        {data.some((n) => !n.read) && (
          <button className="text-xs font-bold text-fuchsia-300" onClick={() => markAll.mutate()}>
            Mark all read
          </button>
        )}
      </header>

      {data.length === 0 ? (
        <EmptyState icon="🔕" title="All quiet" subtitle="Votes, results and punishments will land here." />
      ) : (
        <div className="space-y-2">
          {data.map((n) => (
            <div
              key={n.id}
              className={`card flex items-start gap-3 !p-3.5 ${n.read ? "opacity-50" : "border-violet-400/30"}`}
            >
              <span className="text-2xl">{TYPE_ICON[n.type] ?? "🔔"}</span>
              <div className="flex-1">
                <div className="text-sm font-bold">{n.title}</div>
                {n.body && <div className="mt-0.5 text-xs text-white/55">{n.body}</div>}
                <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-white/30">
                  {timeAgo(n.created_at)}
                </div>
              </div>
              {!n.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-fuchsia-400" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
