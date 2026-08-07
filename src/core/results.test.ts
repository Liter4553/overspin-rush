import { describe, expect, it } from "vitest";
import { computeErrorHistogram, computeResults } from "./results";
import { createGameState, applyJudgement } from "./gameState";
import { createNoteTracker, markJudged } from "./noteState";
import { displaySign, judge } from "./judge";
import { NOTE_JUDGMENT_TABLE } from "../config";
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

describe("computeErrorHistogram", () => {
  it("오차값을 10ms 버킷에 채운다", () => {
    const histogram = computeErrorHistogram([-75, -15, 0, 15, 75]);
    expect(histogram.reduce((a, b) => a + b, 0)).toBe(5);
    expect(histogram.length).toBe(16); // (80*2)/10
  });

  it("범위를 넘는 값은 가장 바깥 버킷으로 클램프된다", () => {
    const histogram = computeErrorHistogram([-999, 999]);
    expect(histogram[0]).toBe(1);
    expect(histogram[histogram.length - 1]).toBe(1);
  });
});

describe("computeResults", () => {
  it("판정 대상(A/S/D+FX+스크래치) 노트 개수 기준으로 이론치를 계산한다 (마일스톤 7부터 FX도 포함)", () => {
    const chart = makeChart([
      { time: 1000, lane: 0, type: "tap" },
      { time: 1500, lane: 1, type: "tap" },
      { time: 2000, lane: "fx", type: "tap" },
      { time: 2500, lane: "scratch", type: "tap" },
    ]);
    const results = computeResults(chart, createGameState(), createNoteTracker(chart));
    expect(results.theoreticalMax).toBe(4 * 4); // 노트 2개 + FX 1개 + 스크래치 1개
  });

  it("만점 시 정확도가 100%다", () => {
    const chart = makeChart([
      { time: 1000, lane: 0, type: "tap" },
      { time: 2000, lane: 1, type: "tap" },
    ]);
    const tracker = createNoteTracker(chart);
    let state = createGameState();
    for (const t of tracker) {
      const errorMs = 0;
      const result = judge(0, NOTE_JUDGMENT_TABLE);
      const sign = displaySign(result.grade, errorMs);
      markJudged(t, result.grade, errorMs);
      state = applyJudgement(state, result.grade, result.score, sign);
    }
    const results = computeResults(chart, state, tracker);
    expect(results.accuracyPercent).toBe(100);
    expect(results.score).toBe(8);
  });

  it("전멸(MISS)이면 정확도가 0%다", () => {
    const chart = makeChart([{ time: 1000, lane: 0, type: "tap" }]);
    const tracker = createNoteTracker(chart);
    let state = createGameState();
    markJudged(tracker[0], "MISS", 0);
    state = applyJudgement(state, "MISS", 0, null);
    const results = computeResults(chart, state, tracker);
    expect(results.accuracyPercent).toBe(0);
  });

  it("아직 판정되지 않은(errorMs=null) 노트는 히스토그램에서 제외된다", () => {
    const chart = makeChart([
      { time: 1000, lane: 0, type: "tap" },
      { time: 2000, lane: 1, type: "tap" },
    ]);
    const tracker = createNoteTracker(chart);
    markJudged(tracker[0], "PERFECT_PLUS", 5);
    const results = computeResults(chart, createGameState(), tracker);
    expect(results.errorHistogram.reduce((a, b) => a + b, 0)).toBe(1);
  });
});
