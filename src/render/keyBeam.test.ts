import { describe, expect, it } from "vitest";
import { addKeyBeam, pruneExpiredKeyBeams } from "./keyBeam";

describe("addKeyBeam", () => {
  it("새 빔을 목록 끝에 추가한다", () => {
    const beam = { lane: 1 as const, startedAtMs: 500 };
    expect(addKeyBeam([], beam)).toEqual([beam]);
  });
});

describe("pruneExpiredKeyBeams", () => {
  const duration = 150;

  it("지속 시간 안이면 유지한다", () => {
    const beams = [{ lane: "scratch" as const, startedAtMs: 1000 }];
    expect(pruneExpiredKeyBeams(beams, 1100, duration)).toEqual(beams);
  });

  it("지속 시간을 넘기면(경계 포함) 제거한다", () => {
    const beams = [{ lane: "fx" as const, startedAtMs: 1000 }];
    expect(pruneExpiredKeyBeams(beams, 1150, duration)).toEqual([]);
    expect(pruneExpiredKeyBeams(beams, 1300, duration)).toEqual([]);
  });

  it("미래 시각(음수 age)인 빔은 걸러낸다", () => {
    const beams = [{ lane: 0 as const, startedAtMs: 1000 }];
    expect(pruneExpiredKeyBeams(beams, 900, duration)).toEqual([]);
  });

  it("여러 빔 중 만료된 것만 제거한다", () => {
    const beams = [
      { lane: 0 as const, startedAtMs: 1000 }, // age 200 -> 만료
      { lane: 1 as const, startedAtMs: 1150 }, // age 50 -> 유지
    ];
    expect(pruneExpiredKeyBeams(beams, 1200, duration)).toEqual([{ lane: 1, startedAtMs: 1150 }]);
  });
});
