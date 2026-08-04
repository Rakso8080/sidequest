import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { QuestProposal } from "../types";
import { Modal } from "./modal";
import { Avatar, EmptyState } from "./ui";
import { difficultyStyle, timeAgo } from "../lib/format";

const STATUS_CHIP: Record<string, { label: string; cls: string }> = {
  pending: { label: "⏳ Pending", cls: "bg-amber-500/20 text-amber-300" },
  approved: { label: "✅ Approved", cls: "bg-emerald-500/20 text-emerald-300" },
  rejected: { label: "❌ Declined", cls: "bg-rose-500/20 text-rose-300" },
};

export function ProposalsModal({
  open,
  onClose,
  proposals,
  isAdmin,
}: {
  open: boolean;
  onClose: () => void;
  proposals: QuestProposal[];
  isAdmin: boolean;
}) {
  const qc = useQueryClient();
  const visible = isAdmin ? proposals : proposals.filter((p) => p.is_mine);
  const pending = visible.filter((p) => p.status === "pending");

  const decide = useMutation({
    mutationFn: ({ id, action }: { id: number; action: "approve" | "reject" }) =>
      api.post(`/quests/proposals/${id}/${action}`),
    onSuccess: () => qc.invalidateQueries(),
  });

  return (
    <Modal open={open} onClose={onClose} title={isAdmin ? "Quest proposals" : "My proposals"}>
      {isAdmin && pending.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-300">
            Needs your review ({pending.length})
          </div>
          <div className="space-y-3">
            {pending.map((p) => {
              const diff = difficultyStyle(p.difficulty);
              return (
                <div key={p.id} className="rounded-2xl bg-white/5 p-3">
                  <div className="flex items-center gap-2">
                    <Avatar emoji={p.user_avatar} size="sm" />
                    <div className="text-xs text-white/50">{p.user_name} · {timeAgo(p.created_at)}</div>
                    <span className="ml-auto chip bg-fuchsia-500/20 text-fuchsia-300">+{p.points}</span>
                  </div>
                  <div className="mt-2 font-display font-bold">{p.title}</div>
                  {p.description && <div className="mt-0.5 text-sm text-white/55">{p.description}</div>}
                  <div className="mt-1.5 flex gap-1.5">
                    <span className="chip bg-white/10 text-white/60">{p.category}</span>
                    <span className={`chip ${diff.cls}`}>{diff.label}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      className="rounded-xl bg-emerald-500/90 py-2 text-xs font-extrabold text-white transition active:scale-95 disabled:opacity-40"
                      disabled={decide.isPending}
                      onClick={() => decide.mutate({ id: p.id, action: "approve" })}
                    >
                      ✓ Add to board
                    </button>
                    <button
                      className="rounded-xl bg-rose-500/90 py-2 text-xs font-extrabold text-white transition active:scale-95 disabled:opacity-40"
                      disabled={decide.isPending}
                      onClick={() => decide.mutate({ id: p.id, action: "reject" })}
                    >
                      ✗ Decline
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyState icon="🗒️" title="No proposals" subtitle="Members can suggest their own quests here." />
      ) : (
        <div className="space-y-2">
          {visible.map((p) => {
            const chip = STATUS_CHIP[p.status];
            const diff = difficultyStyle(p.difficulty);
            return (
              <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-white/5 p-3">
                {isAdmin && <Avatar emoji={p.user_avatar} size="sm" />}
                <div className="flex-1">
                  <div className="text-sm font-bold">{p.title}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <span className="chip bg-white/10 text-white/60">{p.category}</span>
                    <span className={`chip ${diff.cls}`}>{diff.label}</span>
                    <span className={`chip ${chip.cls}`}>{chip.label}</span>
                  </div>
                </div>
                <div className="font-display text-sm font-extrabold text-fuchsia-300">+{p.points}</div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
