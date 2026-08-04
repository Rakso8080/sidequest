import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../store/auth";

const tabs = [
  { to: "/", label: "Home", icon: "🏠" },
  { to: "/quests", label: "Quests", icon: "🎯" },
  { to: "/leaderboard", label: "Ranks", icon: "🏆" },
  { to: "/squad", label: "Squad", icon: "👥" },
  { to: "/profile", label: "You", icon: "🙋" },
];

export function NavBar() {
  const { user } = useAuth();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink/90 backdrop-blur-lg pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-md items-stretch justify-between px-2">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-bold transition ${
                isActive ? "text-fuchsia-300" : "text-white/40 hover:text-white/70"
              }`
            }
          >
            <span className="text-xl leading-none">{t.icon}</span>
            {t.label}
          </NavLink>
        ))}
      </div>
      {user && (
        <Link
          to="/profile"
          className="pointer-events-none absolute right-3 top-[-28px] opacity-0"
          aria-hidden
        />
      )}
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
