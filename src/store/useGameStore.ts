"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DEMO_QUESTIONS } from "@/data/demoQuestions";
import { buildQuestionPlan, calculateScore, shuffle } from "@/lib/scoring";
import { sound } from "@/lib/sound";
import type {
  AnswerRecord,
  GamePhase,
  Question,
  QuestionPlan,
  ScoringMode,
  SessionSummary,
} from "@/types/game";

const MAX_HISTORY = 50;

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function summarizeSession(
  meta: Pick<SessionSummary, "id" | "participantId" | "mode" | "startedAt">,
  records: AnswerRecord[],
  maxStreak: number,
): SessionSummary {
  const correctCount = records.filter((r) => r.isCorrect).length;
  const timeoutCount = records.filter((r) => r.timedOut).length;
  const answered = records.filter((r) => !r.timedOut);
  const avgReactionMs = answered.length
    ? answered.reduce((sum, r) => sum + r.reactionTimeMs, 0) / answered.length
    : 0;

  return {
    ...meta,
    completedAt: new Date().toISOString(),
    totalScore: records.reduce((sum, r) => sum + r.pointsAwarded, 0),
    questionCount: records.length,
    correctCount,
    timeoutCount,
    accuracy: records.length ? correctCount / records.length : 0,
    avgReactionMs: Math.round(avgReactionMs),
    maxStreak,
    records,
  };
}

interface GameState {
  // Persisted preferences + research history
  selectedMode: ScoringMode;
  participantId: string;
  muted: boolean;
  history: SessionSummary[];

  // Live session (memory only)
  hasHydrated: boolean;
  phase: GamePhase;
  sessionId: string;
  startedAt: string;
  questions: Question[];
  plan: QuestionPlan[];
  currentIndex: number;
  score: number;
  streak: number;
  maxStreak: number;
  records: AnswerRecord[];
  currentSession: SessionSummary | null;

  // Actions
  setSelectedMode: (mode: ScoringMode) => void;
  setParticipantId: (id: string) => void;
  toggleMute: () => void;
  startGame: () => void;
  submitAnswer: (selectedIndex: number | null, reactionTimeMs: number) => AnswerRecord | null;
  nextQuestion: () => void;
  returnToLobby: () => void;
  clearHistory: () => void;
}

const liveDefaults = {
  phase: "lobby" as GamePhase,
  sessionId: "",
  startedAt: "",
  questions: [] as Question[],
  plan: [] as QuestionPlan[],
  currentIndex: 0,
  score: 0,
  streak: 0,
  maxStreak: 0,
  records: [] as AnswerRecord[],
  currentSession: null as SessionSummary | null,
};

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      selectedMode: "speed",
      participantId: "",
      muted: false,
      history: [],
      hasHydrated: false,
      ...liveDefaults,

      setSelectedMode: (mode) => set({ selectedMode: mode }),

      setParticipantId: (id) => set({ participantId: id.slice(0, 40) }),

      toggleMute: () => {
        const muted = !get().muted;
        sound.setMuted(muted);
        set({ muted });
      },

      startGame: () => {
        const mode = get().selectedMode;
        const questions = shuffle(DEMO_QUESTIONS);
        set({
          ...liveDefaults,
          phase: "playing",
          sessionId: createId(),
          startedAt: new Date().toISOString(),
          questions,
          plan: buildQuestionPlan(mode, questions.length),
        });
      },

      submitAnswer: (selectedIndex, reactionTimeMs) => {
        const state = get();
        if (state.phase !== "playing") return null;
        const question = state.questions[state.currentIndex];
        const plan = state.plan[state.currentIndex];
        if (!question || !plan) return null;
        // Guard against double submission for the same question.
        if (state.records.some((r) => r.questionNumber === state.currentIndex + 1)) return null;

        const timedOut = selectedIndex === null;
        const isCorrect = !timedOut && selectedIndex === question.correctIndex;
        const breakdown = calculateScore({
          mode: state.selectedMode,
          isCorrect,
          reactionTimeMs,
          timeLimitMs: plan.timeLimitMs,
          streakBefore: state.streak,
        });

        const record: AnswerRecord = {
          sessionId: state.sessionId,
          participantId: state.participantId.trim() || "anonymous",
          mode: state.selectedMode,
          questionNumber: state.currentIndex + 1,
          questionId: question.id,
          category: question.category,
          difficulty: question.difficulty,
          pressure: plan.pressure,
          timeLimitMs: plan.timeLimitMs,
          selectedIndex,
          correctIndex: question.correctIndex,
          isCorrect,
          timedOut,
          reactionTimeMs: Math.round(reactionTimeMs * 10) / 10,
          basePoints: breakdown.basePoints,
          multiplier: breakdown.multiplier,
          pointsAwarded: breakdown.pointsAwarded,
          streakAfter: breakdown.streakAfter,
          answeredAt: new Date().toISOString(),
        };

        set({
          records: [...state.records, record],
          score: state.score + breakdown.pointsAwarded,
          streak: breakdown.streakAfter,
          maxStreak: Math.max(state.maxStreak, breakdown.streakAfter),
        });
        return record;
      },

      nextQuestion: () => {
        const state = get();
        if (state.phase !== "playing") return;
        const nextIndex = state.currentIndex + 1;
        if (nextIndex < state.questions.length) {
          set({ currentIndex: nextIndex });
          return;
        }
        const summary = summarizeSession(
          {
            id: state.sessionId,
            participantId: state.participantId.trim() || "anonymous",
            mode: state.selectedMode,
            startedAt: state.startedAt,
          },
          state.records,
          state.maxStreak,
        );
        set({
          phase: "results",
          currentSession: summary,
          history: [...state.history, summary].slice(-MAX_HISTORY),
        });
      },

      returnToLobby: () => set({ ...liveDefaults }),

      clearHistory: () => {
        const current = get().currentSession;
        set({ history: current ? [current] : [] });
      },
    }),
    {
      name: "speed-study:v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({
        selectedMode: state.selectedMode,
        participantId: state.participantId,
        muted: state.muted,
        history: state.history,
      }),
      onRehydrateStorage: () => (state) => {
        sound.setMuted(state?.muted ?? false);
        useGameStore.setState({ hasHydrated: true });
      },
    },
  ),
);
