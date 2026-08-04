import { useState } from "react";
import type { Submission } from "../types";
import { assetUrl, proofIcon, timeAgo, timeLeft } from "../lib/format";
import { Avatar } from "./ui";
import { SubmitProofModal } from "./SubmitProofModal";

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  in_progress: { label: "In progress", cls: "bg-sky-500/20 text-sky-300" },
  pending: { label: "Awaiting votes", cls: "bg-amber-500/20 text-amber-300" },
  approved: { label: "Approved ✓", cls: "bg-emerald-500/20 text-emerald-300" },
  rejected: { label: "Rejected ✗", cls: "bg-rose-500/20 text-rose-300" },
  expired: { label: "Expired", cls: "bg-rose-500/20 text-rose-300" },
};

export function StatusChip({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.in_progress;
  return <span className={`chip ${s.cls}`}>{s.label}</span>;
}

export function SubmissionCard({ sub }: { sub: Submission }) {
  const [submitOpen, setSubmitOpen] = useState(false);
  const tl = sub.status === "in_progress" ? timeLeft(sub.deadline) : null;
  const showPhoto = sub.proof_file && sub.status !== "in_progress";

  return (
    <div className="card animate-slide-up">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <Avatar emoji={sub.user_avatar} size="sm" />
          <div>
            <div className="text-sm font-bold leading-tight">{sub.user_name}</div>
            <div className="text-xs text-white/40">
              {sub.status === "in_progress" ? "started" : "submitted"} {timeAgo(sub.submitted_at ?? sub.started_at)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <StatusChip status={sub.status} />
          <span className="chip bg-fuchsia-500/20 text-fuchsia-300">+{sub.quest_points}</span>
        </div>
      </div>

      <div className="mt-3">
        <div className="font-display text-base font-bold">{sub.quest_title}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-white/50">
          <span className="chip bg-white/10 text-white/60">{sub.quest_category}</span>
          <span className="chip bg-white/10 text-white/60">
            {proofIcon(sub.quest_proof_type)} {sub.quest_proof_type}
          </span>
        </div>
      </div>

      {showPhoto && sub.proof_file && (
        <div className="mt-3 overflow-hidden rounded-xl bg-black/30">
          <img src={assetUrl(sub.proof_file)} alt="Proof" className="max-h-56 w-full object-cover" />
        </div>
      )}

      {sub.proof_text && sub.status !== "in_progress" && (
        <p className="mt-2.5 rounded-xl bg-white/5 px-3 py-2 text-sm italic text-white/70">“{sub.proof_text}”</p>
      )}

      {tl && (
        <div
          className={`mt-3 rounded-xl px-3 py-2 text-center text-sm font-bold ${
            tl.urgent ? "bg-rose-500/15 text-rose-300" : "bg-white/5 text-white/60"
          }`}
        >
          ⏳ {tl.text}
        </div>
      )}

      {sub.status === "in_progress" && sub.can_submit && (
        <button className="btn-primary mt-3 w-full" onClick={() => setSubmitOpen(true)}>
          Submit proof
        </button>
      )}

      {sub.status === "pending" && (
        <div className="mt-3 flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-xs text-white/50">
          <span>
            🗳️ {sub.approve_count}✓ / {sub.reject_count}✗
          </span>
          {sub.my_vote && <span className="font-bold text-white/70">You voted {sub.my_vote}</span>}
        </div>
      )}

      {sub.status === "approved" && (
        <div className="mt-3 rounded-xl bg-emerald-500/10 px-3 py-2 text-center text-sm font-bold text-emerald-300">
          🎉 Approved · +{sub.quest_points} pts
        </div>
      )}
      {(sub.status === "rejected" || sub.status === "expired") && (
        <div className="mt-3 rounded-xl bg-rose-500/10 px-3 py-2 text-center text-sm font-bold text-rose-300">
          😈 {sub.status === "rejected" ? "Rejected" : "Deadline missed"} — punishment incoming
        </div>
      )}

      <SubmitProofModal
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        submissionId={sub.id}
        questTitle={sub.quest_title}
        proofType={sub.quest_proof_type}
      />
    </div>
  );
}
