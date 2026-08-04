import { useEffect, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../store/auth";
import { PageLoader } from "../components/ui";
import { AuthPage } from "./AuthPage";

export function InvitePage() {
  const [params] = useSearchParams();
  const code = (params.get("code") || "").trim().toUpperCase();
  const user = useAuth((s) => s.user);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!user || user.squad_id || !code) return;
    let cancelled = false;
    api
      .post("/squads/join", { invite_code: code })
      .then(async () => {
        if (cancelled) return;
        await useAuth.getState().hydrate();
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user, code]);

  if (user && user.squad_id) return <Navigate to="/" replace />;

  if (user && code) {
    if (!failed) return <PageLoader />;
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 pb-10">
        <div className="card space-y-4 text-center">
          <div className="text-4xl">😕</div>
          <p className="text-sm text-white/60">Couldn't join with that invite code. It may be wrong or expired.</p>
          <AuthPage inviteCode={code} />
        </div>
      </div>
    );
  }

  return <AuthPage inviteCode={code} defaultMode="register" />;
}
