import { describe, expect, it } from "vitest";
import { absoluteTickToMs, barTickToAbsoluteTick, barTickToMs } from "./barTick";

describe("barTickToAbsoluteTick", () => {
  it("1마디 0틱은 절대틱 0", () => {
    expect(barTickToAbsoluteTick({ bar: 1, tick: 0 })).toBe(0);
  });

  it("2마디 0틱은 절대틱 16(마디당 16틱)", () => {
    expect(barTickToAbsoluteTick({ bar: 2, tick: 0 })).toBe(16);
  });

  it("3마디 4틱은 절대틱 36", () => {
    expect(barTickToAbsoluteTick({ bar: 3, tick: 4 })).toBe(36);
  });
});

describe("absoluteTickToMs", () => {
  it("BPM 150 고정일 때 4틱(4분음표 1박)은 400ms", () => {
    const changes = [{ tick: 0, bpm: 150 }];
    expect(absoluteTickToMs(4, changes)).toBeCloseTo(400);
  });

  it("BPM 150 고정일 때 16틱(1마디)은 1600ms", () => {
    const changes = [{ tick: 0, bpm: 150 }];
    expect(absoluteTickToMs(16, changes)).toBeCloseTo(1600);
  });

  it("BPM이 도중에 바뀌면 변경 이전 구간과 이후 구간을 각각 계산해 합산한다", () => {
    // 0~16틱: 150bpm(1마디=1600ms), 16틱부터 300bpm(4분음표=200ms)
    const changes = [
      { tick: 0, bpm: 150 },
      { tick: 16, bpm: 300 },
    ];
    expect(absoluteTickToMs(16, changes)).toBeCloseTo(1600);
    expect(absoluteTickToMs(20, changes)).toBeCloseTo(1600 + 200);
  });

  it("BPM 변경이 여러 개면 순서대로 누적한다", () => {
    const changes = [
      { tick: 0, bpm: 150 },
      { tick: 8, bpm: 150 },
      { tick: 16, bpm: 300 },
      { tick: 24, bpm: 600 },
    ];
    // 0~16틱: 150bpm -> 1600ms, 16~24틱(8틱): 300bpm -> 8*50=400ms, 24~28틱(4틱): 600bpm -> 4*25=100ms
    expect(absoluteTickToMs(28, changes)).toBeCloseTo(1600 + 400 + 100);
  });

  it("tickBpmChanges가 비어있으면 에러를 던진다", () => {
    expect(() => absoluteTickToMs(0, [])).toThrow();
  });
});

describe("barTickToMs", () => {
  it("마디:틱을 ms로 바로 변환한다", () => {
    const changes = [{ tick: 0, bpm: 150 }];
    expect(barTickToMs({ bar: 2, tick: 0 }, changes)).toBeCloseTo(1600);
  });
});
