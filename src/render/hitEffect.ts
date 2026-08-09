import type { JudgeGrade } from "../core/judge";
import type { NoteLane } from "../chart/types";
import { HIT_EFFECT_DURATION_MS, JUDGE_GRADE_COLORS, NOTE_HEIGHT } from "../config";
import type { LaneLayout } from "./canvas";

export interface HitEffect {
  lane: NoteLane;
  grade: JudgeGrade;
  startedAtMs: number; // 생성 시점의 게임 시간(ms).
}

// MISS는 "맞춘" 게 아니라서 이펙트를 만들지 않는다 — null을 반환해 호출부에서 걸러낸다.
export function createHitEffect(lane: NoteLane, grade: JudgeGrade, startedAtMs: number): HitEffect | null {
  if (grade === "MISS") return null;
  return { lane, grade, startedAtMs };
}

export function addHitEffect(effects: readonly HitEffect[], effect: HitEffect | null): HitEffect[] {
  if (effect === null) return [...effects];
  return [...effects, effect];
}

export function pruneExpiredHitEffects(
  effects: readonly HitEffect[],
  currentTimeMs: number,
  durationMs: number = HIT_EFFECT_DURATION_MS,
): HitEffect[] {
  return effects.filter((e) => {
    const age = currentTimeMs - e.startedAtMs;
    return age >= 0 && age < durationMs;
  });
}

function laneRegion(layout: LaneLayout, lane: NoteLane): { x: number; width: number } {
  if (lane === "scratch") return { x: layout.scratchLaneX, width: layout.scratchLaneWidth };
  if (lane === "fx") return { x: layout.noteLaneX[0], width: layout.noteLaneWidth * layout.noteLaneX.length };
  return { x: layout.noteLaneX[lane], width: layout.noteLaneWidth };
}

// 판정선 위치에서 위아래로 살짝 번지며 옅어지는 플래시. 렌더 순서상 판정선을 그린
// 다음에 호출해야 한다(noteRenderer.ts 상단 주석의 "이펙트" 단계).
export function drawHitEffects(
  ctx: CanvasRenderingContext2D,
  layout: LaneLayout,
  effects: readonly HitEffect[],
  currentTimeMs: number,
  durationMs: number = HIT_EFFECT_DURATION_MS,
): void {
  for (const effect of effects) {
    const age = currentTimeMs - effect.startedAtMs;
    if (age < 0 || age >= durationMs) continue;
    const progress = age / durationMs;
    const { x, width } = laneRegion(layout, effect.lane);
    const spread = NOTE_HEIGHT * (1 + progress * 1.8);

    ctx.save();
    ctx.globalAlpha = (1 - progress) * 0.8;
    ctx.fillStyle = JUDGE_GRADE_COLORS[effect.grade];
    ctx.fillRect(x, layout.judgeLineY - spread / 2, width, spread);
    ctx.restore();
  }
}
