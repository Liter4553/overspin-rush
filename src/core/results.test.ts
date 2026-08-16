import { describe, expect, it } from "vitest";
import { computeGradeTimingBreakdown, computeResults } from "./results";
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
    bpmChangeTicks: [{ tick: 0, bpm: 150 }],
    level: 1,
    notes,
  };
}

describe("computeGradeTimingBreakdown", () => {
  it("PERFECT+는 항상 가운데로만 집계된다(FAST/SLOW 무관)", () => {
    const chart = makeChart([{ time: 1000, lane: 0, type: "tap" }]);
    const tracker = createNoteTracker(chart);
    markJudged(tracker[0], "PERFECT_PLUS", -5);
    const breakdown = computeGradeTimingBreakdown(tracker);
    expect(breakdown.centerCount).toBe(1);
    expect(breakdown.fastCounts.PERFECT).toBe(0);
  });

  it("음수 오차(FAST)는 fastCounts에, 양수 오차(SLOW)는 slowCounts에 등급별로 쌓인다", () => {
    const chart = makeChart([
      { time: 1000, lane: 0, type: "tap" },
      { time: 2000, lane: 1, type: "tap" },
    ]);
    const tracker = createNoteTracker(chart);
    markJudged(tracker[0], "GREAT", -50);
    markJudged(tracker[1], "GOOD", 70);
    const breakdown = computeGradeTimingBreakdown(tracker);
    expect(breakdown.fastCounts.GREAT).toBe(1);
    expect(breakdown.slowCounts.GOOD).toBe(1);
  });

  it("errorMs가 없는 판정(자동 MISS)은 어느 쪽에도 집계되지 않는다", () => {
    const chart = makeChart([{ time: 1000, lane: 0, type: "tap" }]);
    const tracker = createNoteTracker(chart);
    // applyAutoMiss가 실제로 만드는 상태와 동일(grade="MISS", errorMs=null)하게 직접 구성.
    tracker[0].state = "judged";
    tracker[0].grade = "MISS";
    tracker[0].errorMs = null;
    const breakdown = computeGradeTimingBreakdown(tracker);
    expect(breakdown.fastCounts.MISS).toBe(0);
    expect(breakdown.slowCounts.MISS).toBe(0);
  });

  it("아직 판정되지 않은 노트는 집계에서 제외된다", () => {
    const chart = makeChart([
      { time: 1000, lane: 0, type: "tap" },
      { time: 2000, lane: 1, type: "tap" },
    ]);
    const tracker = createNoteTracker(chart);
    markJudged(tracker[0], "PERFECT_PLUS", 5);
    const breakdown = computeGradeTimingBreakdown(tracker);
    expect(breakdown.centerCount).toBe(1);
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

  it("결과에 등급별 가운데/빠름/느림 분포가 포함된다", () => {
    const chart = makeChart([{ time: 1000, lane: 0, type: "tap" }]);
    const tracker = createNoteTracker(chart);
    markJudged(tracker[0], "PERFECT_PLUS", 0);
    const results = computeResults(chart, createGameState(), tracker);
    expect(results.gradeTimingBreakdown.centerCount).toBe(1);
  });
});
