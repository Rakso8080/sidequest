import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Submission } from "../types";
import { Avatar, Confetti } from "./ui";
import { assetUrl, timeAgo } from "../lib/format";
import { sfx } from "../lib/sound";

export function VotingCard({ sub }: { sub: Submission }) {
  const qc = useQueryClient();
  const [celebrate, setCelebrate] = useState(false);
  const [error, setError] = useState("");

  const vote = useMutation({
    mutationFn: (decision: string) =>
      api.post("/votes", { submission_id: sub.id, decision }),
    onSuccess: (data: any) => {
      sfx.approve();
      if (data.status === "approved") {
        setCelebrate(true);
        sfx.success();
        window.setTimeout(() => setCelebrate(false), 1400);
      }
      qc.invalidateQueries();
    },
    onError: (err: any) => {
      sfx.error();
      setError(err.message || "Vote failed");
    },
  });

  return (
    <div className="card animate-slide-up relative overflow-hidden">
      {celebrate && <Confetti />}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Avatar emoji={sub.user_avatar} file={sub.user_avatar_file} size="sm" />
          <div>
            <div className="text-sm font-bold">{sub.user_name}</div>
            <div className="text-xs text-white/40">
              submitted {timeAgo(sub.submitted_at ?? "")} · {sub.quest_category}
            </div>
          </div>
        </div>
        <span className="chip bg-fuchsia-500/20 text-fuchsia-300">+{sub.quest_points}</span>
      </div>

      <div className="mt-3">
        <div className="font-display text-base font-bold">{sub.quest_title}</div>
        {sub.proof_file && (
          <div className="mt-2 overflow-hidden rounded-xl bg-black/30">
            <img src={assetUrl(sub.proof_file)} alt="Proof" className="max-h-64 w-full object-cover" />
          </div>
        )}
        {sub.proof_text && (
          <p className="mt-2 rounded-xl bg-white/5 px-3 py-2 text-sm italic text-white/70">“{sub.proof_text}”</p>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className="text-xs font-bold text-white/40">
          🗳️ {sub.approve_count}✓ · {sub.reject_count}✗
        </span>
        <span className="text-xs text-white/30">· vote closes soon</span>
      </div>

      {error && <div className="mt-2 rounded-lg bg-rose-500/15 px-3 py-2 text-xs font-bold text-rose-300">{error}</div>}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => vote.mutate("approve")}
          disabled={vote.isPending}
          className="rounded-xl bg-emerald-500/90 py-3 text-sm font-extrabold text-white transition active:scale-95 disabled:opacity-40"
        >
          ✓ Approve
        </button>
        <button
          onClick={() => vote.mutate("reject")}
          disabled={vote.isPending}
          className="rounded-xl bg-rose-500/90 py-3 text-sm font-extrabold text-white transition active:scale-95 disabled:opacity-40"
        >
          ✗ Reject
        </button>
      </div>
    </div>
  );
}
