import { describe, expect, it } from "vitest";
import { generateBarLineTimesMs } from "./barLines";

const BPM_120 = [{ time: 0, bpm: 120 }]; // 1박 500ms, 1틱(16분음표) 125ms

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

  // 이번 변경의 핵심: 곡 도중 박자가 바뀌면 그 마디부터 마디선 간격이 달라져야 한다.
  it("곡 중간에 변박이 일어나면 그 마디부터 마디선 간격이 바뀐다", () => {
    const sig = [
      { bar: 1, numerator: 4, denominator: 4 }, // 2000ms짜리 마디
      { bar: 3, numerator: 3, denominator: 4 }, // 1500ms짜리 마디
    ];
    // 1마디 0, 2마디 2000, 3마디 4000 -> 여기서부터 3/4라 5500, 7000
    expect(generateBarLineTimesMs(BPM_120, 7000, sig)).toEqual([0, 2000, 4000, 5500, 7000]);
  });

  it("변박과 BPM 변경이 함께 있어도 각각 반영된다", () => {
    // 3마디(4000ms)부터 3/4 + 240bpm(1박 250ms) -> 마디 길이 750ms
    const sig = [
      { bar: 1, numerator: 4, denominator: 4 },
      { bar: 3, numerator: 3, denominator: 4 },
    ];
    const bpm = [
      { time: 0, bpm: 120 },
      { time: 4000, bpm: 240 },
    ];
    expect(generateBarLineTimesMs(bpm, 5500, sig)).toEqual([0, 2000, 4000, 4750, 5500]);
  });

  it("곡 도중 BPM이 바뀌면 그 시점부터 마디 길이가 달라진다", () => {
    const times = generateBarLineTimesMs(
      [
        { time: 0, bpm: 120 },
        { time: 2000, bpm: 240 },
      ],
      4000,
    );
    expect(times).toEqual([0, 2000, 3000, 4000]);
  });

  it("durationMs를 넘는 마디선은 만들지 않는다", () => {
    expect(generateBarLineTimesMs(BPM_120, 3000)).toEqual([0, 2000]);
  });

  it("BPM이 0이면 무한 루프에 빠지지 않고 중단한다", () => {
    expect(generateBarLineTimesMs([{ time: 0, bpm: 0 }], 5000)).toEqual([0]);
  });
});
