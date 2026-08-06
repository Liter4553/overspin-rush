import type { Chart } from "../chart/types";
import type { GameState } from "./gameState";
import type { JudgeGrade } from "./judge";
import type { TrackedNote } from "./noteState";
import { ERROR_HISTOGRAM_BUCKET_MS, JUDGEABLE_LANES, JUDGMENT_BAR_RANGE_MS } from "../config";

export interface ResultsSummary {
  score: number;
  theoreticalMax: number;
  accuracyPercent: number;
  gradeCounts: Record<JudgeGrade, number>;
  maxCombo: number;
  fastCount: number;
  slowCount: number;
  errorHistogram: number[]; // 좌측(FAST)부터 우측(SLOW) 순서의 버킷별 개수
}

// ±JUDGMENT_BAR_RANGE_MS 범위를 ERROR_HISTOGRAM_BUCKET_MS 폭으로 나눈 버킷에
// 오차값들을 채운다. 범위를 벗어나는 값(이론상 발생 안 함)은 가장 바깥 버킷으로 클램프.
export function computeErrorHistogram(errors: readonly number[]): number[] {
  const bucketCount = Math.round((JUDGMENT_BAR_RANGE_MS * 2) / ERROR_HISTOGRAM_BUCKET_MS);
  const buckets = new Array(bucketCount).fill(0) as number[];

  for (const errorMs of errors) {
    const clamped = Math.max(-JUDGMENT_BAR_RANGE_MS, Math.min(JUDGMENT_BAR_RANGE_MS, errorMs));
    const rawIndex = Math.floor((clamped + JUDGMENT_BAR_RANGE_MS) / ERROR_HISTOGRAM_BUCKET_MS);
    const index = Math.min(bucketCount - 1, Math.max(0, rawIndex));
    buckets[index] += 1;
  }

  return buckets;
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

  const errors = tracker
    .filter((t): t is TrackedNote & { errorMs: number } => t.state === "judged" && t.errorMs !== null)
    .map((t) => t.errorMs);

  return {
    score: gameState.score,
    theoreticalMax,
    accuracyPercent,
    gradeCounts: gameState.gradeCounts,
    maxCombo: gameState.maxCombo,
    fastCount: gameState.fastCount,
    slowCount: gameState.slowCount,
    errorHistogram: computeErrorHistogram(errors),
  };
}
