import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Quest } from "../types";
import { Modal } from "./modal";
import { Confetti } from "./ui";
import { difficultyStyle, proofLabel } from "../lib/format";

const COLORS = [
  "#8b5cf6",
  "#d946ef",
  "#f59e0b",
  "#10b981",
  "#0ea5e9",
  "#f43f5e",
  "#facc15",
  "#22d3ee",
  "#fb923c",
  "#a3e635",
];

export function SpinWheelModal({
  open,
  onClose,
  quests,
}: {
  open: boolean;
  onClose: () => void;
  quests: Quest[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotRef = useRef(0);
  const [spinning, setSpinning] = useState(false);
  const [landed, setLanded] = useState<Quest | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const qc = useQueryClient();

  const startQuest = useMutation({
    mutationFn: (id: number) => api.post("/quests/start", { quest_id: id }),
    onSuccess: () => {
      qc.invalidateQueries();
      onClose();
    },
  });

  function draw(rotation: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx || quests.length === 0) return;
    const size = canvas.width;
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 4;
    const seg = (2 * Math.PI) / quests.length;

    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);

    for (let i = 0; i < quests.length; i++) {
      const start = i * seg;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, start, start + seg);
      ctx.closePath();
      ctx.fillStyle = COLORS[i % COLORS.length];
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.save();
      ctx.rotate(start + seg / 2);
      ctx.textAlign = "right";
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${Math.max(10, Math.round(size * 0.026))}px Nunito, sans-serif`;
      ctx.fillText(quests[i].title.slice(0, 20), r - 14, 5);
      ctx.restore();
    }
    ctx.restore();

    // center hub
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.16, 0, 2 * Math.PI);
    ctx.fillStyle = "#1f1c2c";
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  useEffect(() => {
    if (open) {
      rotRef.current = 0;
      setLanded(null);
      draw(0);
    }
  }, [open]);

  useEffect(() => {
    if (open) draw(rotRef.current);
  }, [quests]);

  function spin() {
    if (spinning || quests.length === 0) return;
    setSpinning(true);
    setLanded(null);
    const n = quests.length;
    const target = Math.floor(Math.random() * n);
    const seg = (2 * Math.PI) / n;
    const center = (target + 0.5) * seg;
    const current = ((rotRef.current % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    // bring segment center under the pointer (top = -90°)
    let delta = (-Math.PI / 2 - center) - current;
    delta = ((delta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const startRot = rotRef.current;
    const totalRot = startRot + 5 * 2 * Math.PI + delta;
    const duration = 4500;
    const t0 = performance.now();
    const ease = (t: number) => 1 - Math.pow(1 - t, 4);

    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      rotRef.current = startRot + (totalRot - startRot) * ease(t);
      draw(rotRef.current);
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        setSpinning(false);
        setLanded(quests[target]);
        setCelebrate(true);
        window.setTimeout(() => setCelebrate(false), 1600);
      }
    };
    requestAnimationFrame(step);
  }

  const canSpin = quests.length > 0 && !spinning;

  return (
    <Modal open={open} onClose={onClose} title="🎡 Spin the wheel">
      {celebrate && <Confetti />}
      <div className="flex flex-col items-center">
        <div className="relative">
          {/* pointer */}
          <div className="absolute -top-1 left-1/2 z-10 -translate-x-1/2">
            <div className="h-0 w-0 border-x-[10px] border-t-[18px] border-x-transparent border-t-white drop-shadow" />
          </div>
          <canvas
            ref={canvasRef}
            width={320}
            height={320}
            className="max-h-[300px] max-w-[300px] drop-shadow-2xl"
          />
        </div>

        {landed ? (
          <div className="mt-4 w-full animate-pop-in">
            <div className="rounded-2xl bg-gradient-to-br from-violet-500/30 to-fuchsia-500/20 p-4 ring-1 ring-violet-400/40">
              <div className="text-center text-xs font-bold uppercase tracking-widest text-fuchsia-300">
                The wheel chose… 🎲
              </div>
              <div className="mt-1 text-center font-display text-xl font-extrabold">{landed.title}</div>
              <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                <span className="chip bg-fuchsia-500/20 text-fuchsia-300">+{landed.points} pts</span>
                <span className="chip bg-white/10 text-white/70">{landed.category}</span>
                <span className={`chip ${difficultyStyle(landed.difficulty).cls}`}>
                  {difficultyStyle(landed.difficulty).label}
                </span>
                <span className="chip bg-white/10 text-white/70">{proofLabel(landed.proof_type)}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button className="btn-ghost !py-2.5" onClick={spin} disabled={!canSpin}>
                  Spin again
                </button>
                <button
                  className="btn-primary !py-2.5"
                  disabled={!!landed.my_status || startQuest.isPending}
                  onClick={() => startQuest.mutate(landed.id)}
                >
                  {landed.my_status ? "Already taken" : "⚔️ Start this quest"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button className="btn-primary mt-5 w-full !py-3.5 !text-base" onClick={spin} disabled={!canSpin}>
            {quests.length === 0 ? "No quests to spin" : spinning ? "Spinning…" : "Spin it! 🎲"}
          </button>
        )}

        <p className="mt-3 text-center text-xs text-white/40">
          Spin to discover a random quest from your current filter — fate decides the challenge.
        </p>
      </div>
    </Modal>
  );
}
