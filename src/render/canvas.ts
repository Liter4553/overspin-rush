import {
  CANVAS_HEIGHT,
  JUDGE_LINE_MARGIN_BOTTOM,
  LANE_COUNT,
  SCRATCH_WIDTH_EXTRA,
  type ScratchSide,
} from "../config";

export interface LaneLayout {
  canvasWidth: number;
  canvasHeight: number;
  noteLaneWidth: number;
  scratchLaneWidth: number;
  // 노트 레인 0/1/2 각각의 left x좌표.
  noteLaneX: readonly number[];
  scratchLaneX: number;
  judgeLineY: number;
}

// 캔버스 폭과 스크래치 레인 위치로부터 각 레인의 x좌표를 계산하는 순수 함수.
// 스크래치 레인 폭 = 노트 레인 폭 + SCRATCH_WIDTH_EXTRA (SPEC.md 2절).
export function computeLaneLayout(canvasWidth: number, scratchSide: ScratchSide): LaneLayout {
  const noteLaneWidth = (canvasWidth - SCRATCH_WIDTH_EXTRA) / (LANE_COUNT + 1);
  const scratchLaneWidth = noteLaneWidth + SCRATCH_WIDTH_EXTRA;
  const noteRegionX = scratchSide === "left" ? scratchLaneWidth : 0;
  const scratchLaneX = scratchSide === "left" ? 0 : noteRegionX + LANE_COUNT * noteLaneWidth;

  const noteLaneX = Array.from({ length: LANE_COUNT }, (_, i) => noteRegionX + i * noteLaneWidth);

  return {
    canvasWidth,
    canvasHeight: CANVAS_HEIGHT,
    noteLaneWidth,
    scratchLaneWidth,
    noteLaneX,
    scratchLaneX,
    judgeLineY: CANVAS_HEIGHT - JUDGE_LINE_MARGIN_BOTTOM,
  };
}
