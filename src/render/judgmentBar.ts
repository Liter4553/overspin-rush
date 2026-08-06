import type { JudgeGrade } from "../core/judge";
import {
  JUDGE_GRADE_COLORS,
  JUDGMENT_BAR_HEIGHT,
  JUDGMENT_BAR_MARGIN_TOP,
  JUDGMENT_BAR_RANGE_MS,
  JUDGMENT_TICK_FADE_MS,
  JUDGMENT_TICK_HISTORY_MAX,
  NOTE_JUDGMENT_TABLE,
} from "../config";
import type { LaneLayout } from "./canvas";

export type TickSource = "key" | "scratch";

export interface JudgmentTick {
  errorMs: number;
  grade: JudgeGrade;
  source: TickSource;
  createdAtMs: number; // 생성 시점의 게임 시간(ms). 페이드 계산 기준.
}

// 최근 N개만 유지하는 불변 추가.
export function addJudgmentTick(
  ticks: readonly JudgmentTick[],
  tick: JudgmentTick,
  max: number = JUDGMENT_TICK_HISTORY_MAX,
): JudgmentTick[] {
  const next = [...ticks, tick];
  return next.length > max ? next.slice(next.length - max) : next;
}

// source가 일치하는 틱들의 평균 오차. 없으면 null.
export function averageError(ticks: readonly JudgmentTick[], source: TickSource): number | null {
  const matched = ticks.filter((t) => t.source === source);
  if (matched.length === 0) return null;
  return matched.reduce((sum, t) => sum + t.errorMs, 0) / matched.length;
}

function errorToX(errorMs: number, barX: number, barWidth: number): number {
  const clamped = Math.max(-JUDGMENT_BAR_RANGE_MS, Math.min(JUDGMENT_BAR_RANGE_MS, errorMs));
  return barX + barWidth / 2 + (clamped / JUDGMENT_BAR_RANGE_MS) * (barWidth / 2);
}

export function drawJudgmentBar(
  ctx: CanvasRenderingContext2D,
  layout: LaneLayout,
  ticks: readonly JudgmentTick[],
  currentGameTimeMs: number,
): void {
  const barX = 0;
  const barWidth = layout.canvasWidth;
  const barY = layout.judgeLineY + JUDGMENT_BAR_MARGIN_TOP;

  // 배경: 넓은 윈도우(GOOD)부터 좁은 윈도우(PERFECT+) 순으로 겹쳐 그린다.
  for (let i = NOTE_JUDGMENT_TABLE.length - 1; i >= 0; i--) {
    const entry = NOTE_JUDGMENT_TABLE[i];
    const bandWidth = (entry.windowMs / JUDGMENT_BAR_RANGE_MS) * (barWidth / 2);
    const bandX = barX + barWidth / 2 - bandWidth;
    ctx.fillStyle = JUDGE_GRADE_COLORS[entry.grade];
    ctx.globalAlpha = 0.12;
    ctx.fillRect(bandX, barY, bandWidth * 2, JUDGMENT_BAR_HEIGHT);
  }
  ctx.globalAlpha = 1;

  // 중앙선(오차 0)
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(barX + barWidth / 2, barY);
  ctx.lineTo(barX + barWidth / 2, barY + JUDGMENT_BAR_HEIGHT);
  ctx.stroke();

  // 눈금(틱): 최근 히트 위치, 시간에 따라 페이드.
  for (const tick of ticks) {
    const age = currentGameTimeMs - tick.createdAtMs;
    if (age < 0 || age > JUDGMENT_TICK_FADE_MS) continue;
    const alpha = 1 - age / JUDGMENT_TICK_FADE_MS;
    const x = errorToX(tick.errorMs, barX, barWidth);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = JUDGE_GRADE_COLORS[tick.grade];
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (tick.source === "scratch") {
      // 스크래치 눈금은 마름모 형태로 키 입력과 구분.
      const half = 5;
      ctx.moveTo(x, barY - half);
      ctx.lineTo(x + half, barY + JUDGMENT_BAR_HEIGHT / 2);
      ctx.lineTo(x, barY + JUDGMENT_BAR_HEIGHT + half);
      ctx.lineTo(x - half, barY + JUDGMENT_BAR_HEIGHT / 2);
      ctx.closePath();
      ctx.stroke();
    } else {
      ctx.moveTo(x, barY);
      ctx.lineTo(x, barY + JUDGMENT_BAR_HEIGHT);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  // 평균 오차 마커 (키 입력 기준. 스크래치는 마일스톤 5부터 별도 집계).
  const avg = averageError(ticks, "key");
  if (avg !== null) {
    const x = errorToX(avg, barX, barWidth);
    ctx.fillStyle = "#e8eaf0";
    ctx.beginPath();
    ctx.moveTo(x, barY - 8);
    ctx.lineTo(x + 5, barY);
    ctx.lineTo(x - 5, barY);
    ctx.closePath();
    ctx.fill();
  }
}
