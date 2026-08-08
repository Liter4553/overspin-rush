import type { Chart } from "../chart/types";
import type { GameState } from "./gameState";
import { displaySign } from "./judge";
import type { JudgeGrade } from "./judge";
import type { TrackedNote } from "./noteState";
import { JUDGEABLE_LANES } from "../config";

// PERFECT+는 정타 취급이라 FAST/SLOW 구분이 없다(judge.ts의 displaySign 규칙과 동일) —
// 그래서 가운데/빠름/느림 분포에서는 PERFECT+를 뺀 4개 등급만 방향을 가진다.
export type FastSlowGrade = "PERFECT" | "GREAT" | "GOOD" | "MISS";

export interface GradeTimingBreakdown {
  centerCount: number; // PERFECT+
  fastCounts: Record<FastSlowGrade, number>;
  slowCounts: Record<FastSlowGrade, number>;
}

export interface ResultsSummary {
  score: number;
  theoreticalMax: number;
  accuracyPercent: number;
  gradeCounts: Record<JudgeGrade, number>;
  maxCombo: number;
  fastCount: number;
  slowCount: number;
  gradeTimingBreakdown: GradeTimingBreakdown;
}

function emptyFastSlowCounts(): Record<FastSlowGrade, number> {
  return { PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0 };
}

// 판정 결과를 가운데(PERFECT+)/빠름(FAST)/느림(SLOW)으로 나눠 등급별로 집계한다.
// errorMs가 없는 판정(현재는 자동 MISS뿐 — noteState.applyAutoMiss 참고)은 방향을
// 알 수 없어 어느 쪽에도 넣지 않는다(즉 FAST/SLOW MISS는 지금 게임 메커니즘상 항상 0).
export function computeGradeTimingBreakdown(tracker: readonly TrackedNote[]): GradeTimingBreakdown {
  const fastCounts = emptyFastSlowCounts();
  const slowCounts = emptyFastSlowCounts();
  let centerCount = 0;

  for (const t of tracker) {
    if (t.state !== "judged" || t.grade === null) continue;
    if (t.grade === "PERFECT_PLUS") {
      centerCount += 1;
      continue;
    }
    if (t.errorMs === null) continue;
    const sign = displaySign(t.grade, t.errorMs);
    if (sign === "FAST") fastCounts[t.grade] += 1;
    else if (sign === "SLOW") slowCounts[t.grade] += 1;
  }

  return { centerCount, fastCounts, slowCounts };
}

function countJudgeableNotes(chart: Chart): number {
  return chart.notes.filter((note) => JUDGEABLE_LANES.includes(note.lane)).length;
}

export function computeResults(
  chart: Chart,
  gameState: GameState,
  tracker: readonly TrackedNote[],
): ResultsSummary {
  const theoreticalMax = countJudgeableNotes(chart) * 4;
  const accuracyPercent = theoreticalMax === 0 ? 0 : (gameState.score / theoreticalMax) * 100;

  return {
    score: gameState.score,
    theoreticalMax,
    accuracyPercent,
    gradeCounts: gameState.gradeCounts,
    maxCombo: gameState.maxCombo,
    fastCount: gameState.fastCount,
    slowCount: gameState.slowCount,
    gradeTimingBreakdown: computeGradeTimingBreakdown(tracker),
  };
}
