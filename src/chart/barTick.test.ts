import { describe, expect, it } from "vitest";
import { absoluteTickToMs, barTickToAbsoluteTick, barTickToMs } from "./barTick";
import { absoluteTickToBarTick, signatureAtBar, ticksPerMeasure } from "./timeSignature";

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

  // 박자표에 따라 마디 길이가 달라진다. 1틱=16분음표는 그대로다.
  it("3/4에서는 마디당 12틱이라 2마디 0틱이 절대틱 12", () => {
    const sig = [{ bar: 1, numerator: 3, denominator: 4 }];
    expect(barTickToAbsoluteTick({ bar: 2, tick: 0 }, sig)).toBe(12);
    expect(barTickToAbsoluteTick({ bar: 3, tick: 0 }, sig)).toBe(24);
  });

  it("7/8에서는 마디당 14틱", () => {
    expect(barTickToAbsoluteTick({ bar: 2, tick: 0 }, [{ bar: 1, numerator: 7, denominator: 8 }])).toBe(14);
  });

  it("박자표를 생략하면 4/4(마디당 16틱)로 동작한다", () => {
    expect(barTickToAbsoluteTick({ bar: 2, tick: 0 })).toBe(16);
  });

  // 변박: 마디마다 길이가 다르므로 절대틱은 앞선 마디들을 실제로 누적해야 나온다.
  it("곡 중간에 박자가 바뀌면 그 이후 마디의 절대틱이 누적되어 계산된다", () => {
    // 1~2마디 4/4(16틱씩), 3마디부터 3/4(12틱씩)
    const sig = [
      { bar: 1, numerator: 4, denominator: 4 },
      { bar: 3, numerator: 3, denominator: 4 },
    ];
    expect(barTickToAbsoluteTick({ bar: 3, tick: 0 }, sig)).toBe(32); // 16 + 16
    expect(barTickToAbsoluteTick({ bar: 4, tick: 0 }, sig)).toBe(44); // + 12
    expect(barTickToAbsoluteTick({ bar: 5, tick: 0 }, sig)).toBe(56); // + 12
  });
});

describe("ticksPerMeasure", () => {
  it("분자 × (16 / 분모)", () => {
    expect(ticksPerMeasure({ numerator: 4, denominator: 4 })).toBe(16);
    expect(ticksPerMeasure({ numerator: 3, denominator: 4 })).toBe(12);
    expect(ticksPerMeasure({ numerator: 7, denominator: 8 })).toBe(14);
    expect(ticksPerMeasure({ numerator: 5, denominator: 16 })).toBe(5);
  });
});

describe("signatureAtBar / absoluteTickToBarTick", () => {
  const sig = [
    { bar: 1, numerator: 4, denominator: 4 },
    { bar: 3, numerator: 3, denominator: 4 },
  ];

  it("변경 이전 마디는 직전 박자표를, 이후 마디는 새 박자표를 쓴다", () => {
    expect(signatureAtBar(sig, 2)).toEqual({ bar: 1, numerator: 4, denominator: 4 });
    expect(signatureAtBar(sig, 3)).toEqual({ bar: 3, numerator: 3, denominator: 4 });
    expect(signatureAtBar(sig, 99)).toEqual({ bar: 3, numerator: 3, denominator: 4 });
  });

  it("박자표 목록이 비어 있으면 4/4로 취급한다", () => {
    expect(signatureAtBar([], 1)).toEqual({ numerator: 4, denominator: 4 });
  });

  it("절대틱을 마디:틱으로 되돌린다(변박 포함)", () => {
    expect(absoluteTickToBarTick(sig, 0)).toEqual({ bar: 1, tick: 0 });
    expect(absoluteTickToBarTick(sig, 32)).toEqual({ bar: 3, tick: 0 });
    expect(absoluteTickToBarTick(sig, 38)).toEqual({ bar: 3, tick: 6 });
    expect(absoluteTickToBarTick(sig, 44)).toEqual({ bar: 4, tick: 0 });
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
