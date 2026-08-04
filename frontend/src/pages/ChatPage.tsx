import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { ChatMessage, UserSearchResult } from "../types";
import { useAuth } from "../store/auth";
import { Avatar, EmptyState, PageLoader } from "../components/ui";
import { markChatSeen } from "../components/NavBar";
import { sfx } from "../lib/sound";
import { timeAgo } from "../lib/format";

function ChatHeader({ onNewChat }: { onNewChat: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/30 to-fuchsia-500/20 text-xl ring-1 ring-white/15">
        💬
      </div>
      <div className="flex-1">
        <div className="font-display text-lg font-extrabold leading-tight">Messages</div>
        <div className="text-xs text-white/40">Squad chat + direct messages</div>
      </div>
      <button
        onClick={onNewChat}
        className="btn-primary !rounded-full !px-4 !py-2 !text-xs"
        title="New message"
      >
        ✏️ New
      </button>
    </div>
  );
}

function ChannelChip({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${
        active ? "bg-fuchsia-500/30 text-fuchsia-100 ring-1 ring-fuchsia-400/40" : "bg-white/5 text-white/50 hover:bg-white/10"
      }`}
    >
      <span>{icon}</span>
      {label}
    </button>
  );
}

export function ChatPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [withUserId, setWithUserId] = useState<number | null>(null);
  const [withUser, setWithUser] = useState<UserSearchResult | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages, isLoading } = useQuery<ChatMessage[]>({
    queryKey: ["chat", withUserId],
    queryFn: () => api.get(`/chat?limit=100${withUserId ? `&with_user=${withUserId}` : ""}`),
    refetchInterval: 3000,
  });

  const { data: contacts } = useQuery<UserSearchResult[]>({
    queryKey: ["user-search", query],
    queryFn: () => api.get(`/users/search?q=${encodeURIComponent(query)}`),
    enabled: showSearch,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (messages && messages.length > 0 && !withUserId) {
      markChatSeen(messages[messages.length - 1].id);
    }
  }, [messages, withUserId]);

  const send = useMutation({
    mutationFn: async (msg: string) => {
      const created = await api.post<ChatMessage>("/chat", { text: msg, recipient_id: withUserId });
      qc.setQueryData<ChatMessage[]>(["chat", withUserId], (old = []) => [...old, created]);
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

  function openDm(c: UserSearchResult) {
    setWithUser(c);
    setWithUserId(c.id);
    setShowSearch(false);
    setQuery("");
  }

  if (isLoading || !messages) return <PageLoader />;

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col">
      <div className="mb-3">
        <ChatHeader onNewChat={() => setShowSearch(true)} />
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          <ChannelChip
            active={withUserId === null}
            label="Squad"
            icon="👥"
            onClick={() => {
              setWithUserId(null);
              setWithUser(null);
            }}
          />
          {contacts
            ?.slice(0, 12)
            .map((c) => (
              <ChannelChip
                key={c.id}
                active={withUserId === c.id}
                label={c.display_name}
                icon={c.avatar_file ? "🖼️" : c.avatar}
                onClick={() => openDm(c)}
              />
            ))}
        </div>
      </div>

      <div className="card flex-1 overflow-y-auto !p-3">
        {messages.length === 0 ? (
          <EmptyState
            icon="💬"
            title={withUserId ? "No messages yet" : "No messages yet"}
            subtitle={withUserId ? "Say hi 👋" : "Hype, roast, and plan together."}
          />
        ) : (
          <>
            {messages.map((m) => {
              const mine = m.user_id === user?.id;
              return (
                <div key={m.id} className={`mb-2 flex items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                  {!mine && <Avatar emoji={m.user_avatar} file={m.user_avatar_file} size="sm" />}
                  <div className={`max-w-[75%] ${mine ? "text-right" : ""}`}>
                    {!mine && (
                      <div className="mb-0.5 text-[10px] font-bold text-white/35">
                        {withUserId ? m.user_name : m.user_name}
                      </div>
                    )}
                    <div
                      className={`inline-block rounded-2xl px-3 py-2 text-left text-sm leading-relaxed ${
                        mine
                          ? "rounded-br-sm bg-gradient-to-r from-violet-500 to-fuchsia-500 shadow-lg shadow-fuchsia-500/20"
                          : "rounded-bl-sm bg-white/10"
                      }`}
                    >
                      {m.text}
                    </div>
                    <div className={`mt-0.5 text-[9px] text-white/30 ${mine ? "" : ""}`}>{timeAgo(m.created_at)}</div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      <form onSubmit={submit} className="mt-3 flex items-end gap-2">
        <input
          className="input flex-1 !rounded-full"
          placeholder={`Message ${withUserId ? (withUser?.display_name ?? "…") : "the squad"}…`}
          value={text}
          maxLength={2000}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          type="submit"
          className="btn-primary shrink-0 !rounded-full !px-5"
          disabled={!text.trim() || send.isPending}
          aria-label="Send"
        >
          ➤
        </button>
      </form>

      {showSearch && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowSearch(false)} />
          <div className="relative z-10 flex max-h-[80vh] w-full max-w-lg animate-slide-up flex-col rounded-t-3xl bg-panel p-5 sm:rounded-3xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">✉️ New message</h2>
              <button className="btn-ghost !px-2 !py-1 !text-xs" onClick={() => setShowSearch(false)}>
                Close
              </button>
            </div>
            <input
              className="input w-full"
              placeholder="Search people…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <div className="mt-3 flex-1 space-y-1 overflow-y-auto">
              {!contacts || contacts.length === 0 ? (
                <EmptyState icon="🔍" title="No one found" subtitle="Search by name or username." />
              ) : (
                contacts.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => openDm(c)}
                    className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition hover:bg-white/5"
                  >
                    <Avatar emoji={c.avatar} file={c.avatar_file} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold">{c.display_name}</div>
                      <div className="truncate text-xs text-white/40">
                        @{c.username}
                        {c.squad_name ? ` · ${c.squad_name}` : ""}
                      </div>
                    </div>
                    <span className="text-white/30">💬</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
