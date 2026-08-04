import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { ChatMessage, Gif, PresenceEntry, Squad, UserSearchResult } from "../types";
import { useAuth } from "../store/auth";
import { Avatar, EmptyState, PageLoader, Spinner } from "../components/ui";
import { markChatSeen } from "../components/NavBar";
import { sfx } from "../lib/sound";
import { useI18n } from "../lib/i18n";

const STICKERS = [
  "🔥", "💀", "🥵", "🤡", "😭", "😂", "🥳", "💪", "🍕", "⚡",
  "😈", "🫡", "🤝", "🦈", "🫠", "🤯", "😤", "🙏", "🚀", "🎯",
  "😎", "🤌", "🫡", "💯",
];

const REACTION_EMOJIS = ["👍", "😂", "🔥", "❤️", "😮", "😢", "🙏", "💯"];

function timeHM(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function ChatHeader({
  onlineCount,
  onNewChat,
}: {
  onlineCount: number;
  onNewChat: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/30 to-fuchsia-500/20 text-xl ring-1 ring-white/15">
        💬
        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-panel bg-emerald-400" />
      </div>
      <div className="flex-1">
        <div className="font-display text-lg font-extrabold leading-tight">{t("chat.squadChat")}</div>
        <div className="text-xs text-emerald-300/80">
          {onlineCount > 0 ? `${onlineCount} ${t("chat.online")}` : t("chat.direct")}
        </div>
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
  online,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: string;
  online?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${
        active ? "bg-fuchsia-500/30 text-fuchsia-100 ring-1 ring-fuchsia-400/40" : "bg-white/5 text-white/50 hover:bg-white/10"
      }`}
    >
      {online ? <span className="h-2 w-2 rounded-full bg-emerald-400" /> : <span>{icon}</span>}
      {label}
    </button>
  );
}

function ReplyQuote({ msg }: { msg: ChatMessage }) {
  if (!msg.reply_snippet) return null;
  return (
    <div className="mb-1 flex items-center gap-1.5 rounded-lg border-l-2 border-fuchsia-400/60 bg-black/20 px-2 py-1">
      <span className="text-[10px] font-bold text-fuchsia-300">{msg.reply_user_name ?? "…"}</span>
      <span className="truncate text-[11px] text-white/50">{msg.reply_snippet}</span>
    </div>
  );
}

function Reactions({ msg, onReact }: { msg: ChatMessage; onReact: (e: string) => void }) {
  if (msg.reactions.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {msg.reactions.map((r) => (
        <button
          key={r.emoji}
          onClick={(ev) => {
            ev.stopPropagation();
            onReact(r.emoji);
          }}
          className={`rounded-full px-1.5 py-0.5 text-[11px] transition ${
            r.mine ? "bg-fuchsia-500/40 text-fuchsia-100 ring-1 ring-fuchsia-400/50" : "bg-white/10 text-white/70 hover:bg-white/20"
          }`}
        >
          {r.emoji} {r.count}
        </button>
      ))}
    </div>
  );
}

function MessageBubble({
  msg,
  mine,
  showAvatar,
  online,
  allRead,
  isAdmin,
  onReply,
  onEdit,
  onDelete,
  onReact,
  onPin,
  onOpenProfile,
}: {
  msg: ChatMessage;
  mine: boolean;
  showAvatar: boolean;
  online: boolean;
  allRead: boolean;
  isAdmin: boolean;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onReact: (e: string) => void;
  onPin: () => void;
  onOpenProfile: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const [reactionPicker, setReactionPicker] = useState(false);

  return (
    <div className={`group flex items-end gap-1.5 ${mine ? "flex-row-reverse" : ""}`}>
      <div className={`w-7 shrink-0 ${showAvatar ? "" : "pointer-events-none opacity-0"}`}>
        {showAvatar && (
          <button onClick={onOpenProfile} title={msg.user_name}>
            <Avatar emoji={msg.user_avatar} file={msg.user_avatar_file} size="xs" />
          </button>
        )}
      </div>

      <div className={`max-w-[80%] ${mine ? "items-end text-right" : "items-start text-left"} flex flex-col`}>
        {showAvatar && !mine && (
          <button
            onClick={onOpenProfile}
            className="mb-0.5 flex items-center gap-1 text-[11px] font-bold text-white/40 hover:text-fuchsia-300"
          >
            {msg.user_name}
            {online && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
            {msg.pinned && <span title="Pinned">📌</span>}
          </button>
        )}

        <div
          className="relative"
          onClick={() => setMenu(false)}
          onContextMenu={(e) => {
            e.preventDefault();
            setMenu((v) => !v);
            setReactionPicker(false);
          }}
        >
          {msg.reply_to_id && <ReplyQuote msg={msg} />}
          {msg.sticker && <div className="px-1 py-1 text-6xl">{msg.sticker}</div>}
          {msg.gif_url && (
            <img
              src={msg.gif_url}
              alt="gif"
              loading="lazy"
              className="w-56 max-w-full rounded-2xl"
            />
          )}
          {!msg.sticker && !msg.gif_url && (
            <div
              className={`inline-block rounded-2xl px-3 py-2 text-left text-sm leading-relaxed ${
                mine
                  ? "rounded-br-sm bg-gradient-to-r from-violet-600 to-fuchsia-600 shadow-lg shadow-fuchsia-500/20"
                  : "rounded-bl-sm bg-white/10"
              }`}
            >
              {msg.text}
              {msg.edited && <span className="ml-1 text-[9px] text-white/40">edited</span>}
            </div>
          )}

          <div className={`mt-0.5 flex items-center gap-1 text-[9px] text-white/35 ${mine ? "justify-end" : ""}`}>
            {timeHM(msg.created_at)}
            {mine && (
              <span className={allRead ? "text-sky-400" : "text-white/40"}>
                {allRead ? "✓✓" : "✓"}
              </span>
            )}
          </div>

          <Reactions msg={msg} onReact={onReact} />

          {menu && (
            <div
              className={`absolute bottom-full ${mine ? "right-0" : "left-0"} z-30 mb-1 w-40 overflow-hidden rounded-xl border border-white/10 bg-panel shadow-xl`}
            >
              {[
                { icon: "↩️", label: "Reply", fn: onReply },
                ...(mine ? [{ icon: "✏️", label: "Edit", fn: onEdit }] : []),
                ...(mine || isAdmin ? [{ icon: "🗑️", label: "Delete", fn: onDelete }] : []),
                ...(isAdmin ? [{ icon: msg.pinned ? "📌 Remove pin" : "📌 Pin", label: msg.pinned ? "Remove pin" : "Pin", fn: onPin }] : []),
              ].map((it) => (
                <button
                  key={it.label}
                  onClick={() => {
                    it.fn();
                    setMenu(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-bold hover:bg-white/10"
                >
                  <span>{it.icon}</span>
                  {it.label}
                </button>
              ))}
            </div>
          )}

          {reactionPicker && (
            <div
              className={`absolute bottom-full ${mine ? "right-0" : "left-0"} z-30 mb-1 flex gap-0.5 rounded-full border border-white/10 bg-panel px-1 py-1 shadow-xl`}
            >
              {REACTION_EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => {
                    onReact(e);
                    setReactionPicker(false);
                  }}
                  className="rounded-full px-1 text-lg transition hover:bg-white/10"
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
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
  const [showGifs, setShowGifs] = useState(false);
  const [query, setQuery] = useState("");
  const [gifQuery, setGifQuery] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [editingText, setEditingText] = useState("");
  const [presence, setPresence] = useState<PresenceEntry[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages, isLoading } = useQuery<ChatMessage[]>({
    queryKey: ["chat", withUserId],
    queryFn: () => api.get(`/chat?limit=100${withUserId ? `&with_user=${withUserId}` : ""}`),
    refetchInterval: 2500,
  });

  const { data: squad } = useQuery<Squad>({
    queryKey: ["squad"],
    queryFn: () => api.get("/squads/me"),
    staleTime: 30000,
  });

  const { data: contacts } = useQuery<UserSearchResult[]>({
    queryKey: ["user-search", query],
    queryFn: () => api.get(`/users/search?q=${encodeURIComponent(query)}`),
    enabled: showSearch,
  });

  const { data: gifs } = useQuery<Gif[]>({
    queryKey: ["gifs", gifQuery],
    queryFn: () => api.get(`/chat/gifs?q=${encodeURIComponent(gifQuery)}`),
    enabled: showGifs,
    staleTime: 30000,
  });

  useEffect(() => {
    if (!withUserId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const p = await api.get<PresenceEntry[]>("/chat/presence");
        if (!cancelled) setPresence(p);
      } catch {
        /* ignore */
      }
    };
    poll();
    const id = window.setInterval(poll, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [withUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, showStickers, showGifs, replyTo]);

  useEffect(() => {
    if (messages && messages.length > 0) {
      const last = messages[messages.length - 1].id;
      markChatSeen(last);
      api.post(`/chat/read?last_read_id=${last}`).catch(() => {});
    }
  }, [messages]);

  const send = useMutation({
    mutationFn: async (msg: { text?: string; sticker?: string; gif_url?: string; gif_thumb?: string; reply_to_id?: number }) => {
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
      setShowGifs(false);
      setReplyTo(null);
    },
    onError: (err: any) => {
      sfx.error();
      console.error(err);
    },
  });

  const editMsg = useMutation({
    mutationFn: async (m: ChatMessage) => {
      const updated = await api.patch<ChatMessage>(`/chat/${m.id}`, { text: editingText });
      qc.setQueryData<ChatMessage[]>(["chat", withUserId], (old = []) =>
        old.map((x) => (x.id === m.id ? updated : x)),
      );
      return updated;
    },
    onSuccess: () => {
      setEditing(null);
      setEditingText("");
      sfx.whoosh();
    },
  });

  const deleteMsg = useMutation({
    mutationFn: async (m: ChatMessage) => {
      await api.del(`/chat/${m.id}`);
      qc.setQueryData<ChatMessage[]>(["chat", withUserId], (old = []) => old.filter((x) => x.id !== m.id));
    },
    onSuccess: () => sfx.whoosh(),
  });

  const react = useMutation({
    mutationFn: async ({ msg, emoji }: { msg: ChatMessage; emoji: string }) => {
      const updated = await api.post<ChatMessage>(`/chat/${msg.id}/react`, { emoji });
      qc.setQueryData<ChatMessage[]>(["chat", withUserId], (old = []) =>
        old.map((x) => (x.id === msg.id ? updated : x)),
      );
    },
  });

  const pin = useMutation({
    mutationFn: async (m: ChatMessage) => {
      const updated = await api.post<ChatMessage>(`/chat/${m.id}/pin`);
      qc.setQueryData<ChatMessage[]>(["chat", withUserId], (old = []) =>
        old.map((x) => (x.id === m.id ? updated : x)),
      );
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const msg = text.trim();
    if (!msg || send.isPending) return;
    send.mutate({ text: msg, reply_to_id: replyTo?.id });
  }

  function openDm(c: UserSearchResult) {
    setWithUser(c);
    setWithUserId(c.id);
    setShowSearch(false);
    setQuery("");
    setReplyTo(null);
  }

  const isAdmin = !!user && squad?.admin_id === user.id;

  const ownId = user?.id;
  const onlineCount = presence.filter((p) => p.online).length;
  const readIds = useMemo(() => new Map(presence.map((p) => [p.user_id, p.last_read_id])), [presence]);

  function allReadFor(msg: ChatMessage) {
    if (!withUserId) {
      return presence.filter((p) => p.user_id !== msg.user_id).every((p) => p.last_read_id >= msg.id);
    }
    const other = withUserId;
    return (readIds.get(other) ?? 0) >= msg.id;
  }

  if (isLoading || !messages) return <PageLoader />;

  const placeholder = withUserId
    ? t("chat.messageDm", { name: withUser?.display_name ?? "…" })
    : t("chat.messageSquad");

  // Group consecutive messages from the same sender.
  const grouped = messages.map((m, i) => {
    const prev = messages[i - 1];
    const sameSender = prev && prev.user_id === m.user_id && !prev.recipient_id && !m.recipient_id;
    const close = prev && new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60000;
    const showAvatar = !sameSender || !close;
    return { m, showAvatar };
  });

  // Date separators.
  const rows: (JSX.Element | null)[] = [];
  let lastDay = "";
  grouped.forEach(({ m, showAvatar }) => {
    const day = dayLabel(m.created_at);
    if (day !== lastDay) {
      lastDay = day;
      rows.push(
        <div key={`day-${m.id}`} className="my-2 text-center">
          <span className="rounded-full bg-white/5 px-3 py-0.5 text-[10px] font-bold text-white/40">{day}</span>
        </div>,
      );
    }
    rows.push(
      <MessageBubble
        key={m.id}
        msg={m}
        mine={m.user_id === ownId}
        showAvatar={showAvatar}
        online={presence.some((p) => p.user_id === m.user_id && p.online)}
        allRead={allReadFor(m)}
        isAdmin={isAdmin}
        onReply={() => {
          setReplyTo(m);
          setEditing(null);
        }}
        onEdit={() => {
          setEditing(m);
          setEditingText(m.text ?? "");
        }}
        onDelete={() => deleteMsg.mutate(m)}
        onReact={(emoji) => react.mutate({ msg: m, emoji })}
        onPin={() => pin.mutate(m)}
        onOpenProfile={() => setWithUserId(m.user_id)}
      />,
    );
  });

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col">
      <div className="mb-3">
        <ChatHeader onlineCount={onlineCount} onNewChat={() => setShowSearch(true)} />
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          <ChannelChip
            active={withUserId === null}
            label={t("nav.squad")}
            icon="👥"
            online
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
                online={presence.some((p) => p.user_id === c.id && p.online)}
                onClick={() => openDm(c)}
              />
            ))}
        </div>
      </div>

      <div className="card flex-1 space-y-1 overflow-y-auto !p-3">
        {messages.length === 0 ? (
          <EmptyState
            icon="💬"
            title={t("chat.noSquad")}
            subtitle={withUserId ? t("chat.sayHi") : t("chat.direct")}
          />
        ) : (
          <>{rows}</>
        )}
        <div ref={bottomRef} />
      </div>

      {replyTo && (
        <div className="mt-2 flex items-center gap-2 rounded-t-2xl border border-b-0 border-white/10 bg-panel px-3 py-1.5">
          <span className="text-[10px] font-bold text-fuchsia-300">↩️ {replyTo.user_name}</span>
          <span className="truncate text-xs text-white/50">
            {replyTo.sticker ? "Sticker" : replyTo.gif_url ? "GIF" : replyTo.text}
          </span>
          <button className="ml-auto text-white/40" onClick={() => setReplyTo(null)}>✕</button>
        </div>
      )}

      {editing && (
        <div className="mt-2 flex items-center gap-2 rounded-t-2xl border border-b-0 border-white/10 bg-panel px-3 py-1.5">
          <span className="text-[10px] font-bold text-amber-300">✏️ Editing</span>
          <input
            className="input flex-1 !py-1 text-xs"
            value={editingText}
            autoFocus
            onChange={(e) => setEditingText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") editMsg.mutate(editing);
              if (e.key === "Escape") setEditing(null);
            }}
          />
          <button className="text-xs font-bold text-emerald-300" onClick={() => editMsg.mutate(editing)}>Save</button>
          <button className="text-xs text-white/40" onClick={() => setEditing(null)}>✕</button>
        </div>
      )}

      {showGifs && (
        <div className="mt-2 rounded-2xl bg-white/5 p-2">
          <input
            className="input mb-2 !py-1.5 text-xs"
            placeholder="Search GIFs…"
            value={gifQuery}
            onChange={(e) => setGifQuery(e.target.value)}
            autoFocus
          />
          <div className="grid max-h-44 grid-cols-3 gap-1 overflow-y-auto">
            {!gifs || gifs.length === 0 ? (
              <div className="col-span-3 py-4 text-center text-xs text-white/40">
                {gifQuery ? "No results — try another word" : "Type to search Giphy"}
              </div>
            ) : (
              gifs.map((g) => (
                <button
                  key={g.url}
                  onClick={() => send.mutate({ gif_url: g.url, gif_thumb: g.thumb, reply_to_id: replyTo?.id })}
                  className="overflow-hidden rounded-lg transition active:scale-95"
                >
                  <img src={g.thumb} alt="gif preview" loading="lazy" className="h-20 w-full object-cover" />
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {showStickers && (
        <div className="mt-2 grid grid-cols-8 gap-1 rounded-2xl bg-white/5 p-2">
          {STICKERS.map((s) => (
            <button
              key={s}
              onClick={() => send.mutate({ sticker: s, reply_to_id: replyTo?.id })}
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
          onClick={() => {
            setShowStickers((v) => !v);
            setShowGifs(false);
          }}
          className={`shrink-0 rounded-full px-3 py-2.5 text-lg transition ${
            showStickers ? "bg-fuchsia-500/30" : "bg-white/5 hover:bg-white/10"
          }`}
          title={t("chat.stickers")}
        >
          😀
        </button>
        <button
          type="button"
          onClick={() => {
            setShowGifs((v) => !v);
            setShowStickers(false);
          }}
          className={`shrink-0 rounded-full px-3 py-2.5 text-lg transition ${
            showGifs ? "bg-fuchsia-500/30" : "bg-white/5 hover:bg-white/10"
          }`}
          title="GIFs"
        >
          🎬
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
          disabled={(!text.trim() && !replyTo) || send.isPending}
          aria-label={t("chat.send")}
        >
          {send.isPending ? <Spinner size="sm" /> : "➤"}
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
