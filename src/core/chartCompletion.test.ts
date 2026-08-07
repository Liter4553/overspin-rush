import { describe, expect, it } from "vitest";
import { isChartComplete } from "./chartCompletion";
import type { Chart } from "../chart/types";

function makeChart(notes: Chart["notes"]): Chart {
  return {
    version: 1,
    title: "t",
    artist: "a",
    audio: "",
    offset: 0,
    bpmChanges: [{ time: 0, bpm: 150 }],
    level: 1,
    notes,
  };
}

describe("isChartComplete", () => {
  it("마지막 판정 대상 노트 시각 + 윈도우를 넘기 전까지는 완료가 아니다", () => {
    const chart = makeChart([{ time: 1000, lane: 0, type: "tap" }]);
    expect(isChartComplete(chart, 1080, 80)).toBe(false);
  });

  it("윈도우를 넘기면 완료다", () => {
    const chart = makeChart([{ time: 1000, lane: 0, type: "tap" }]);
    expect(isChartComplete(chart, 1081, 80)).toBe(true);
  });

  it("판정 대상이 아닌 레인(fx)의 늦은 노트는 완료 판정에 영향을 주지 않는다", () => {
    const chart = makeChart([
      { time: 1000, lane: 0, type: "tap" },
      { time: 9000, lane: "fx", type: "tap" },
    ]);
    expect(isChartComplete(chart, 1081, 80)).toBe(true);
  });

  it("스크래치는 이제 판정 대상이라 완료 판정에 포함된다", () => {
    const chart = makeChart([
      { time: 1000, lane: 0, type: "tap" },
      { time: 9500, lane: "scratch", type: "tap" },
    ]);
    expect(isChartComplete(chart, 1081, 80)).toBe(false);
    expect(isChartComplete(chart, 9581, 80)).toBe(true);
  });

  it("판정 대상 노트가 하나도 없으면 즉시 완료다", () => {
    const chart = makeChart([{ time: 1000, lane: "fx", type: "tap" }]);
    expect(isChartComplete(chart, 0, 80)).toBe(true);
  });

  it("홀드 노트는 시작 시각이 아니라 종료 시각(time+duration) 기준으로 완료를 판단한다", () => {
    const chart = makeChart([{ time: 1000, lane: 0, type: "hold", duration: 2000 }]);
    // 시작(1000) + 자동미스 윈도우(80)는 지났지만 홀드가 아직 끝나지 않았다(3000까지).
    expect(isChartComplete(chart, 1081, 80)).toBe(false);
    expect(isChartComplete(chart, 3081, 80)).toBe(true);
  });
});
