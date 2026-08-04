import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { Modal } from "./modal";
import { proofLabel } from "../lib/format";
import { sfx } from "../lib/sound";

export function SubmitProofModal({
  open,
  onClose,
  submissionId,
  questTitle,
  proofType,
}: {
  open: boolean;
  onClose: () => void;
  submissionId: number;
  questTitle: string;
  proofType: string;
}) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");

  const needsFile = proofType === "photo" || proofType === "video";

  function pickFile(f: File | null) {
    setFile(f);
    if (f) {
      const url = URL.createObjectURL(f);
      setPreview(url);
    } else {
      setPreview(null);
    }
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      if (text.trim()) form.append("proof_text", text.trim());
      if (file) form.append("file", file);
      return api.postForm(`/submissions/${submissionId}/submit`, form);
    },
    onSuccess: () => {
      sfx.success();
      qc.invalidateQueries();
      onClose();
      setText("");
      setFile(null);
      setPreview(null);
    },
    onError: (err: any) => {
      sfx.error();
      setError(err.message || "Upload failed");
    },
  });

  const valid = text.trim() || (needsFile && file);

  return (
    <Modal open={open} onClose={onClose} title={`Submit proof · ${questTitle}`}>
      <div className="space-y-3">
        <div className="rounded-xl bg-white/5 px-3 py-2 text-xs text-white/50">
          Proof type: <b className="text-white/80">{proofLabel(proofType)}</b>. Make it convincing — the squad votes on it.
        </div>

        {needsFile && (
          <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-white/15 bg-white/5 py-8 text-center transition hover:border-violet-400/50">
            {preview ? (
              <img src={preview} alt="preview" className="max-h-48 rounded-xl object-cover" />
            ) : (
              <>
                <span className="text-4xl">{proofType === "video" ? "🎬" : "📷"}</span>
                <span className="mt-1 text-sm font-bold text-white/60">
                  {proofType === "video" ? "Tap to upload a video" : "Tap to upload a photo"}
                </span>
              </>
            )}
            <input type="file" className="hidden" accept={proofType === "video" ? "video/*" : "image/*"} onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
            {preview && <span className="text-xs font-bold text-white/40">Tap to change</span>}
          </label>
        )}

        <textarea
          className="input min-h-24 resize-none"
          placeholder="Describe what you did…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        {error && <div className="rounded-lg bg-rose-500/15 px-3 py-2 text-xs font-bold text-rose-300">{error}</div>}

        <button
          className="btn-primary w-full"
          disabled={!valid || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "Submitting…" : "Send for voting 🗳️"}
        </button>
      </div>
    </Modal>
  );
}
