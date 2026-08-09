import { describe, expect, it } from "vitest";
import { computeJudgmentTextAnimation } from "./judgmentText";

const DISPLAY_MS = 500;
const POP_MS = 90;
const FADE_MS = 200;

describe("computeJudgmentTextAnimation", () => {
  it("표시 구간 밖(음수 age)이면 null이다", () => {
    expect(computeJudgmentTextAnimation(-1, DISPLAY_MS, POP_MS, FADE_MS)).toBeNull();
  });

  it("표시 구간 밖(총 지속시간 초과)이면 null이다", () => {
    expect(computeJudgmentTextAnimation(DISPLAY_MS + 1, DISPLAY_MS, POP_MS, FADE_MS)).toBeNull();
  });

  it("등장 시점(age=0)에는 가장 크게 시작한다", () => {
    const anim = computeJudgmentTextAnimation(0, DISPLAY_MS, POP_MS, FADE_MS);
    expect(anim).not.toBeNull();
    expect(anim!.scale).toBeCloseTo(1.4, 5);
    expect(anim!.alpha).toBe(1);
  });

  it("팝인이 끝나면 스케일이 정확히 1.0으로 정착한다", () => {
    const anim = computeJudgmentTextAnimation(POP_MS, DISPLAY_MS, POP_MS, FADE_MS);
    expect(anim!.scale).toBeCloseTo(1.0, 5);
  });

  it("팝인~페이드 사이(유지 구간)에는 스케일 1.0, 알파 1 그대로다", () => {
    const anim = computeJudgmentTextAnimation(250, DISPLAY_MS, POP_MS, FADE_MS);
    expect(anim!.scale).toBe(1);
    expect(anim!.alpha).toBe(1);
  });

  it("페이드 시작 시점에는 알파가 1이다", () => {
    const fadeStart = DISPLAY_MS - FADE_MS;
    const anim = computeJudgmentTextAnimation(fadeStart, DISPLAY_MS, POP_MS, FADE_MS);
    expect(anim!.alpha).toBe(1);
  });

  it("페이드 중간에는 알파가 절반이다", () => {
    const fadeStart = DISPLAY_MS - FADE_MS;
    const anim = computeJudgmentTextAnimation(fadeStart + FADE_MS / 2, DISPLAY_MS, POP_MS, FADE_MS);
    expect(anim!.alpha).toBeCloseTo(0.5, 5);
  });

  it("총 지속시간 끝(age=displayMs)에는 알파가 0이다", () => {
    const anim = computeJudgmentTextAnimation(DISPLAY_MS, DISPLAY_MS, POP_MS, FADE_MS);
    expect(anim!.alpha).toBe(0);
  });
});
