"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FlaskConical, Volume2, VolumeX } from "lucide-react";
import GameArena from "@/components/GameArena";
import LobbyScreen from "@/components/LobbyScreen";
import ResultsAnalytics from "@/components/ResultsAnalytics";
import { useGameStore } from "@/store/useGameStore";

export default function Home() {
  const phase = useGameStore((s) => s.phase);
  const muted = useGameStore((s) => s.muted);
  const hasHydrated = useGameStore((s) => s.hasHydrated);
  const toggleMute = useGameStore((s) => s.toggleMute);
  const returnToLobby = useGameStore((s) => s.returnToLobby);

  // Load persisted history/preferences after mount so SSR markup matches the first client render.
  useEffect(() => {
    void useGameStore.persist.rehydrate();
  }, []);

  // Global "M" shortcut toggles sound.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "m" || e.key === "M") useGameStore.getState().toggleMute();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="relative flex min-h-screen flex-1 flex-col overflow-x-hidden bg-[#0b0b1e] text-slate-100">
      {/* Ambient backdrop */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-indigo-600/25 blur-[120px]" />
        <div className="absolute -right-40 top-1/3 h-[28rem] w-[28rem] rounded-full bg-fuchsia-600/15 blur-[120px]" />
        <div className="absolute -bottom-48 left-1/4 h-[30rem] w-[30rem] rounded-full bg-cyan-500/10 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(148,163,184,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.5) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
          }}
        />
      </div>

      {/* Top bar */}
      <header className="relative z-20 mx-auto flex w-full max-w-5xl items-center justify-between px-4 pt-4 sm:px-6">
        <button
          type="button"
          onClick={() => phase !== "playing" && returnToLobby()}
          className="flex items-center gap-2 rounded-lg text-sm font-black tracking-tight text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          aria-label="SpeedStudy home"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border-b-4 border-indigo-800 bg-indigo-500">
            <FlaskConical className="h-4 w-4" aria-hidden />
          </span>
          SpeedStudy
        </button>
        <button
          type="button"
          onClick={toggleMute}
          aria-pressed={muted}
          aria-label={muted ? "Unmute sound (M)" : "Mute sound (M)"}
          title={muted ? "Unmute (M)" : "Mute (M)"}
          className={`flex h-10 w-10 items-center justify-center rounded-xl border-2 border-b-4 border-slate-700 bg-slate-900 text-slate-300 transition-all duration-75 hover:text-white active:translate-y-0.5 active:border-b-2 ${
            hasHydrated ? "opacity-100" : "opacity-0"
          }`}
        >
          {muted ? <VolumeX className="h-5 w-5" aria-hidden /> : <Volume2 className="h-5 w-5" aria-hidden />}
        </button>
      </header>

      <main className="relative z-10 flex flex-1 flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={phase}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="flex flex-1 flex-col"
          >
            {phase === "lobby" && <LobbyScreen />}
            {phase === "playing" && <GameArena />}
            {phase === "results" && <ResultsAnalytics />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
