import { describe, expect, it } from "vitest";
import { computeErrorMs, displaySign, judge, timingSign } from "./judge";
import { NOTE_JUDGMENT_TABLE, SCRATCH_JUDGMENT_TABLE } from "../config";

describe("judge - 노트 판정 경계값 (SPEC.md 9절)", () => {
  const cases: [number, string, number][] = [
    [19, "PERFECT_PLUS", 4],
    [20, "PERFECT_PLUS", 4],
    [21, "PERFECT", 3],
    [39, "PERFECT", 3],
    [40, "PERFECT", 3],
    [41, "GREAT", 2],
    [59, "GREAT", 2],
    [60, "GREAT", 2],
    [61, "GOOD", 1],
    [79, "GOOD", 1],
    [80, "GOOD", 1],
    [81, "MISS", 0],
  ];

  for (const [absErrorMs, grade, score] of cases) {
    it(`|오차|=${absErrorMs}ms -> ${grade}(${score}점)`, () => {
      const result = judge(absErrorMs, NOTE_JUDGMENT_TABLE);
      expect(result.grade).toBe(grade);
      expect(result.score).toBe(score);
    });
  }

  it("패스트(음수) 쪽도 절대값 기준으로 대칭 동작한다", () => {
    expect(judge(Math.abs(-20), NOTE_JUDGMENT_TABLE)).toEqual({ grade: "PERFECT_PLUS", score: 4 });
    expect(judge(Math.abs(-41), NOTE_JUDGMENT_TABLE)).toEqual({ grade: "GREAT", score: 2 });
    expect(judge(Math.abs(-81), NOTE_JUDGMENT_TABLE)).toEqual({ grade: "MISS", score: 0 });
  });
});

describe("judge - 스크래치 판정", () => {
  it("30ms는 PERFECT+(4점)이다 (노트 테이블이었다면 PERFECT)", () => {
    expect(judge(30, SCRATCH_JUDGMENT_TABLE)).toEqual({ grade: "PERFECT_PLUS", score: 4 });
  });

  it("41ms는 GREAT(2점)이다 - PERFECT 등급이 존재하지 않는다", () => {
    expect(judge(41, SCRATCH_JUDGMENT_TABLE)).toEqual({ grade: "GREAT", score: 2 });
  });

  it("스크래치 테이블에서는 절대 3점(PERFECT)이 나오지 않는다", () => {
    const possibleScores = new Set(SCRATCH_JUDGMENT_TABLE.map((e) => e.score));
    expect(possibleScores.has(3)).toBe(false);
  });

  it("40ms는 PERFECT+, 60/80 경계도 노트와 동일하게 동작한다", () => {
    expect(judge(40, SCRATCH_JUDGMENT_TABLE)).toEqual({ grade: "PERFECT_PLUS", score: 4 });
    expect(judge(60, SCRATCH_JUDGMENT_TABLE)).toEqual({ grade: "GREAT", score: 2 });
    expect(judge(80, SCRATCH_JUDGMENT_TABLE)).toEqual({ grade: "GOOD", score: 1 });
    expect(judge(81, SCRATCH_JUDGMENT_TABLE)).toEqual({ grade: "MISS", score: 0 });
  });
});

describe("judge - 두 테이블이 섞이지 않는다", () => {
  it("동일한 오차 30ms가 노트=PERFECT(3점), 스크래치=PERFECT+(4점)로 다르게 나온다", () => {
    expect(judge(30, NOTE_JUDGMENT_TABLE)).toEqual({ grade: "PERFECT", score: 3 });
    expect(judge(30, SCRATCH_JUDGMENT_TABLE)).toEqual({ grade: "PERFECT_PLUS", score: 4 });
  });
});

describe("timingSign", () => {
  it("음수는 FAST", () => {
    expect(timingSign(-30)).toBe("FAST");
  });
  it("양수는 SLOW", () => {
    expect(timingSign(30)).toBe("SLOW");
  });
  it("0은 FAST도 SLOW도 아니다(null)", () => {
    expect(timingSign(0)).toBeNull();
  });
});

describe("displaySign - PERFECT+는 정타 취급이라 항상 표시 안 함", () => {
  it("PERFECT+ 등급이면 오차가 0이 아니어도 null을 반환한다", () => {
    expect(displaySign("PERFECT_PLUS", -15)).toBeNull();
    expect(displaySign("PERFECT_PLUS", 20)).toBeNull();
  });

  it("스크래치 PERFECT+(40ms 범위)도 동일하게 null이다", () => {
    expect(displaySign("PERFECT_PLUS", 35)).toBeNull();
  });

  it("PERFECT+가 아니면 timingSign과 동일하게 동작한다", () => {
    expect(displaySign("GREAT", -45)).toBe("FAST");
    expect(displaySign("GOOD", 70)).toBe("SLOW");
    expect(displaySign("MISS", 0)).toBeNull();
  });
});

describe("computeErrorMs", () => {
  it("오프셋이 0이면 입력시각-노트시각 그대로다", () => {
    expect(computeErrorMs(1030, 1000, 0, 0)).toBe(30);
    expect(computeErrorMs(970, 1000, 0, 0)).toBe(-30);
  });

  it("오디오 오프셋은 노트 시각을, 입력 오프셋은 입력 시각을 보정한다", () => {
    expect(computeErrorMs(1000, 1000, 10, 0)).toBe(-10);
    expect(computeErrorMs(1000, 1000, 0, 10)).toBe(10);
  });
});
