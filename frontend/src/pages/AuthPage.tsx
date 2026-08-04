import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../store/auth";
import { api } from "../api/client";
import type { TokenResponse } from "../types";
import { AVATARS } from "../lib/format";

export function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const setAuth = useAuth((s) => s.setAuth);
  const navigate = useNavigate();

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
      <div className="mb-8 text-center">
        <div className="text-6xl">🎮</div>
        <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight">
          Side<span className="text-fuchsia-400">Quest</span>
        </h1>
        <p className="mt-1 text-sm text-white/50">Challenges, votes & accountability — with your squad.</p>
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
              {m === "login" ? "Log in" : "Join"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === "register" && (
            <>
              <input
                className="input"
                placeholder="Display name"
                value={regForm.display_name}
                onChange={(e) => setRegForm({ ...regForm, display_name: e.target.value })}
                required
              />
              <input
                className="input"
                placeholder="Username"
                value={regForm.username}
                onChange={(e) => setRegForm({ ...regForm, username: e.target.value })}
                required
                minLength={2}
              />
              <input
                className="input"
                placeholder="Email"
                type="email"
                value={regForm.email}
                onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                required
              />
              <input
                className="input"
                placeholder="Password (6+ chars)"
                type="password"
                value={regForm.password}
                onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                required
                minLength={6}
              />
              <div>
                <div className="mb-1.5 text-xs font-bold text-white/50">Pick your avatar</div>
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
                placeholder="Username or email"
                value={loginForm.username_or_email}
                onChange={(e) => setLoginForm({ ...loginForm, username_or_email: e.target.value })}
                required
              />
              <input
                className="input"
                placeholder="Password"
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                required
              />
            </>
          )}

          {error && <div className="rounded-lg bg-rose-500/15 px-3 py-2 text-xs font-bold text-rose-300">{error}</div>}

          <button className="btn-primary w-full" disabled={busy}>
            {busy ? "Working..." : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-xs text-white/40">
        Demo squad: log in as <b className="text-white/70">demo@sidequest.app</b> / <b className="text-white/70">demo123</b>
      </p>
    </div>
  );
}
