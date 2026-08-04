import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Squad } from "../types";
import { Modal } from "./modal";
import { sfx } from "../lib/sound";

function defaultDate(): string {
  const d = new Date(Date.now() + 86400000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T12:00`;
}

export function PlanQuestModal({
  open,
  onClose,
  squad,
}: {
  open: boolean;
  onClose: () => void;
  squad: Squad;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: squad.settings.categories[0] ?? "Wildcard",
    difficulty: "medium",
    points: 50,
    proof_type: "photo",
    time_limit_hours: 72,
    scheduled_for: defaultDate(),
  });
  const [error, setError] = useState("");

  const plan = useMutation({
    mutationFn: () => api.post("/quests/plan", { ...form, scheduled_for: new Date(form.scheduled_for).toISOString() }),
    onSuccess: () => {
      sfx.success();
      qc.invalidateQueries();
      onClose();
      setForm({ ...form, title: "", description: "" });
    },
    onError: (err: any) => {
      sfx.error();
      setError(err.message || "Couldn't plan quest");
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="🗓️ Plan a side quest">
      <div className="space-y-3">
        <p className="rounded-xl bg-white/5 px-3 py-2 text-xs text-white/50">
          Schedule a quest for a future date. It shows on the board as <b className="text-white/80">Planned</b> and
          becomes startable when the date arrives.
        </p>
        <input
          className="input"
          placeholder="Quest title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        <textarea
          className="input min-h-14 resize-none"
          placeholder="What should the squad do?"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />

        <input
          type="datetime-local"
          className="input"
          value={form.scheduled_for}
          onChange={(e) => setForm({ ...form, scheduled_for: e.target.value })}
        />

        <div className="grid grid-cols-2 gap-2">
          <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {squad.settings.categories.map((c) => (
              <option key={c} value={c} className="bg-panel">
                {c}
              </option>
            ))}
          </select>
          <select
            className="input"
            value={form.difficulty}
            onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
          >
            <option value="easy" className="bg-panel">Easy</option>
            <option value="medium" className="bg-panel">Medium</option>
            <option value="hard" className="bg-panel">Hard</option>
          </select>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
          <span className="text-xs font-bold text-white/50">Point value</span>
          <div className="flex items-center gap-2">
            <button
              className="h-8 w-8 rounded-lg bg-white/10 font-bold"
              onClick={() => setForm({ ...form, points: Math.max(5, form.points - 5) })}
            >
              −
            </button>
            <span className="w-12 text-center font-display text-lg font-extrabold text-fuchsia-300">{form.points}</span>
            <button
              className="h-8 w-8 rounded-lg bg-white/10 font-bold"
              onClick={() => setForm({ ...form, points: Math.min(500, form.points + 5) })}
            >
              +
            </button>
          </div>
        </div>

        {error && <div className="rounded-lg bg-rose-500/15 px-3 py-2 text-xs font-bold text-rose-300">{error}</div>}

        <button
          className="btn-primary w-full"
          disabled={!form.title.trim() || !form.scheduled_for || plan.isPending}
          onClick={() => plan.mutate()}
        >
          {plan.isPending ? "Planning…" : "Schedule it 📌"}
        </button>
      </div>
    </Modal>
  );
}
