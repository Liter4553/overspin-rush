import type { NoteLane } from "../chart/types";
import { KEY_BEAM_DURATION_MS, KEY_BEAM_LENGTH_PX } from "../config";
import type { LaneLayout } from "./canvas";
import type { NoteColors } from "./noteRenderer";

export interface KeyBeam {
  lane: NoteLane;
  startedAtMs: number; // 생성 시점의 게임 시간(ms).
}

// 판정 성공 여부와 무관하게 입력 자체에 대한 피드백이라, 히트 이펙트(hitEffect.ts)와
// 달리 판정 결과를 받지 않는다 — 키를 누르거나 스크래치가 유효하게 인식된 순간 호출.
export function addKeyBeam(beams: readonly KeyBeam[], beam: KeyBeam): KeyBeam[] {
  return [...beams, beam];
}

export function pruneExpiredKeyBeams(
  beams: readonly KeyBeam[],
  currentTimeMs: number,
  durationMs: number = KEY_BEAM_DURATION_MS,
): KeyBeam[] {
  return beams.filter((b) => {
    const age = currentTimeMs - b.startedAtMs;
    return age >= 0 && age < durationMs;
  });
}

function laneRegion(layout: LaneLayout, lane: NoteLane): { x: number; width: number } {
  if (lane === "scratch") return { x: layout.scratchLaneX, width: layout.scratchLaneWidth };
  if (lane === "fx") return { x: layout.noteLaneX[0], width: layout.noteLaneWidth * layout.noteLaneX.length };
  return { x: layout.noteLaneX[lane], width: layout.noteLaneWidth };
}

function laneColor(colors: NoteColors, lane: NoteLane): string {
  if (lane === "fx") return colors.fxColor;
  if (lane === "scratch") return colors.scratchColor;
  return colors.noteColor;
}

// 판정선에서 위로 뻗어 올라가는 그라디언트 빛줄기. 노트 히트 이펙트와 마찬가지로
// 판정선을 그린 다음(이펙트 단계)에 호출해야 한다.
export function drawKeyBeams(
  ctx: CanvasRenderingContext2D,
  layout: LaneLayout,
  beams: readonly KeyBeam[],
  currentTimeMs: number,
  colors: NoteColors,
  durationMs: number = KEY_BEAM_DURATION_MS,
): void {
  for (const beam of beams) {
    const age = currentTimeMs - beam.startedAtMs;
    if (age < 0 || age >= durationMs) continue;
    const alpha = 1 - age / durationMs;
    const { x, width } = laneRegion(layout, beam.lane);
    const top = layout.judgeLineY - KEY_BEAM_LENGTH_PX;

    const gradient = ctx.createLinearGradient(0, top, 0, layout.judgeLineY);
    gradient.addColorStop(0, "rgba(255,255,255,0)");
    gradient.addColorStop(1, laneColor(colors, beam.lane));

    ctx.save();
    ctx.globalAlpha = alpha * 0.85;
    ctx.fillStyle = gradient;
    ctx.fillRect(x, top, width, KEY_BEAM_LENGTH_PX);
    ctx.restore();
  }
}
