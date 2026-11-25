"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import {
  Check,
  Download,
  Flame,
  Gauge,
  RotateCcw,
  Target,
  Timer,
  Trash2,
  Trophy,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { MODE_CONFIGS, MODE_ORDER, formatMs, timeLimitLabel, formatPoints } from "@/lib/scoring";
import { sound } from "@/lib/sound";
import { useGameStore } from "@/store/useGameStore";
import type { AnswerRecord, ScoringMode, SessionSummary } from "@/types/game";

const CORRECT_COLOR = "#34d399"; // emerald-400
const INCORRECT_COLOR = "#f43f5e"; // rose-500

/* --------------------------------- CSV ---------------------------------- */

const CSV_COLUMNS: Array<keyof AnswerRecord> = [
  "sessionId",
  "participantId",
  "mode",
  "questionNumber",
  "questionId",
  "category",
  "difficulty",
  "pressure",
  "timeLimitMs",
  "selectedIndex",
  "correctIndex",
  "isCorrect",
  "timedOut",
  "reactionTimeMs",
  "basePoints",
  "multiplier",
  "pointsAwarded",
  "streakAfter",
  "answeredAt",
];

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(records: AnswerRecord[]): string {
  const header = CSV_COLUMNS.join(",");
  const rows = records.map((r) => CSV_COLUMNS.map((c) => csvCell(r[c])).join(","));
  return [header, ...rows].join("\r\n");
}

