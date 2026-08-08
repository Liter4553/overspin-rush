import type { Chart } from "../chart/types";
import { JUDGEABLE_LANES } from "../config";

function judgeableEndTimes(chart: Chart): number[] {
  return chart.notes
    .filter((note) => JUDGEABLE_LANES.includes(note.lane))
    .map((note) => (note.type === "hold" ? note.time + (note.duration ?? 0) : note.time));
}

// 판정 대상 레인의 마지막 노트가 지나가는 시각(자동 MISS 윈도우 포함). 판정 대상
// 노트가 하나도 없으면 0 — 이 경우 isChartComplete는 별도로 즉시 완료 처리한다.
// 게임 화면의 카운트다운 타이머가 "총 길이"로도 재사용한다.
export function chartDurationMs(chart: Chart, autoMissWindowMs: number): number {
  const times = judgeableEndTimes(chart);
  if (times.length === 0) return 0;
  return Math.max(...times) + autoMissWindowMs;
}

// 판정 대상 레인(JUDGEABLE_LANES)의 노트가 전부 결판난 뒤(마지막 노트 시각 +
// 자동 MISS 윈도우)를 곡 완료로 본다. 아직 판정이 안 붙은 레인이 있다면 그 레인
// 노트는 영원히 pending이라 "모두 judged됐는지"로는 판단할 수 없어 시각 기준을 쓴다.
export function isChartComplete(
  chart: Chart,
  currentTimeMs: number,
  autoMissWindowMs: number,
): boolean {
  if (judgeableEndTimes(chart).length === 0) return true;
  return currentTimeMs > chartDurationMs(chart, autoMissWindowMs);
}
