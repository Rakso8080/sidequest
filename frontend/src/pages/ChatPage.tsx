import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { ChatMessage, UserSearchResult } from "../types";
import { useAuth } from "../store/auth";
import { Avatar, EmptyState, PageLoader } from "../components/ui";
import { markChatSeen } from "../components/NavBar";
import { sfx } from "../lib/sound";
import { timeAgo } from "../lib/format";
import { useI18n } from "../lib/i18n";

const STICKERS = [
  "🔥", "💀", "🥵", "🤡", "😭", "😂", "🥳", "💪", "🍕", "⚡",
  "😈", "🫡", "🤝", "🦈", "🫠", "🤯", "😤", "🙏", "🚀", "🎯",
  "😎", "🤌", "🫡", "💯",
];

function ChatHeader({ onNewChat }: { onNewChat: () => void }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/30 to-fuchsia-500/20 text-xl ring-1 ring-white/15">
        💬
      </div>
      <div className="flex-1">
        <div className="font-display text-lg font-extrabold leading-tight">{t("chat.squadChat")}</div>
        <div className="text-xs text-white/40">{t("chat.direct")}</div>
      </div>
      <button
        onClick={onNewChat}
        className="btn-primary !rounded-full !px-4 !py-2 !text-xs"
        title={t("chat.new")}
      >
        ✏️ {t("chat.new")}
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
      className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${
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
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [withUserId, setWithUserId] = useState<number | null>(null);
  const [withUser, setWithUser] = useState<UserSearchResult | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
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
  }, [messages, showStickers]);

  useEffect(() => {
    if (messages && messages.length > 0 && !withUserId) {
      markChatSeen(messages[messages.length - 1].id);
    }
  }, [messages, withUserId]);

  const send = useMutation({
    mutationFn: async (msg: { text?: string; sticker?: string }) => {
      const created = await api.post<ChatMessage>("/chat", {
        ...msg,
        recipient_id: withUserId,
      });
      qc.setQueryData<ChatMessage[]>(["chat", withUserId], (old = []) => [...old, created]);
      return created;
    },
    onSuccess: () => {
      sfx.whoosh();
      setText("");
      setShowStickers(false);
    },
    onError: (err: any) => {
      sfx.error();
      console.error(err);
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const msg = text.trim();
    if (!msg || send.isPending) return;
    send.mutate({ text: msg });
  }

  function openDm(c: UserSearchResult) {
    setWithUser(c);
    setWithUserId(c.id);
    setShowSearch(false);
    setQuery("");
  }

  if (isLoading || !messages) return <PageLoader />;

  const placeholder = withUserId
    ? t("chat.messageDm", { name: withUser?.display_name ?? "…" })
    : t("chat.messageSquad");

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col">
      <div className="mb-3">
        <ChatHeader onNewChat={() => setShowSearch(true)} />
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          <ChannelChip
            active={withUserId === null}
            label={t("nav.squad")}
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
            title={t("chat.noSquad")}
            subtitle={withUserId ? t("chat.sayHi") : t("chat.direct")}
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
                      <div className="mb-0.5 text-[10px] font-bold text-white/35">{m.user_name}</div>
                    )}
                    {m.sticker ? (
                      <div className={`text-5xl ${mine ? "" : ""}`}>{m.sticker}</div>
                    ) : (
                      <div
                        className={`inline-block rounded-2xl px-3 py-2 text-left text-sm leading-relaxed ${
                          mine
                            ? "rounded-br-sm bg-gradient-to-r from-violet-500 to-fuchsia-500 shadow-lg shadow-fuchsia-500/20"
                            : "rounded-bl-sm bg-white/10"
                        }`}
                      >
                        {m.text}
                      </div>
                    )}
                    <div className="mt-0.5 text-[9px] text-white/30">{timeAgo(m.created_at)}</div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {showStickers && (
        <div className="mt-2 grid grid-cols-8 gap-1 rounded-2xl bg-white/5 p-2">
          {STICKERS.map((s) => (
            <button
              key={s}
              onClick={() => send.mutate({ sticker: s })}
              disabled={send.isPending}
              className="rounded-xl py-1 text-3xl transition hover:bg-white/10 active:scale-90"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="mt-2 flex items-end gap-2">
        <button
          type="button"
          onClick={() => setShowStickers((v) => !v)}
          className={`shrink-0 rounded-full px-3 py-2.5 text-lg transition ${
            showStickers ? "bg-fuchsia-500/30" : "bg-white/5 hover:bg-white/10"
          }`}
          title={t("chat.stickers")}
        >
          😀
        </button>
        <input
          className="input flex-1 !rounded-full"
          placeholder={placeholder}
          value={text}
          maxLength={2000}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          type="submit"
          className="btn-primary shrink-0 !rounded-full !px-5"
          disabled={!text.trim() || send.isPending}
          aria-label={t("chat.send")}
        >
          ➤
        </button>
      </form>

      {showSearch && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowSearch(false)} />
          <div className="relative z-10 flex max-h-[80vh] w-full max-w-lg animate-slide-up flex-col rounded-t-3xl bg-panel p-5 sm:rounded-3xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">✉️ {t("chat.newMessage")}</h2>
              <button className="btn-ghost !px-2 !py-1 !text-xs" onClick={() => setShowSearch(false)}>
                {t("chat.close")}
              </button>
            </div>
            <input
              className="input w-full"
              placeholder={t("chat.searchPeople")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <div className="mt-3 flex-1 space-y-1 overflow-y-auto">
              {!contacts || contacts.length === 0 ? (
                <EmptyState icon="🔍" title={t("chat.noOneFound")} subtitle={t("chat.searchHint")} />
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
