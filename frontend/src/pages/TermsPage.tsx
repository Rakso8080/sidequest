import { Link } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { TERMS } from "../lib/terms";

export function TermsPage() {
  const { lang } = useI18n();
  const sections = TERMS[lang];

  return (
    <div className="mx-auto min-h-screen w-full max-w-md px-5 pb-10 pt-8">
      <Link to="/login" className="text-xs font-bold text-white/40 hover:text-white/70">
        ← Back
      </Link>
      <h1 className="mt-4 font-display text-3xl font-extrabold">📜 Terms & Disclaimer</h1>
      <p className="mt-1 text-xs text-white/40">SideQuest — simplified terms. Read before playing.</p>

      <div className="mt-6 space-y-4">
        {sections.map((s) => (
          <section key={s.title} className="card space-y-1.5">
            <h2 className="font-display text-sm font-extrabold text-fuchsia-300">{s.title}</h2>
            <p className="text-xs leading-relaxed text-white/60">{s.body}</p>
          </section>
        ))}
      </div>

      <p className="mt-8 text-center text-[10px] text-white/25">
        Last updated: August 2026
      </p>
    </div>
  );
}
