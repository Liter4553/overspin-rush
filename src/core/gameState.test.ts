import { describe, expect, it } from "vitest";
import { applyHoldTick, applyJudgement, createGameState } from "./gameState";

describe("applyJudgement", () => {
  it("점수를 누적한다", () => {
    let state = createGameState();
    state = applyJudgement(state, "PERFECT_PLUS", 4, null);
    state = applyJudgement(state, "GREAT", 2, "FAST");
    expect(state.score).toBe(6);
  });

  it("MISS가 아니면(GOOD 포함) 콤보가 유지/증가한다", () => {
    let state = createGameState();
    state = applyJudgement(state, "PERFECT_PLUS", 4, null);
    state = applyJudgement(state, "GOOD", 1, "SLOW");
    expect(state.combo).toBe(2);
  });

  it("MISS에서만 콤보가 끊긴다", () => {
    let state = createGameState();
    state = applyJudgement(state, "PERFECT_PLUS", 4, null);
    state = applyJudgement(state, "PERFECT_PLUS", 4, null);
    state = applyJudgement(state, "MISS", 0, null);
    expect(state.combo).toBe(0);
  });

  it("맥스 콤보는 감소하지 않는다", () => {
    let state = createGameState();
    state = applyJudgement(state, "GREAT", 2, "FAST");
    state = applyJudgement(state, "GREAT", 2, "FAST");
    state = applyJudgement(state, "MISS", 0, null);
    expect(state.combo).toBe(0);
    expect(state.maxCombo).toBe(2);
  });

  it("판정별 카운트를 집계한다", () => {
    let state = createGameState();
    state = applyJudgement(state, "GOOD", 1, "SLOW");
    state = applyJudgement(state, "GOOD", 1, "FAST");
    state = applyJudgement(state, "MISS", 0, null);
    expect(state.gradeCounts.GOOD).toBe(2);
    expect(state.gradeCounts.MISS).toBe(1);
  });

  it("FAST/SLOW 카운트를 부호 기준으로 집계하고 PERFECT+(null)는 어느 쪽에도 안 들어간다", () => {
    let state = createGameState();
    state = applyJudgement(state, "PERFECT_PLUS", 4, null);
    state = applyJudgement(state, "GREAT", 2, "FAST");
    state = applyJudgement(state, "GOOD", 1, "SLOW");
    expect(state.fastCount).toBe(1);
    expect(state.slowCount).toBe(1);
  });
});

describe("applyHoldTick", () => {
  it("콤보만 증가시키고 점수/판정 집계/FAST-SLOW는 그대로 둔다", () => {
    let state = createGameState();
    state = applyJudgement(state, "PERFECT_PLUS", 4, null);
    state = applyHoldTick(state);
    expect(state.combo).toBe(2);
    expect(state.score).toBe(4);
    expect(state.gradeCounts.PERFECT_PLUS).toBe(1);
    expect(state.fastCount).toBe(0);
    expect(state.slowCount).toBe(0);
  });

  it("맥스 콤보를 갱신한다", () => {
    let state = createGameState();
    state = applyHoldTick(state);
    state = applyHoldTick(state);
    expect(state.maxCombo).toBe(2);
  });
});
