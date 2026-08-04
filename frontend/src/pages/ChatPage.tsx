import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { ChatMessage } from "../types";
import { useAuth } from "../store/auth";
import { Avatar, EmptyState, PageLoader } from "../components/ui";
import { markChatSeen } from "../components/NavBar";
import { sfx } from "../lib/sound";
import { timeAgo } from "../lib/format";

export function ChatPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages, isLoading } = useQuery<ChatMessage[]>({
    queryKey: ["chat"],
    queryFn: () => api.get("/chat?limit=100"),
    refetchInterval: 3000,
  });

  // Auto-scroll to the newest message.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // While viewing chat, everything we've fetched counts as seen.
  useEffect(() => {
    if (messages && messages.length > 0) {
      markChatSeen(messages[messages.length - 1].id);
    }
  }, [messages]);

  const send = useMutation({
    mutationFn: async (msg: string) => {
      const created = await api.post<ChatMessage>("/chat", { text: msg });
      qc.setQueryData<ChatMessage[]>(["chat"], (old = []) => [...old, created]);
      return created;
    },
    onSuccess: () => {
      sfx.whoosh();
      setText("");
    },
    onError: (err: any) => {
      sfx.error();
      console.error(err);
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || send.isPending) return;
    send.mutate(t);
  }

  if (isLoading || !messages) return <PageLoader />;

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col">
      <header className="mb-3">
        <h1 className="font-display text-2xl font-extrabold">💬 Squad chat</h1>
        <p className="text-sm text-white/50">Hype, roast, and plan together.</p>
      </header>

      <div className="card flex-1 space-y-3 overflow-y-auto !p-3">
        {messages.length === 0 ? (
          <EmptyState icon="💬" title="No messages yet" subtitle="Say hi to the squad!" />
        ) : (
          <>
            {messages.map((m) => {
              const mine = m.user_id === user?.id;
              return (
                <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                  {!mine && <Avatar emoji={m.user_avatar} size="sm" />}
                  <div className={`max-w-[80%] ${mine ? "text-right" : ""}`}>
                    <div className={`mb-0.5 text-[10px] font-bold ${mine ? "text-fuchsia-300/70" : "text-white/35"}`}>
                      {mine ? "you" : m.user_name} · {timeAgo(m.created_at)}
                    </div>
                    <div
                      className={`inline-block rounded-2xl px-3 py-2 text-sm ${
                        mine
                          ? "rounded-br-sm bg-gradient-to-r from-violet-500 to-fuchsia-500"
                          : "rounded-bl-sm bg-white/8"
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      <form onSubmit={submit} className="mt-3 flex gap-2">
        <input
          className="input flex-1"
          placeholder="Message the squad…"
          value={text}
          maxLength={2000}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="btn-primary shrink-0" disabled={!text.trim() || send.isPending}>
          Send ➤
        </button>
      </form>
    </div>
  );
}
