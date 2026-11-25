"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import {
  Clock,
  FlaskConical,
  Flame,
  Gauge,
  InfinityIcon,
  Keyboard,
  Play,
  Shuffle,
  Target,
  type LucideIcon,
} from "lucide-react";
import { DEMO_QUESTIONS } from "@/data/demoQuestions";
import { MODE_CONFIGS, MODE_ORDER } from "@/lib/scoring";
import { sound } from "@/lib/sound";
import { useGameStore } from "@/store/useGameStore";
import type { ScoringMode } from "@/types/game";

const MODE_ICONS: Record<ScoringMode, LucideIcon> = {
  control: Target,
  speed: Gauge,
  streak: Flame,
  variable: Shuffle,
};

export default function LobbyScreen() {
  const selectedMode = useGameStore((s) => s.selectedMode);
  const participantId = useGameStore((s) => s.participantId);
  const history = useGameStore((s) => s.history);
  const setSelectedMode = useGameStore((s) => s.setSelectedMode);
  const setParticipantId = useGameStore((s) => s.setParticipantId);
  const startGame = useGameStore((s) => s.startGame);

  const counts = DEMO_QUESTIONS.reduce<Record<string, number>>((acc, q) => {
    acc[q.difficulty] = (acc[q.difficulty] ?? 0) + 1;
    return acc;
  }, {});

  const begin = () => {
    sound.unlock();
    sound.click();
    startGame();
  };

  const choose = (mode: ScoringMode) => {
    sound.click();
    setSelectedMode(mode);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
      const idx = ["1", "2", "3", "4"].indexOf(e.key);
      if (idx >= 0) {
        e.preventDefault();
        sound.click();
        useGameStore.getState().setSelectedMode(MODE_ORDER[idx]);
      } else if (e.key === "Enter") {
        e.preventDefault();
        sound.unlock();
        sound.click();
        useGameStore.getState().startGame();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const runsByMode = (mode: ScoringMode) => history.filter((h) => h.mode === mode).length;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pb-16 pt-6 sm:px-6">
      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="text-center"
      >
        <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200">
          <FlaskConical className="h-3.5 w-3.5" aria-hidden />
          Live research prototype
        </div>
        <h1 className="text-5xl font-black tracking-tight sm:text-7xl">
          <span className="bg-gradient-to-br from-white via-indigo-100 to-indigo-300 bg-clip-text text-transparent">
            Speed
          </span>
          <span className="bg-gradient-to-br from-fuchsia-400 via-violet-400 to-cyan-300 bg-clip-text text-transparent">
            Study
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-balance text-base text-slate-300 sm:text-lg">
          Does racing the clock make you sharper — or sloppier? Pick a scoring condition, answer{" "}
          {DEMO_QUESTIONS.length} questions, and see your speed–accuracy trade-off.
        </p>
      </motion.section>

      {/* Mode selection */}
      <section aria-labelledby="mode-heading">
        <div className="mb-3 flex items-end justify-between gap-4">
          <h2 id="mode-heading" className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400">
            Choose a scoring condition
          </h2>
          <span className="hidden items-center gap-1.5 text-xs text-slate-500 sm:inline-flex">
            <Keyboard className="h-3.5 w-3.5" aria-hidden /> Press 1–4 to select · Enter to start
          </span>
        </div>

        <div role="radiogroup" aria-label="Scoring mode" className="grid gap-4 sm:grid-cols-2">
          {MODE_ORDER.map((id, i) => {
            const cfg = MODE_CONFIGS[id];
            const Icon = MODE_ICONS[id];
            const active = selectedMode === id;
            const runs = runsByMode(id);
            return (
              <motion.button
                key={id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => choose(id)}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 + i * 0.06, duration: 0.35, ease: "easeOut" }}
                whileHover={{ y: -3 }}
                className={`group relative flex flex-col gap-3 rounded-2xl border-2 border-b-[6px] bg-slate-900/70 p-5 text-left transition-[border-color,box-shadow,background-color,transform] duration-150 active:translate-y-1 active:border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
                  active
                    ? `${cfg.accent.border} ${cfg.accent.glow} bg-slate-900`
                    : "border-slate-700/80 hover:border-slate-500"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-black text-slate-950 ${cfg.accent.bg}`}
                    >
                      {cfg.letter}
                    </span>
                    <div>
                      <div className="text-lg font-extrabold leading-tight text-white">{cfg.name}</div>
                      <div className={`text-xs font-semibold uppercase tracking-wider ${cfg.accent.text}`}>
                        {cfg.tagline}
                      </div>
                    </div>
                  </div>
                  <Icon
                    className={`h-6 w-6 shrink-0 transition-colors ${active ? cfg.accent.text : "text-slate-600"}`}
                    aria-hidden
                  />
                </div>

                <p className="text-sm leading-relaxed text-slate-300">{cfg.description}</p>

                <code className="block rounded-lg border border-slate-700/70 bg-slate-950/70 px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-300">
                  {cfg.formula}
                </code>

                <div className="mt-auto flex items-center justify-between text-xs text-slate-400">
                  <span className="inline-flex items-center gap-1.5">
                    {id === "control" ? (
                      <InfinityIcon className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <Clock className="h-3.5 w-3.5" aria-hidden />
                    )}
                    {cfg.timerLabel}
                  </span>
                  <span className="flex items-center gap-2">
                    {runs > 0 && (
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-300">
                        {runs} saved run{runs === 1 ? "" : "s"}
                      </span>
                    )}
                    <kbd className="rounded-md border border-slate-600 bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] text-slate-300">
                      {i + 1}
                    </kbd>
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>
      </section>

      {/* Participant + start */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.4 }}
        className="flex flex-col items-stretch gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-5 sm:flex-row sm:items-end"
      >
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
            Participant ID <span className="font-medium normal-case tracking-normal text-slate-500">(optional)</span>
          </span>
          <input
            value={participantId}
            onChange={(e) => setParticipantId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") begin();
            }}
            placeholder="e.g. P-014"
            autoComplete="off"
            spellCheck={false}
            className="h-12 rounded-xl border-2 border-slate-700 bg-slate-950/80 px-4 font-mono text-sm text-white placeholder:text-slate-600 focus:border-indigo-400 focus:outline-none"
          />
          <span className="text-xs text-slate-500">
            Deck: {DEMO_QUESTIONS.length} questions · {counts.Easy ?? 0} Easy · {counts.Medium ?? 0} Medium ·{" "}
            {counts.Hard ?? 0} Hard · order shuffled each run
          </span>
        </label>

        <button
          type="button"
          onClick={begin}
          className="group inline-flex h-16 items-center justify-center gap-3 rounded-2xl border-b-[6px] border-emerald-700 bg-emerald-400 px-10 text-xl font-black uppercase tracking-wide text-emerald-950 shadow-[0_0_40px_-8px_rgba(52,211,153,0.8)] transition-all duration-100 hover:brightness-110 active:translate-y-1 active:border-b-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300/60"
        >
          <Play className="h-6 w-6 fill-current transition-transform group-hover:scale-110" aria-hidden />
          Start · {MODE_CONFIGS[selectedMode].letter}
        </button>
      </motion.section>
    </div>
  );
}
