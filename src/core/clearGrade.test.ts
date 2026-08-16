import { describe, expect, it } from "vitest";
import { computeClearGrade } from "./clearGrade";
import { createGameState, type GameState } from "./gameState";
import { createGaugeState, type GaugeState } from "./gauge";
import type { Chart } from "../chart/types";

function makeChart(noteCount: number): Chart {
  return {
    version: 1,
    title: "t",
    artist: "a",
    audio: "",
    offset: 0,
    bpmChanges: [{ time: 0, bpm: 150 }],
    bpmChangeTicks: [{ tick: 0, bpm: 150 }],
    level: 1,
    notes: Array.from({ length: noteCount }, (_, i) => ({ time: i * 400, lane: 0 as const, type: "tap" as const })),
  };
}

function makeGameState(overrides: Partial<GameState["gradeCounts"]>): GameState {
  const state = createGameState();
  return { ...state, gradeCounts: { ...state.gradeCounts, ...overrides } };
}

describe("computeClearGrade", () => {
  it("게이지가 클리어 조건을 못 채우면 FAILED다", () => {
    const gauge: GaugeState = { type: "normal", value: 40, dead: false }; // 보더 70% 미달
    const grade = computeClearGrade(makeChart(10), makeGameState({ GREAT: 10 }), gauge);
    expect(grade).toBe("FAILED");
  });

  it("서바이벌형이 폭사했으면 FAILED다", () => {
    const gauge: GaugeState = { type: "hard", value: 0, dead: true };
    const grade = computeClearGrade(makeChart(10), makeGameState({ GREAT: 10 }), gauge);
    expect(grade).toBe("FAILED");
  });

  it("미스가 없으면 등급이 섞여 있어도 CLEAR보다 FULL_COMBO가 우선한다", () => {
    const gauge: GaugeState = { type: "normal", value: 80, dead: false };
    const grade = computeClearGrade(makeChart(10), makeGameState({ PERFECT_PLUS: 5, GREAT: 5 }), gauge);
    expect(grade).toBe("FULL_COMBO");
  });

  it("미스가 하나라도 섞이면 CLEAR로만 판정된다(NORMAL)", () => {
    const gauge: GaugeState = { type: "normal", value: 75, dead: false };
    const grade = computeClearGrade(makeChart(10), makeGameState({ PERFECT_PLUS: 5, GREAT: 4, MISS: 1 }), gauge);
    expect(grade).toBe("CLEAR");
  });

  it("HARD 타입으로 완주(미스 포함)하면 HARD_CLEAR다", () => {
    const gauge: GaugeState = { type: "hard", value: 40, dead: false };
    const grade = computeClearGrade(makeChart(10), makeGameState({ PERFECT_PLUS: 5, GREAT: 4, MISS: 1 }), gauge);
    expect(grade).toBe("HARD_CLEAR");
  });

  it("CHALLENGE 타입으로 완주(미스 포함)하면 CHALLENGE_CLEAR다", () => {
    const gauge: GaugeState = { type: "challenge", value: 20, dead: false };
    const grade = computeClearGrade(makeChart(10), makeGameState({ PERFECT_PLUS: 5, GREAT: 4, MISS: 1 }), gauge);
    expect(grade).toBe("CHALLENGE_CLEAR");
  });

  it("미스 없이 완주하면 등급과 무관하게 FULL_COMBO다", () => {
    const gauge: GaugeState = { type: "hard", value: 10, dead: false };
    const grade = computeClearGrade(makeChart(10), makeGameState({ PERFECT_PLUS: 3, PERFECT: 3, GOOD: 4 }), gauge);
    expect(grade).toBe("FULL_COMBO");
  });

  it("전 노트 퍼펙+면 PERFECT다", () => {
    const gauge: GaugeState = { type: "normal", value: 100, dead: false };
    const grade = computeClearGrade(makeChart(10), makeGameState({ PERFECT_PLUS: 10 }), gauge);
    expect(grade).toBe("PERFECT");
  });

  it("GAS로 전환된 게이지(type이 normal로 바뀐 상태)는 미스가 섞였다면 HARD_CLEAR가 아니라 CLEAR다", () => {
    // gauge.ts의 릴레이 전환 로직은 폭사 시 primary.type을 "normal"로 바꾸므로,
    // 여기서는 그 결과 상태만 흉내낸다 — 별도 분기 없이 CLEAR로 떨어져야 한다.
    const relayedGauge = createGaugeState("normal");
    const gauge: GaugeState = { ...relayedGauge, value: 75 };
    const grade = computeClearGrade(makeChart(10), makeGameState({ PERFECT_PLUS: 5, GREAT: 4, MISS: 1 }), gauge);
    expect(grade).toBe("CLEAR");
  });
});
