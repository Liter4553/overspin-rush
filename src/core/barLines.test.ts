import { describe, expect, it } from "vitest";
import { generateBarLineAbsoluteTicks, generateBarLineTimesMs } from "./barLines";

// BPM 120 -> 1박 500ms, 1틱(16분음표) 125ms, 4/4 한 마디(16틱) 2000ms
const BPM_120 = [{ tick: 0, bpm: 120 }];

describe("generateBarLineAbsoluteTicks", () => {
  it("4/4면 16틱마다 마디 머리다", () => {
    expect(generateBarLineAbsoluteTicks([], 48)).toEqual([0, 16, 32, 48]);
  });

  it("3/4면 12틱마다", () => {
    const sig = [{ bar: 1, numerator: 3, denominator: 4 }];
    expect(generateBarLineAbsoluteTicks(sig, 36)).toEqual([0, 12, 24, 36]);
  });

  it("변박이 있으면 그 마디부터 간격이 달라진다", () => {
    const sig = [
      { bar: 1, numerator: 4, denominator: 4 },
      { bar: 3, numerator: 3, denominator: 4 },
    ];
    expect(generateBarLineAbsoluteTicks(sig, 56)).toEqual([0, 16, 32, 44, 56]);
  });
});

describe("generateBarLineTimesMs", () => {
  it("BPM 120 · 4/4에서는 2초(4박)마다 마디선이 생긴다", () => {
    expect(generateBarLineTimesMs(BPM_120, 6000)).toEqual([0, 2000, 4000, 6000]);
  });

  it("3/4면 3박(1.5초)마다 마디선이 생긴다", () => {
    const sig = [{ bar: 1, numerator: 3, denominator: 4 }];
    expect(generateBarLineTimesMs(BPM_120, 4500, sig)).toEqual([0, 1500, 3000, 4500]);
  });

  it("7/8이면 8분음표 7개(1.75초)마다 마디선이 생긴다", () => {
    const sig = [{ bar: 1, numerator: 7, denominator: 8 }];
    expect(generateBarLineTimesMs(BPM_120, 3500, sig)).toEqual([0, 1750, 3500]);
  });

  it("박자표를 생략하면 4/4가 쓰인다", () => {
    expect(generateBarLineTimesMs(BPM_120, 4000)).toEqual([0, 2000, 4000]);
  });

  it("곡 중간에 변박이 일어나면 그 마디부터 마디선 간격이 바뀐다", () => {
    const sig = [
      { bar: 1, numerator: 4, denominator: 4 },
      { bar: 3, numerator: 3, denominator: 4 },
    ];
    expect(generateBarLineTimesMs(BPM_120, 7000, sig)).toEqual([0, 2000, 4000, 5500, 7000]);
  });

  it("곡 도중 BPM이 바뀌면 그 시점부터 마디 길이가 달라진다", () => {
    // 2마디(절대틱 16)부터 240bpm -> 1틱 62.5ms, 한 마디 1000ms
    const times = generateBarLineTimesMs(
      [
        { tick: 0, bpm: 120 },
        { tick: 16, bpm: 240 },
      ],
      4000,
    );
    expect(times).toEqual([0, 2000, 3000, 4000]);
  });

  it("변박과 BPM 변경이 함께 있어도 각각 반영된다", () => {
    // 3마디(절대틱 32)부터 3/4 + 240bpm -> 마디 길이 12틱 * 62.5ms = 750ms
    const sig = [
      { bar: 1, numerator: 4, denominator: 4 },
      { bar: 3, numerator: 3, denominator: 4 },
    ];
    const bpm = [
      { tick: 0, bpm: 120 },
      { tick: 32, bpm: 240 },
    ];
    expect(generateBarLineTimesMs(bpm, 5500, sig)).toEqual([0, 2000, 4000, 4750, 5500]);
  });

  it("durationMs를 넘는 마디선은 만들지 않는다", () => {
    expect(generateBarLineTimesMs(BPM_120, 3000)).toEqual([0, 2000]);
  });

  it("BPM이 0 이하면(무효 채보) 무한 루프 대신 빈 배열을 반환한다", () => {
    expect(generateBarLineTimesMs([{ tick: 0, bpm: 0 }], 5000)).toEqual([]);
    expect(generateBarLineTimesMs([{ tick: 0, bpm: -1 }], 5000)).toEqual([]);
  });

  it("BPM 목록이 비어 있으면 빈 배열을 반환한다", () => {
    expect(generateBarLineTimesMs([], 5000)).toEqual([]);
  });
});
