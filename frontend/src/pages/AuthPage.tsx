import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../store/auth";
import { api } from "../api/client";
import type { TokenResponse } from "../types";
import { AVATARS } from "../lib/format";
import { LANGS, useI18n } from "../lib/i18n";

type Mode = "login" | "register";
type ResetStep = "request" | "verify";

export function AuthPage({
  inviteCode,
  defaultMode = "login",
}: {
  inviteCode?: string | null;
  defaultMode?: Mode;
}) {
  const [mode, setMode] = useState<Mode>(defaultMode);
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
    phone: "",
    avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)],
    invite_code: inviteCode || "",
  });

  // Password reset flow
  const [showReset, setShowReset] = useState(false);
  const [resetStep, setResetStep] = useState<ResetStep>("request");
  const [resetIdentifier, setResetIdentifier] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetInfo, setResetInfo] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);

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

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setResetInfo("");
    setBusy(true);
    try {
      const res = await api.post<{ ok: boolean; delivery: string; debug_code: string | null }>(
        "/auth/forgot",
        { identifier: resetIdentifier },
      );
      if (res.debug_code) {
        setResetInfo(`Dev mode: your code is ${res.debug_code}`);
      } else if (res.delivery === "sms") {
        setResetInfo("Code sent by SMS 📱");
      } else if (res.delivery === "email") {
        setResetInfo("Code sent to your email 📧");
      } else {
        setResetInfo("If that account exists, a code has been sent.");
      }
      setResetStep("verify");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function submitReset(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.post("/auth/reset", {
        identifier: resetIdentifier,
        code: resetCode,
        new_password: resetNewPassword,
      });
      setResetSuccess(true);
      setLoginForm({ ...loginForm, username_or_email: resetIdentifier });
      setMode("login");
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

      {inviteCode && mode === "register" && (
        <div className="mb-4 rounded-xl border border-fuchsia-400/30 bg-fuchsia-500/10 px-4 py-2.5 text-center text-xs font-bold text-fuchsia-200">
          🎉 {t("auth.youWereInvited")} <span className="tracking-widest">{inviteCode}</span>
        </div>
      )}

      <div className="card">
        {showReset ? (
          <div className="space-y-4">
            <div>
              <h2 className="font-display text-lg font-extrabold">🔑 {t("auth.forgotPassword")}</h2>
              <p className="text-xs text-white/50">{t("auth.forgotHint")}</p>
            </div>

            {resetSuccess ? (
              <div className="space-y-3">
                <div className="rounded-xl bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-300">
                  ✅ {t("auth.resetDone")}
                </div>
                <button className="btn-primary w-full" onClick={() => setShowReset(false)}>
                  {t("auth.login")}
                </button>
              </div>
            ) : (
              <>
                {resetStep === "request" ? (
                  <form onSubmit={requestCode} className="space-y-3">
                    <input
                      className="input"
                      placeholder={t("auth.emailOrPhone")}
                      value={resetIdentifier}
                      onChange={(e) => setResetIdentifier(e.target.value)}
                      required
                      autoFocus
                    />
                    {resetInfo && (
                      <div className="rounded-lg bg-white/5 px-3 py-2 text-xs font-bold text-white/60">{resetInfo}</div>
                    )}
                    {error && (
                      <div className="rounded-lg bg-rose-500/15 px-3 py-2 text-xs font-bold text-rose-300">{error}</div>
                    )}
                    <button className="btn-primary w-full" disabled={busy || !resetIdentifier.trim()}>
                      {busy ? t("auth.working") : t("auth.sendCode")}
                    </button>
                    <button
                      type="button"
                      className="w-full text-xs font-bold text-white/40 hover:text-white/70"
                      onClick={() => {
                        setShowReset(false);
                        setError("");
                        setResetInfo("");
                      }}
                    >
                      ← {t("auth.backToLogin")}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={submitReset} className="space-y-3">
                    {resetInfo && (
                      <div className="rounded-lg bg-white/5 px-3 py-2 text-xs font-bold text-white/60">{resetInfo}</div>
                    )}
                    <input
                      className="input text-center text-2xl font-extrabold tracking-[0.5em]"
                      placeholder="······"
                      maxLength={6}
                      inputMode="numeric"
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ""))}
                      required
                      autoFocus
                    />
                    <input
                      className="input"
                      placeholder={t("auth.newPassword")}
                      type="password"
                      minLength={6}
                      value={resetNewPassword}
                      onChange={(e) => setResetNewPassword(e.target.value)}
                      required
                    />
                    {error && (
                      <div className="rounded-lg bg-rose-500/15 px-3 py-2 text-xs font-bold text-rose-300">{error}</div>
                    )}
                    <button className="btn-primary w-full" disabled={busy || resetCode.length !== 6 || resetNewPassword.length < 6}>
                      {busy ? t("auth.working") : t("auth.resetPassword")}
                    </button>
                    <button
                      type="button"
                      className="w-full text-xs font-bold text-white/40 hover:text-white/70"
                      onClick={() => {
                        setResetStep("request");
                        setError("");
                        setResetInfo("");
                      }}
                    >
                      {t("auth.resendCode")}
                    </button>
                  </form>
                )}
              </>
            )}
          </div>
        ) : (
          <>
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
                    placeholder={t("auth.phone")}
                    type="tel"
                    value={regForm.phone ?? ""}
                    onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
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
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setShowReset(true);
                        setError("");
                      }}
                      className="text-xs font-bold text-fuchsia-300 hover:underline"
                    >
                      {t("auth.forgotPassword")}?
                    </button>
                  </div>
                </>
              )}

              {error && <div className="rounded-lg bg-rose-500/15 px-3 py-2 text-xs font-bold text-rose-300">{error}</div>}

              <button className="btn-primary w-full" disabled={busy}>
                {busy ? t("auth.working") : mode === "login" ? t("auth.login") : t("auth.createAccount")}
              </button>
            </form>
          </>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-white/40">
        {t("auth.demoHint")} <b className="text-white/70">demo@sidequest.app</b> / <b className="text-white/70">demo123</b>
      </p>
      <div className="mt-4 flex items-center justify-center gap-4">
        <Link to="/terms" className="text-[11px] font-bold text-white/25 underline-offset-2 hover:text-white/60 hover:underline">
          📜 {t("terms.title")}
        </Link>
        <Link to="/admin" className="text-[11px] font-bold text-white/25 underline-offset-2 hover:text-white/60 hover:underline">
          🛠️ {t("admin.title")}
        </Link>
      </div>
    </div>
  );
}
