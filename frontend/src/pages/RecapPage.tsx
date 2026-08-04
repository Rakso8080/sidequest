import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Recap } from "../types";
import { assetUrl } from "../lib/format";
import { PageLoader, EmptyState } from "../components/ui";
import { sfx } from "../lib/sound";
import { generateRecapVideo } from "../lib/recap";
import { useI18n } from "../lib/i18n";

export function RecapPage() {
  const { t } = useI18n();
  const { data, isLoading } = useQuery<Recap>({
    queryKey: ["recap"],
    queryFn: () => api.get("/recap"),
    refetchInterval: 60_000,
  });
  const [generating, setGenerating] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  if (isLoading || !data) return <PageLoader />;

  const { squad_name, items } = data;

  async function generate() {
    if (items.length === 0) return;
    setGenerating(true);
    setError("");
    setVideoUrl(null);
    sfx.pop();
    try {
      const { blob } = await generateRecapVideo(items, squad_name);
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
      sfx.success();
    } catch (err: any) {
      sfx.error();
      setError(err?.message || t("recap.generating"));
    } finally {
      setGenerating(false);
    }
  }

  const ext = videoUrl?.includes(".webm") ? "webm" : "mp4";

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-2xl font-extrabold">🎬 {t("recap.title")}</h1>
        <p className="text-sm text-white/50">{t("recap.subtitle")}</p>
      </header>

      <button
        className="btn-primary w-full !py-3.5"
        onClick={generate}
        disabled={generating || items.length === 0}
      >
        {generating
          ? "🎬 Rendering your memories…"
          : items.length === 0
            ? "No memories yet"
            : `🎬 Generate recap video (${items.length} photos)`}
      </button>

      {error && <div className="rounded-lg bg-rose-500/15 px-3 py-2 text-xs font-bold text-rose-300">{error}</div>}

      {videoUrl && (
        <div className="space-y-2">
          <video src={videoUrl} controls className="w-full rounded-2xl bg-black shadow-xl" />
          <div className="flex gap-2">
            <a href={videoUrl} download={`sidequest-recap-${data.year ?? "all"}.${ext}`} className="btn-primary flex-1 text-center">
              ⬇️ Download video
            </a>
            <button className="btn-ghost flex-1" onClick={generate}>
              Regenerate
            </button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon="📸"
          title="No photos yet"
          subtitle="Approved quests with photo proof show up here. Go earn some memories!"
        />
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {items.map((it) => (
            <figure key={it.id} className="group relative overflow-hidden rounded-xl bg-black/40">
              <img
                src={assetUrl(it.proof_file)}
                alt={it.title}
                loading="lazy"
                className="aspect-square w-full object-cover transition group-hover:scale-105"
              />
              <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                <div className="truncate text-xs font-bold">{it.title}</div>
                <div className="truncate text-[10px] text-white/50">
                  {it.user_avatar} {it.user_name} · {it.category}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
