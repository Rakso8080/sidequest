import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Notification } from "../types";
import { EmptyState, PageLoader } from "../components/ui";
import { timeAgo } from "../lib/format";
import { useI18n } from "../lib/i18n";
import { disablePush, enablePush, getPushState, isSupported, type PushState } from "../lib/push";

const TYPE_ICON: Record<string, string> = {
  vote: "🗳️",
  success: "🎉",
  punishment: "😈",
  info: "🔔",
};

export function NotificationsPage() {
  const qc = useQueryClient();
  const { t } = useI18n();
  const [pushState, setPushState] = useState<PushState>("unavailable");
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMsg, setPushMsg] = useState("");

  const { data, isLoading } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: () => api.get("/notifications"),
  });

  useEffect(() => {
    getPushState().then(setPushState);
  }, []);

  async function togglePush() {
    setPushBusy(true);
    setPushMsg("");
    try {
      if (pushState === "on") {
        await disablePush();
        setPushState("off");
      } else {
        await enablePush();
        setPushState("on");
      }
    } catch (err: any) {
      if (err?.message === "denied") setPushMsg(t("push.denied"));
      else if (err?.message === "not-supported") setPushMsg(t("push.unsupported"));
      else setPushMsg(t("push.error"));
    } finally {
      setPushBusy(false);
    }
  }

  const markAll = useMutation({
    mutationFn: () => api.post("/notifications/read-all"),
    onSuccess: () => qc.invalidateQueries(),
  });

  if (isLoading || !data) return <PageLoader />;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-extrabold">🔔 {t("notifications.title")}</h1>
        {data.some((n) => !n.read) && (
          <button className="text-xs font-bold text-fuchsia-300" onClick={() => markAll.mutate()}>
            {t("notifications.markAll")}
          </button>
        )}
      </header>

      {isSupported() && pushState !== "unavailable" && (
        <div className="card flex items-center justify-between !p-3.5">
          <div className="flex-1 pr-3">
            <div className="text-sm font-bold">📲 {t("push.title")}</div>
            <div className="text-[11px] text-white/45">{t("push.hint")}</div>
            {pushMsg && <div className="mt-1 text-[11px] font-bold text-rose-300">{pushMsg}</div>}
          </div>
          <button
            onClick={togglePush}
            disabled={pushBusy || pushState === "denied"}
            className={`relative h-7 w-12 shrink-0 rounded-full transition ${
              pushState === "on" ? "bg-fuchsia-500" : pushState === "denied" ? "bg-rose-500/40" : "bg-white/15"
            }`}
            aria-label="Push notifications"
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all ${
                pushState === "on" ? "left-[22px]" : "left-0.5"
              }`}
            />
          </button>
        </div>
      )}

      {data.length === 0 ? (
        <EmptyState icon="🔕" title={t("notifications.empty")} />
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
