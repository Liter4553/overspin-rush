import { describe, expect, it } from "vitest";
import { computeLaneLayout } from "./canvas";
import { CANVAS_HEIGHT, JUDGE_LINE_MARGIN_BOTTOM } from "../config";

describe("computeLaneLayout", () => {
  it("보통 폭(480)에서 스크래치가 오른쪽이면 노트 레인이 0부터 시작한다", () => {
    const layout = computeLaneLayout(480, "right", JUDGE_LINE_MARGIN_BOTTOM);
    expect(layout.noteLaneWidth).toBeCloseTo(115);
    expect(layout.scratchLaneWidth).toBeCloseTo(135);
    expect(layout.noteLaneX).toEqual([0, 115, 230]);
    expect(layout.scratchLaneX).toBeCloseTo(345);
    expect(layout.scratchLaneX + layout.scratchLaneWidth).toBeCloseTo(480);
  });

  it("스크래치가 왼쪽이면 노트 레인이 스크래치 레인 폭만큼 밀린다", () => {
    const layout = computeLaneLayout(480, "left", JUDGE_LINE_MARGIN_BOTTOM);
    expect(layout.scratchLaneX).toBe(0);
    expect(layout.noteLaneX[0]).toBeCloseTo(135);
  });

  it("어느 폭이든 스크래치 레인 폭은 노트 레인 폭보다 정확히 20px 넓다", () => {
    for (const width of [336, 480, 624]) {
      const layout = computeLaneLayout(width, "right", JUDGE_LINE_MARGIN_BOTTOM);
      expect(layout.scratchLaneWidth - layout.noteLaneWidth).toBeCloseTo(20);
    }
  });

  it("판정선 위치는 캔버스 하단에서 지정한 마진만큼 떨어진다", () => {
    const layout = computeLaneLayout(480, "right", 200);
    expect(layout.judgeLineY).toBe(CANVAS_HEIGHT - 200);
  });
});
