// Tiny synthesized sound effects via the Web Audio API (no audio files needed).

const MUTE_KEY = "sq_muted";
let muted = localStorage.getItem(MUTE_KEY) === "1";
let ctx: AudioContext | null = null;

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC: typeof AudioContext | undefined =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

interface ToneOpts {
  freq: number;
  freqEnd?: number;
  dur?: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
}

function tone({ freq, freqEnd, dur = 0.12, type = "sine", gain = 0.12, delay = 0 }: ToneOpts) {
  if (muted) return;
  const c = ensureCtx();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function arpeggio(freqs: number[], opts: Partial<ToneOpts> = {}) {
  freqs.forEach((f, i) => tone({ freq: f, delay: i * 0.07, ...opts }));
}

export const sfx = {
  /** Soft universal click for any button tap. */
  click: () => tone({ freq: 660, type: "triangle", dur: 0.06, gain: 0.07 }),
  /** Cheerful pop — starting/proposing something. */
  pop: () => {
    tone({ freq: 520, type: "triangle", dur: 0.08, gain: 0.11 });
    tone({ freq: 760, type: "triangle", dur: 0.07, gain: 0.08, delay: 0.035 });
  },
  /** Rising success chime. */
  success: () => arpeggio([523.25, 659.25, 783.99], { type: "sine", dur: 0.14, gain: 0.13 }),
  /** Warm notification ding. */
  ding: () => tone({ freq: 1318.5, type: "sine", dur: 0.12, gain: 0.08 }),
  /** Low buzz for errors / rejections. */
  error: () => tone({ freq: 220, freqEnd: 170, type: "sawtooth", dur: 0.2, gain: 0.08 }),
  /** Vote approve — quick two-note up. */
  approve: () => {
    tone({ freq: 587.33, type: "sine", dur: 0.09, gain: 0.11 });
    tone({ freq: 880, type: "sine", dur: 0.13, gain: 0.1, delay: 0.06 });
  },
  /** Vote reject — descending thud. */
  reject: () => tone({ freq: 311, freqEnd: 196, type: "square", dur: 0.16, gain: 0.06 }),
  /** Whoosh — sending a message / submitting proof. */
  whoosh: () => tone({ freq: 320, freqEnd: 940, type: "sine", dur: 0.12, gain: 0.06 }),
  /** Sharp tick for the spin wheel. */
  tick: () => tone({ freq: 1050, type: "square", dur: 0.03, gain: 0.045 }),
  /** Spin-wheel land. */
  land: () => arpeggio([392, 523.25, 659.25, 783.99], { type: "triangle", dur: 0.12, gain: 0.1 }),
  setMuted: (m: boolean) => {
    muted = m;
    localStorage.setItem(MUTE_KEY, m ? "1" : "0");
  },
  isMuted: () => muted,
};

/** Attach a soft click sound to every button in the app via event delegation. */
export function enableGlobalClickSounds() {
  document.addEventListener("click", (e) => {
    const el = e.target as HTMLElement | null;
    if (el && el.closest && el.closest("button")) sfx.click();
  });
}
