import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./store/auth";
import { PageLoader } from "./components/ui";
import { AppShell } from "./components/NavBar";
import { AuthPage } from "./pages/AuthPage";
import { DashboardPage } from "./pages/DashboardPage";
import { QuestsPage } from "./pages/QuestsPage";
import { ChatPage } from "./pages/ChatPage";
import { RecapPage } from "./pages/RecapPage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { SquadPage } from "./pages/SquadPage";
import { ProfilePage } from "./pages/ProfilePage";
import { NotificationsPage } from "./pages/NotificationsPage";
import AdminPage from "./pages/AdminPage";

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loaded } = useAuth();
  if (!loaded) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return <AppShell>{children}</AppShell>;
}

function SquadRequired({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user?.squad_id) return <Navigate to="/squad" replace />;
  return <>{children}</>;
}

export default function App() {
  const { hydrate, user } = useAuth();

  useEffect(() => {
    const onUnauthorized = () => useAuth.getState().logout();
    window.addEventListener("sq:unauthorized", onUnauthorized);
    hydrate();
    return () => window.removeEventListener("sq:unauthorized", onUnauthorized);
  }, [hydrate]);

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <AuthPage />} />
      <Route
        path="/"
        element={
          <Protected>
            <SquadRequired>
              <DashboardPage />
            </SquadRequired>
          </Protected>
        }
      />
      <Route
        path="/quests"
        element={
          <Protected>
            <SquadRequired>
              <QuestsPage />
            </SquadRequired>
          </Protected>
        }
      />
      <Route
        path="/chat"
        element={
          <Protected>
            <SquadRequired>
              <ChatPage />
            </SquadRequired>
          </Protected>
        }
      />
      <Route
        path="/recap"
        element={
          <Protected>
            <SquadRequired>
              <RecapPage />
            </SquadRequired>
          </Protected>
        }
      />
      <Route
        path="/leaderboard"
        element={
          <Protected>
            <SquadRequired>
              <LeaderboardPage />
            </SquadRequired>
          </Protected>
        }
      />
      <Route
        path="/squad"
        element={
          <Protected>
            <SquadPage />
          </Protected>
        }
      />
      <Route
        path="/profile"
        element={
          <Protected>
            <ProfilePage />
          </Protected>
        }
      />
      <Route
        path="/notifications"
        element={
          <Protected>
            <SquadRequired>
              <NotificationsPage />
            </SquadRequired>
          </Protected>
        }
      />
      <Route
        path="/admin"
        element={
          <Protected>
            <AdminPage />
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
