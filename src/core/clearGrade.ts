// 결과 등급 산출. 렌더링/DOM과 완전히 분리된 순수 함수로만 구성한다 (SPEC.md 10절).
import type { Chart } from "../chart/types";
import type { GameState } from "./gameState";
import { isCleared, type GaugeState } from "./gauge";
import { countJudgeableNotes } from "./results";

export type ClearGrade = "FAILED" | "CLEAR" | "HARD_CLEAR" | "CHALLENGE_CLEAR" | "FULL_COMBO" | "PERFECT";

// gaugeState는 곡 종료 시점의 최종 게이지(GAS로 전환됐다면 이미 type이 "normal"로 바뀐
// 뒤이므로, HARD_CLEAR/CHALLENGE_CLEAR는 자연스럽게 나오지 않고 CLEAR로 떨어진다 —
// "GAS로 구제된 플레이는 HARD/CHALLENGE 마크를 획득할 수 없다"는 규칙이 별도 분기 없이 성립).
export function computeClearGrade(chart: Chart, gameState: GameState, gaugeState: GaugeState): ClearGrade {
  if (!isCleared(gaugeState)) return "FAILED";

  const totalJudged = countJudgeableNotes(chart);
  if (totalJudged > 0 && gameState.gradeCounts.PERFECT_PLUS === totalJudged) return "PERFECT";
  if (gameState.gradeCounts.MISS === 0) return "FULL_COMBO";

  if (gaugeState.type === "hard") return "HARD_CLEAR";
  if (gaugeState.type === "challenge") return "CHALLENGE_CLEAR";
  return "CLEAR";
}
