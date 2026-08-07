import {
  FX_OPACITY,
  JUDGE_LINE_COLOR,
  LANE_DIVIDER_COLOR,
  NOTE_HEIGHT,
  NOTE_INSET,
  SCRATCH_DIAMOND_INSET_RATIO,
  SCRATCH_LANE_TINT_COLOR,
  SCRATCH_LANE_TINT_OPACITY,
} from "../config";
import type { ChartNote } from "../chart/types";
import { noteY } from "../core/scroll";
import type { LaneLayout } from "./canvas";

// 노트 스킨 팔레트가 실제로 렌더링에 쓰는 색 3가지. 나머지(오파시티, 레인 틴트 등)는
// 커스터마이즈 대상이 아니라 고정 상수로 남긴다(SPEC.md 6절 — 노트 스킨 색상만 옵션).
export interface NoteColors {
  noteColor: string;
  fxColor: string;
  scratchColor: string;
}

// 렌더 순서(SPEC.md 3절): 레인 배경 → FX 노트 → 일반 노트 → 판정선 → 이펙트(추후).
// 아래 draw 함수들은 이 순서로 호출되어야 FX 바가 일반 노트에 가려지지 않는다.

export function drawLaneBackground(ctx: CanvasRenderingContext2D, layout: LaneLayout): void {
  ctx.fillStyle = SCRATCH_LANE_TINT_COLOR;
  ctx.globalAlpha = SCRATCH_LANE_TINT_OPACITY;
  ctx.fillRect(layout.scratchLaneX, 0, layout.scratchLaneWidth, layout.canvasHeight);
  ctx.globalAlpha = 1;

  ctx.strokeStyle = LANE_DIVIDER_COLOR;
  ctx.lineWidth = 1;
  const dividerXs = [...layout.noteLaneX.slice(1), layout.scratchLaneX];
  for (const x of dividerXs) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, layout.canvasHeight);
    ctx.stroke();
  }
}

function fxBarY(note: ChartNote, currentTimeMs: number, greenNumberMs: number, judgeLineY: number): number {
  const endTime = note.type === "hold" ? note.time + (note.duration ?? 0) : note.time;
  return noteY(endTime, currentTimeMs, greenNumberMs, judgeLineY);
}

export function drawFxNotes(
  ctx: CanvasRenderingContext2D,
  layout: LaneLayout,
  notes: ChartNote[],
  currentTimeMs: number,
  greenNumberMs: number,
  colors: NoteColors,
): void {
  const fxRegionX = layout.noteLaneX[0];
  const fxRegionWidth = layout.noteLaneWidth * layout.noteLaneX.length;

  ctx.fillStyle = colors.fxColor;
  ctx.globalAlpha = FX_OPACITY;
  for (const note of notes) {
    if (note.lane !== "fx") continue;
    const y = fxBarY(note, currentTimeMs, greenNumberMs, layout.judgeLineY);
    ctx.fillRect(fxRegionX, y - NOTE_HEIGHT / 2, fxRegionWidth, NOTE_HEIGHT);
  }
  ctx.globalAlpha = 1;
}

function drawNoteRect(ctx: CanvasRenderingContext2D, x: number, width: number, topY: number, bottomY: number, color: string): void {
  const height = Math.max(NOTE_HEIGHT, bottomY - topY);
  const radius = Math.min(8, width / 2, height / 2);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, topY, width, height, radius);
  ctx.fill();
}

export function drawNotes(
  ctx: CanvasRenderingContext2D,
  layout: LaneLayout,
  notes: ChartNote[],
  currentTimeMs: number,
  greenNumberMs: number,
  colors: NoteColors,
): void {
  for (const note of notes) {
    if (note.lane === "fx") continue;

    if (note.lane === "scratch") {
      // 스크래치는 홀드를 지원하지 않는다(parseChart에서 이미 거부).
      // 일반 노트와 형태를 통일하기 위해 사각 프레임 안에 마름모를 그린다.
      const y = noteY(note.time, currentTimeMs, greenNumberMs, layout.judgeLineY);
      const frameWidth = layout.scratchLaneWidth - NOTE_INSET * 2;
      const frameX = layout.scratchLaneX + NOTE_INSET;
      const frameY = y - NOTE_HEIGHT / 2;
      const frameRadius = Math.min(8, frameWidth / 2, NOTE_HEIGHT / 2);

      ctx.beginPath();
      ctx.roundRect(frameX, frameY, frameWidth, NOTE_HEIGHT, frameRadius);
      ctx.fillStyle = colors.scratchColor;
      ctx.globalAlpha = 0.18;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = colors.scratchColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      const cx = frameX + frameWidth / 2;
      const half = (NOTE_HEIGHT / 2) * (1 - SCRATCH_DIAMOND_INSET_RATIO);
      ctx.fillStyle = colors.scratchColor;
      ctx.beginPath();
      ctx.moveTo(cx, y - half);
      ctx.lineTo(cx + half, y);
      ctx.lineTo(cx, y + half);
      ctx.lineTo(cx - half, y);
      ctx.closePath();
      ctx.fill();
      continue;
    }

    const laneX = layout.noteLaneX[note.lane];
    const x = laneX + NOTE_INSET;
    const width = layout.noteLaneWidth - NOTE_INSET * 2;

    if (note.type === "hold") {
      const startY = noteY(note.time, currentTimeMs, greenNumberMs, layout.judgeLineY);
      const endY = noteY(note.time + (note.duration ?? 0), currentTimeMs, greenNumberMs, layout.judgeLineY);
      drawNoteRect(ctx, x, width, endY, startY, colors.noteColor);
    } else {
      const y = noteY(note.time, currentTimeMs, greenNumberMs, layout.judgeLineY);
      drawNoteRect(ctx, x, width, y - NOTE_HEIGHT / 2, y + NOTE_HEIGHT / 2, colors.noteColor);
    }
  }
}

export function drawJudgeLine(ctx: CanvasRenderingContext2D, layout: LaneLayout): void {
  ctx.strokeStyle = JUDGE_LINE_COLOR;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, layout.judgeLineY);
  ctx.lineTo(layout.canvasWidth, layout.judgeLineY);
  ctx.stroke();
}
