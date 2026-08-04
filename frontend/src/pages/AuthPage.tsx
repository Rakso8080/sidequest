import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../store/auth";
import { api } from "../api/client";
import type { TokenResponse } from "../types";
import { AVATARS } from "../lib/format";
import { LANGS, useI18n } from "../lib/i18n";

export function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const setAuth = useAuth((s) => s.setAuth);
  const navigate = useNavigate();
  const { t, lang, setLang } = useI18n();

  const [loginForm, setLoginForm] = useState({ username_or_email: "", password: "" });
  const [regForm, setRegForm] = useState({
    display_name: "",
    username: "",
    email: "",
    password: "",
    avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)],
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data =
        mode === "login"
          ? await api.post<TokenResponse>("/auth/login", loginForm)
          : await api.post<TokenResponse>("/auth/register", regForm);
      setAuth(data);
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 pb-10">
      <div className="absolute right-4 top-4 flex gap-1 rounded-full bg-white/5 p-1">
        {LANGS.map((l) => (
          <button
            key={l.code}
            onClick={() => setLang(l.code)}
            title={l.label}
            className={`rounded-full px-2 py-1 text-xs font-bold transition ${
              lang === l.code ? "bg-violet-500/40 text-white" : "text-white/50"
            }`}
          >
            {l.flag}
          </button>
        ))}
      </div>
      <div className="mb-8 text-center">
        <div className="text-6xl">🎮</div>
        <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight">
          Side<span className="text-fuchsia-400">Quest</span>
        </h1>
        <p className="mt-1 text-sm text-white/50">{t("auth.tagline")}</p>
      </div>

      <div className="card">
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-white/5 p-1">
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setError("");
              }}
              className={`rounded-lg py-2 text-sm font-bold transition ${
                mode === m ? "bg-violet-500 text-white" : "text-white/50"
              }`}
            >
              {m === "login" ? t("auth.login") : t("auth.join")}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === "register" && (
            <>
              <input
                className="input"
                placeholder={t("auth.displayName")}
                value={regForm.display_name}
                onChange={(e) => setRegForm({ ...regForm, display_name: e.target.value })}
                required
              />
              <input
                className="input"
                placeholder={t("auth.username")}
                value={regForm.username}
                onChange={(e) => setRegForm({ ...regForm, username: e.target.value })}
                required
                minLength={2}
              />
              <input
                className="input"
                placeholder={t("auth.email")}
                type="email"
                value={regForm.email}
                onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                required
              />
              <input
                className="input"
                placeholder={t("auth.passwordHint")}
                type="password"
                value={regForm.password}
                onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                required
                minLength={6}
              />
              <div>
                <div className="mb-1.5 text-xs font-bold text-white/50">{t("auth.pickAvatar")}</div>
                <div className="grid grid-cols-8 gap-1">
                  {AVATARS.map((a) => (
                    <button
                      type="button"
                      key={a}
                      onClick={() => setRegForm({ ...regForm, avatar: a })}
                      className={`rounded-lg py-1.5 text-lg transition ${
                        regForm.avatar === a ? "bg-violet-500/40 ring-1 ring-violet-300" : "bg-white/5"
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          {mode === "login" && (
            <>
              <input
                className="input"
                placeholder={t("auth.usernameOrEmail")}
                value={loginForm.username_or_email}
                onChange={(e) => setLoginForm({ ...loginForm, username_or_email: e.target.value })}
                required
              />
              <input
                className="input"
                placeholder={t("auth.password")}
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                required
              />
            </>
          )}

          {error && <div className="rounded-lg bg-rose-500/15 px-3 py-2 text-xs font-bold text-rose-300">{error}</div>}

          <button className="btn-primary w-full" disabled={busy}>
            {busy ? t("auth.working") : mode === "login" ? t("auth.login") : t("auth.createAccount")}
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-xs text-white/40">
        {t("auth.demoHint")} <b className="text-white/70">demo@sidequest.app</b> / <b className="text-white/70">demo123</b>
      </p>
      <div className="mt-4 text-center">
        <Link to="/admin" className="text-[11px] font-bold text-white/25 underline-offset-2 hover:text-white/60 hover:underline">
          🛠️ {t("admin.title")}
        </Link>
      </div>
    </div>
  );
}