function downloadCsv(filename: string, records: AnswerRecord[]) {
  const blob = new Blob([toCsv(records)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ------------------------------- Helpers -------------------------------- */

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

interface ModeAggregate {
  runs: number;
  accuracy: number;
  avgReactionMs: number;
  avgScore: number;
  bestScore: number;
}

function aggregate(sessions: SessionSummary[]): ModeAggregate | null {
  if (!sessions.length) return null;
  const n = sessions.length;
  return {
    runs: n,
    accuracy: sessions.reduce((s, x) => s + x.accuracy, 0) / n,
    avgReactionMs: sessions.reduce((s, x) => s + x.avgReactionMs, 0) / n,
    avgScore: sessions.reduce((s, x) => s + x.totalScore, 0) / n,
    bestScore: Math.max(...sessions.map((x) => x.totalScore)),
  };
}

/** Median split on reaction time: is accuracy worse for the faster half? */
function speedSplit(records: AnswerRecord[]) {
  const answered = records.filter((r) => !r.timedOut);
  if (answered.length < 2) return null;
  const mid = median(answered.map((r) => r.reactionTimeMs));
  const fast = answered.filter((r) => r.reactionTimeMs <= mid);
  const slow = answered.filter((r) => r.reactionTimeMs > mid);
  if (!fast.length || !slow.length) return null;
  const acc = (rs: AnswerRecord[]) => rs.filter((r) => r.isCorrect).length / rs.length;
  return { medianMs: mid, fastAccuracy: acc(fast), slowAccuracy: acc(slow), fastN: fast.length, slowN: slow.length };
}

/* ------------------------------ Component ------------------------------- */

export default function ResultsAnalytics() {
  const session = useGameStore((s) => s.currentSession);
  const history = useGameStore((s) => s.history);
  const startGame = useGameStore((s) => s.startGame);
  const returnToLobby = useGameStore((s) => s.returnToLobby);
  const clearHistory = useGameStore((s) => s.clearHistory);
  const celebratedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!session || celebratedRef.current === session.id) return;
    celebratedRef.current = session.id;
    sound.fanfare();
    const strong = session.accuracy >= 0.75;
    const base = { disableForReducedMotion: true, zIndex: 60, colors: ["#f0abfc", "#67e8f9", "#fde047", "#34d399", "#a78bfa"] };
    confetti({ ...base, particleCount: strong ? 160 : 70, spread: 100, startVelocity: 50, origin: { x: 0.5, y: 0.3 } });
    if (strong) {
      const id = window.setTimeout(() => {
        confetti({ ...base, particleCount: 80, angle: 60, spread: 70, origin: { x: 0, y: 0.75 } });
        confetti({ ...base, particleCount: 80, angle: 120, spread: 70, origin: { x: 1, y: 0.75 } });
      }, 350);
      return () => window.clearTimeout(id);
    }
  }, [session]);

  if (!session) return null;

  const cfg = MODE_CONFIGS[session.mode];
  const records = session.records;
  const priorSessions = history.filter((h) => h.id !== session.id);
  const split = speedSplit(records);

  const points = records.map((r) => ({
    rt: Math.round(r.reactionTimeMs),
    points: r.pointsAwarded,
    record: r,
  }));
  const correctPoints = points.filter((p) => p.record.isCorrect);
  const incorrectPoints = points.filter((p) => !p.record.isCorrect);
  const timeLimits = Array.from(new Set(records.map((r) => r.timeLimitMs).filter((v): v is number => v !== null)));
  const maxLimit = timeLimits.length ? Math.max(...timeLimits) : 0;

  const stats: Array<{ label: string; value: string; sub: string; icon: LucideIcon; tone: string }> = [
    { label: "Final score", value: formatPoints(session.totalScore), sub: `${session.questionCount} questions`, icon: Trophy, tone: "text-yellow-300" },
    { label: "Accuracy", value: pct(session.accuracy), sub: `${session.correctCount}/${session.questionCount} correct`, icon: Target, tone: "text-emerald-300" },
    {
      label: "Avg reaction",
      value: formatMs(session.avgReactionMs),
      sub: session.timeoutCount ? `${session.timeoutCount} timeout${session.timeoutCount === 1 ? "" : "s"} excluded` : "answered questions",
      icon: Timer,
      tone: "text-cyan-300",
    },
    { label: "Max streak", value: String(session.maxStreak), sub: "consecutive correct", icon: Flame, tone: "text-orange-300" },
  ];

  const stamp = session.completedAt.replace(/[:.]/g, "-").slice(0, 19);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pb-16 pt-6 sm:px-6">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-3 text-center"
      >
        <motion.div
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.1 }}
          className="flex h-16 w-16 items-center justify-center rounded-2xl border-b-[6px] border-yellow-600 bg-yellow-300 shadow-[0_0_48px_-6px_rgba(253,224,71,0.8)]"
        >
          <Trophy className="h-9 w-9 text-yellow-900" aria-hidden />
        </motion.div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Speed vs. Accuracy · Research Summary</p>
          <h1 className="mt-1 text-3xl font-black text-white sm:text-4xl">Round complete!</h1>
        </div>
        <span className={`inline-flex items-center gap-2 rounded-xl border-2 border-b-4 ${cfg.accent.border} bg-slate-900 px-3 py-1 text-xs font-bold uppercase tracking-wider ${cfg.accent.text}`}>
          Mode {cfg.letter} · {cfg.name}
        </span>
      </motion.header>

      {/* Stat tiles */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.15 + i * 0.07, type: "spring", stiffness: 300, damping: 22 }}
            className="rounded-2xl border-2 border-b-[6px] border-slate-700/80 bg-slate-900/80 p-4"
          >
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              <s.icon className={`h-4 w-4 ${s.tone}`} aria-hidden />
              {s.label}
            </div>
            <div className="mt-2 font-mono text-2xl font-black tabular-nums text-white sm:text-3xl">{s.value}</div>
            <div className="mt-0.5 text-xs text-slate-500">{s.sub}</div>
          </motion.div>
        ))}
      </section>

      {/* Scatter */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-6"
        aria-labelledby="scatter-heading"
      >
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 id="scatter-heading" className="text-lg font-extrabold text-white">
              Reaction time vs. points
            </h2>
            <p className="text-sm text-slate-400">Each mark is one question. Misses score 0.</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold text-slate-300" aria-label="Legend">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CORRECT_COLOR }} />
              Correct ({correctPoints.length})
            </span>
            <span className="inline-flex items-center gap-1.5">
              <X className="h-3.5 w-3.5" strokeWidth={4} style={{ color: INCORRECT_COLOR }} aria-hidden />
              Incorrect ({incorrectPoints.length})
            </span>
          </div>
        </div>

        <div className="h-72 w-full sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 12, right: 16, bottom: 28, left: 4 }}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="0" vertical={false} />
              <XAxis
                type="number"
                dataKey="rt"
                name="Reaction time"
                domain={[0, (max: number) => Math.max(2000, maxLimit, Math.ceil(max / 1000) * 1000)]}
                tickFormatter={(v: number) => `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}s`}
                stroke="#475569"
                tick={{ fill: "#94a3b8", fontSize: 12 }}
                tickLine={false}
                label={{ value: "Reaction time", position: "insideBottom", offset: -16, fill: "#94a3b8", fontSize: 12 }}
              />
              <YAxis
                type="number"
                dataKey="points"
                name="Points"
                domain={[0, (max: number) => Math.max(1000, Math.ceil(max / 250) * 250)]}
                stroke="#475569"
                tick={{ fill: "#94a3b8", fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={48}
              />
              <ZAxis range={[110, 110]} />
              {session.avgReactionMs > 0 && (
                <ReferenceLine
                  x={session.avgReactionMs}
                  stroke="#818cf8"
                  strokeDasharray="4 4"
                  label={{ value: "avg", position: "top", fill: "#a5b4fc", fontSize: 11 }}
                />
              )}
              {timeLimits.map((limit) => (
                <ReferenceLine
                  key={limit}
                  x={limit}
                  stroke="#64748b"
                  strokeDasharray="2 4"
                  label={{ value: `${limit / 1000}s limit`, position: "insideTopRight", fill: "#64748b", fontSize: 11 }}
                />
              ))}
              <Tooltip
                cursor={{ stroke: "#334155", strokeDasharray: "3 3" }}
                content={({ active, payload }) => <ScatterTooltip active={active} payload={payload} />}
              />
              <Scatter name="Correct" data={correctPoints} fill={CORRECT_COLOR} stroke="#0f172a" strokeWidth={2} shape="circle" />
              <Scatter name="Incorrect" data={incorrectPoints} fill={INCORRECT_COLOR} stroke="#0f172a" strokeWidth={1} shape="cross" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {split && (
          <div className="mt-4 grid gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm sm:grid-cols-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Median split</div>
              <div className="font-mono text-white">{formatMs(split.medianMs)}</div>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Faster half accuracy</div>
              <div className="font-mono text-white">
                {pct(split.fastAccuracy)} <span className="text-slate-500">(n={split.fastN})</span>
              </div>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Slower half accuracy</div>
              <div className="font-mono text-white">
                {pct(split.slowAccuracy)} <span className="text-slate-500">(n={split.slowN})</span>
              </div>
            </div>
          </div>
        )}
      </motion.section>

      {/* Per-question telemetry */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-6" aria-labelledby="telemetry-heading">
        <h2 id="telemetry-heading" className="mb-3 text-lg font-extrabold text-white">
          Question telemetry
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-slate-500">
              <tr className="border-b border-slate-800">
                <th className="py-2 pr-3 font-bold">#</th>
                <th className="py-2 pr-3 font-bold">Question</th>
                <th className="py-2 pr-3 font-bold">Difficulty</th>
                <th className="py-2 pr-3 font-bold">Pressure</th>
                <th className="py-2 pr-3 text-right font-bold">RT</th>
                <th className="py-2 pr-3 font-bold">Result</th>
                <th className="py-2 text-right font-bold">Points</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.questionNumber} className="border-b border-slate-800/60 last:border-0">
                  <td className="py-2 pr-3 font-mono text-slate-500">{r.questionNumber}</td>
                  <td className="py-2 pr-3 font-mono text-xs text-slate-300">{r.questionId}</td>
                  <td className="py-2 pr-3 text-slate-300">{r.difficulty}</td>
                  <td className="py-2 pr-3 text-slate-300">{timeLimitLabel(r.timeLimitMs)}</td>
                  <td className="py-2 pr-3 text-right font-mono tabular-nums text-slate-200">{formatMs(r.reactionTimeMs)}</td>
                  <td className="py-2 pr-3">
                    {r.isCorrect ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-300">
                        <Check className="h-4 w-4" aria-hidden /> Correct
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-semibold text-rose-300">
                        <X className="h-4 w-4" aria-hidden /> {r.timedOut ? "Timeout" : "Incorrect"}
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-right font-mono tabular-nums text-white">
                    {formatPoints(r.pointsAwarded)}
                    {r.multiplier > 1 && <span className="ml-1 text-xs text-orange-300">×{r.multiplier}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Mode comparison */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-6" aria-labelledby="compare-heading">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="compare-heading" className="text-lg font-extrabold text-white">
              Compared with previous runs
            </h2>
            <p className="text-sm text-slate-400">
              Averages of runs saved on this device, grouped by scoring mode. This session is shown separately.
            </p>
          </div>
          {priorSessions.length > 0 && (
            <button
              type="button"
              onClick={() => {
                sound.click();
                clearHistory();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 transition-colors hover:bg-rose-500/10 hover:text-rose-300"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden /> Clear saved runs
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-slate-500">
              <tr className="border-b border-slate-800">
                <th className="py-2 pr-3 font-bold">Mode</th>
                <th className="py-2 pr-3 text-right font-bold">Runs</th>
                <th className="py-2 pr-3 text-right font-bold">Accuracy</th>
                <th className="py-2 pr-3 text-right font-bold">Avg RT</th>
                <th className="py-2 pr-3 text-right font-bold">Avg score</th>
                <th className="py-2 text-right font-bold">Best</th>
              </tr>
            </thead>
            <tbody>
              {MODE_ORDER.map((mode) => (
                <ComparisonRows key={mode} mode={mode} session={session} prior={priorSessions.filter((h) => h.mode === mode)} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Actions */}
      <section className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => {
              sound.click();
              downloadCsv(`speed-study_${session.mode}_${stamp}.csv`, records);
            }}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border-b-4 border-cyan-700 bg-cyan-400 px-5 font-black text-cyan-950 transition-all duration-75 hover:brightness-110 active:translate-y-1 active:border-b-0"
          >
            <Download className="h-5 w-5" aria-hidden /> Download Session CSV
          </button>
          {history.length > 1 && (
            <button
              type="button"
              onClick={() => {
                sound.click();
                downloadCsv(`speed-study_all-runs_${stamp}.csv`, history.flatMap((h) => h.records));
              }}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-b-4 border-slate-600 bg-slate-800 px-5 font-bold text-slate-200 transition-all duration-75 hover:bg-slate-700 active:translate-y-1 active:border-b-2"
            >
              <Download className="h-5 w-5" aria-hidden /> All runs ({history.length})
            </button>
          )}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => {
              sound.click();
              returnToLobby();
            }}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-b-4 border-slate-600 bg-slate-800 px-5 font-bold text-slate-200 transition-all duration-75 hover:bg-slate-700 active:translate-y-1 active:border-b-2"
          >
            <Gauge className="h-5 w-5" aria-hidden /> Change mode
          </button>
          <button
            type="button"
            onClick={() => {
              sound.click();
              startGame();
            }}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border-b-4 border-emerald-700 bg-emerald-400 px-6 font-black uppercase text-emerald-950 shadow-[0_0_32px_-8px_rgba(52,211,153,0.8)] transition-all duration-75 hover:brightness-110 active:translate-y-1 active:border-b-0"
          >
            <RotateCcw className="h-5 w-5" aria-hidden /> Play again
          </button>
        </div>
      </section>
    </div>
  );
}

/* --------------------------- Sub-components ----------------------------- */

interface TooltipEntry {
  payload?: unknown;
}

function ScatterTooltip({ active, payload }: { active?: boolean; payload?: ReadonlyArray<TooltipEntry> }) {
  const datum = payload?.[0]?.payload as { record?: AnswerRecord } | undefined;
  const r = datum?.record;
  if (!active || !r) return null;
  return (
    <div className="max-w-[240px] rounded-xl border border-slate-700 bg-slate-950/95 px-3 py-2 text-xs shadow-xl">
      <div className="mb-1 flex items-center gap-1.5 font-bold text-white">
        {r.isCorrect ? (
          <Check className="h-3.5 w-3.5 text-emerald-300" aria-hidden />
        ) : (
          <X className="h-3.5 w-3.5 text-rose-300" aria-hidden />
        )}
        Q{r.questionNumber} · {r.difficulty}
      </div>
      <div className="font-mono text-slate-400">{r.questionId}</div>
      <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-slate-300">
        <span className="text-slate-500">RT</span>
        <span className="text-right font-mono">{formatMs(r.reactionTimeMs)}</span>
        <span className="text-slate-500">Points</span>
        <span className="text-right font-mono">{formatPoints(r.pointsAwarded)}</span>
        <span className="text-slate-500">Pressure</span>
        <span className="text-right">{timeLimitLabel(r.timeLimitMs)}</span>
        {r.timedOut && (
          <>
            <span className="text-slate-500">Status</span>
            <span className="text-right text-rose-300">Timed out</span>
          </>
        )}
      </div>
    </div>
  );
}

function Delta({ value, format, invert = false }: { value: number; format: (v: number) => string; invert?: boolean }) {
  if (Math.abs(value) < 1e-9) return <span className="ml-1.5 text-[11px] text-slate-500">±0</span>;
  const better = invert ? value < 0 : value > 0;
  return (
    <span className={`ml-1.5 text-[11px] font-bold ${better ? "text-emerald-300" : "text-rose-300"}`}>
      {value > 0 ? "▲" : "▼"}
      {format(Math.abs(value))}
    </span>
  );
}

function ComparisonRows({ mode, session, prior }: { mode: ScoringMode; session: SessionSummary; prior: SessionSummary[] }) {
  const cfg = MODE_CONFIGS[mode];
  const agg = aggregate(prior);
  const isCurrent = session.mode === mode;
  const dash = <span className="text-slate-600">—</span>;

  return (
    <>
      <tr className={`border-b border-slate-800/60 ${isCurrent ? "bg-slate-800/40" : ""}`}>
        <td className="py-2.5 pr-3">
          <span className="inline-flex items-center gap-2">
            <span className={`flex h-5 w-5 items-center justify-center rounded-md text-[11px] font-black text-slate-950 ${cfg.accent.bg}`}>
              {cfg.letter}
            </span>
            <span className="font-semibold text-slate-200">{cfg.name}</span>
            <span className="text-xs text-slate-500">{isCurrent ? "prior avg" : "avg"}</span>
          </span>
        </td>
        <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-slate-300">{agg ? agg.runs : 0}</td>
        <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-slate-300">{agg ? pct(agg.accuracy) : dash}</td>
        <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-slate-300">{agg ? formatMs(agg.avgReactionMs) : dash}</td>
        <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-slate-300">{agg ? formatPoints(Math.round(agg.avgScore)) : dash}</td>
        <td className="py-2.5 text-right font-mono tabular-nums text-slate-300">{agg ? formatPoints(agg.bestScore) : dash}</td>
      </tr>
      {isCurrent && (
        <tr className="border-b border-slate-800/60 bg-indigo-500/10">
          <td className="py-2.5 pr-3 pl-7">
            <span className="inline-flex items-center gap-1.5 font-bold text-indigo-200">
              <Zap className="h-3.5 w-3.5" aria-hidden /> This session
            </span>
          </td>
          <td className="py-2.5 pr-3 text-right font-mono text-slate-500">1</td>
          <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-white">
            {pct(session.accuracy)}
            {agg && <Delta value={(session.accuracy - agg.accuracy) * 100} format={(v) => `${Math.round(v)}pp`} />}
          </td>
          <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-white">
            {formatMs(session.avgReactionMs)}
            {agg && <Delta value={session.avgReactionMs - agg.avgReactionMs} format={(v) => `${Math.round(v)}`} invert />}
          </td>
          <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-white">
            {formatPoints(session.totalScore)}
            {agg && <Delta value={session.totalScore - agg.avgScore} format={(v) => formatPoints(Math.round(v))} />}
          </td>
          <td className="py-2.5 text-right font-mono tabular-nums text-white">
            {agg && session.totalScore > agg.bestScore ? (
              <span className="rounded-md bg-yellow-300 px-1.5 py-0.5 text-[11px] font-black text-yellow-950">NEW BEST</span>
            ) : (
              dash
            )}
          </td>
        </tr>
      )}
    </>
  );
}
