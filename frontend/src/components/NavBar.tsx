import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../store/auth";
import { api } from "../api/client";
import type { ChatMessage } from "../types";

const SEEN_KEY = "sq_chat_seen";

export function chatLastSeen(): number {
  return Number(localStorage.getItem(SEEN_KEY) || "0");
}
export function markChatSeen(id: number) {
  if (id > chatLastSeen()) localStorage.setItem(SEEN_KEY, String(id));
}

const tabs = [
  { to: "/", label: "Home", icon: "🏠" },
  { to: "/quests", label: "Quests", icon: "🎯" },
  { to: "/recap", label: "Recap", icon: "🎬" },
  { to: "/chat", label: "Chat", icon: "💬" },
  { to: "/leaderboard", label: "Ranks", icon: "🏆" },
  { to: "/squad", label: "Squad", icon: "👥" },
  { to: "/profile", label: "You", icon: "🙋" },
];

function useChatUnread() {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user?.squad_id) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const msgs = await api.get<ChatMessage[]>("/chat?limit=20");
        if (cancelled) return;
        const lastSeen = chatLastSeen();
        const count = msgs.filter((m) => m.id > lastSeen && m.user_id !== user.id).length;
        setUnread(count);
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
  }, [user?.id, user?.squad_id]);

  return unread;
}

export function NavBar() {
  const unread = useChatUnread();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink/90 backdrop-blur-lg pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-md items-stretch justify-between px-1.5">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              `relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[9px] font-bold transition ${
                isActive ? "text-fuchsia-300" : "text-white/40 hover:text-white/70"
              }`
            }
          >
            <span className="text-lg leading-none">{t.icon}</span>
            {t.label}
            {t.to === "/chat" && unread > 0 && (
              <span className="absolute right-1/2 top-1 flex h-4 min-w-4 translate-x-3 items-center justify-center rounded-full bg-fuchsia-500 px-1 text-[9px] font-bold">
                {unread}
              </span>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <main className="mx-auto w-full max-w-md px-4 pb-28 pt-4">{children}</main>
      <NavBar />
    </div>
  );
}
