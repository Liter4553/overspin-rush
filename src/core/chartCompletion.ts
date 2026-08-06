import type { Chart } from "../chart/types";
import { JUDGEABLE_LANES } from "../config";

// 판정 대상 레인(JUDGEABLE_LANES)의 노트가 전부 결판난 뒤(마지막 노트 시각 +
// 자동 MISS 윈도우)를 곡 완료로 본다. FX/스크래치처럼 아직 판정이 붙지 않은
// 레인은 영원히 pending이라 "모두 judged됐는지"로는 판단할 수 없다.
export function isChartComplete(
  chart: Chart,
  currentTimeMs: number,
  autoMissWindowMs: number,
): boolean {
  const judgeableTimes = chart.notes
    .filter((note) => JUDGEABLE_LANES.includes(note.lane))
    .map((note) => note.time);

  if (judgeableTimes.length === 0) return true;

  const lastTime = Math.max(...judgeableTimes);
  return currentTimeMs > lastTime + autoMissWindowMs;
}
