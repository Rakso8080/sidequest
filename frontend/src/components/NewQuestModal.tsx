import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Squad } from "../types";
import { Modal } from "./modal";

export function NewQuestModal({
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
    squad_quest: false,
  });
  const [error, setError] = useState("");

  const createQuest = useMutation({
    mutationFn: () => api.post("/quests", form),
    onSuccess: () => {
      qc.invalidateQueries();
      onClose();
      setForm({ ...form, title: "", description: "" });
    },
    onError: (err: any) => setError(err.message || "Failed to create quest"),
  });

  return (
    <Modal open={open} onClose={onClose} title="New quest">
      <div className="space-y-3">
        <input
          className="input"
          placeholder="Quest title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        <textarea
          className="input min-h-16 resize-none"
          placeholder="What do they have to do?"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
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
          <select
            className="input"
            value={form.proof_type}
            onChange={(e) => setForm({ ...form, proof_type: e.target.value })}
          >
            <option value="photo" className="bg-panel">📸 Photo</option>
            <option value="video" className="bg-panel">🎬 Video</option>
            <option value="text" className="bg-panel">✍️ Text</option>
            <option value="self_report" className="bg-panel">✅ Self report</option>
          </select>
          <select
            className="input"
            value={form.time_limit_hours}
            onChange={(e) => setForm({ ...form, time_limit_hours: Number(e.target.value) })}
          >
            <option value={24} className="bg-panel">⏱️ 24h limit</option>
            <option value={72} className="bg-panel">⏱️ 3 days</option>
            <option value={168} className="bg-panel">⏱️ 1 week</option>
            <option value={336} className="bg-panel">⏱️ 2 weeks</option>
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

        <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
          <div>
            <span className="text-xs font-bold text-white/50">👥 Squad quest</span>
            <div className="text-[10px] text-white/35">Everyone must submit or everyone loses points</div>
          </div>
          <button
            className={`h-8 w-14 rounded-full p-1 transition ${form.squad_quest ? "bg-rose-500" : "bg-white/10"}`}
            onClick={() => setForm({ ...form, squad_quest: !form.squad_quest })}
            aria-label="Squad quest"
          >
            <div className={`h-6 w-6 rounded-full bg-white transition ${form.squad_quest ? "translate-x-6" : ""}`} />
          </button>
        </div>

        {error && <div className="rounded-lg bg-rose-500/15 px-3 py-2 text-xs font-bold text-rose-300">{error}</div>}

        <button
          className="btn-primary w-full"
          disabled={!form.title.trim() || createQuest.isPending}
          onClick={() => createQuest.mutate()}
        >
          {createQuest.isPending ? "Creating…" : "Add to quest board"}
        </button>
      </div>
    </Modal>
  );
}
