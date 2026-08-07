import type { JudgeGrade, TimingSign } from "./judge";

export interface GameState {
  score: number;
  combo: number;
  maxCombo: number;
  gradeCounts: Record<JudgeGrade, number>;
  fastCount: number;
  slowCount: number;
}

export function createGameState(): GameState {
  return {
    score: 0,
    combo: 0,
    maxCombo: 0,
    gradeCounts: { PERFECT_PLUS: 0, PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0 },
    fastCount: 0,
    slowCount: 0,
  };
}

// 판정 1건을 반영한 새 상태를 반환한다(불변 갱신).
// 콤보는 MISS에서만 끊긴다 — GOOD을 포함한 그 외 등급은 콤보를 유지한다.
export function applyJudgement(
  state: GameState,
  grade: JudgeGrade,
  score: number,
  sign: TimingSign,
): GameState {
  const combo = grade === "MISS" ? 0 : state.combo + 1;
  return {
    score: state.score + score,
    combo,
    maxCombo: Math.max(state.maxCombo, combo),
    gradeCounts: { ...state.gradeCounts, [grade]: state.gradeCounts[grade] + 1 },
    fastCount: state.fastCount + (sign === "FAST" ? 1 : 0),
    slowCount: state.slowCount + (sign === "SLOW" ? 1 : 0),
  };
}

// 홀드 틱 1건을 반영한다. 콤보만 증가하고 점수/판정 집계/FAST-SLOW는 그대로 둔다
// (SPEC.md 3절 — 틱은 "처리 중" 표시용이며 채점 대상이 아니다).
export function applyHoldTick(state: GameState): GameState {
  const combo = state.combo + 1;
  return { ...state, combo, maxCombo: Math.max(state.maxCombo, combo) };
}
