import { describe, expect, it } from "vitest";
import { generateBarLineAbsoluteTicks, generateBarLineTimesMs } from "./barLines";
import { parsePattern } from "../chart/patternParser";

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

// .pattern -> 파싱 -> 마디선 생성까지 이어지는 통합 검증.
// chart/ 폴더가 core/에 의존하면 안 되므로(에디터가 chart만 그대로 가져다 쓴다)
// patternParser 쪽이 아니라 여기에 둔다.
describe("generateBarLineTimesMs - .pattern 통합", () => {
  function patternText(notes: string, bpm = "1:0=120"): string {
    return `
[meta]
title=t
artist=a
audio=song.ogg
offset=0
level=1

[bpm]
${bpm}

[notes]
${notes}
`;
  }

  // 회귀 방지: 마디선을 ms 누적으로 걷던 시절, BPM 변경 지점에서 한 틱이 옛 BPM으로
  // 계산되어 마디선이 노트와 65ms나 어긋난 채 곡 끝까지 남는 버그가 있었다.
  // 마디 머리에 찍은 노트와 그 마디의 마디선은 같은 틱이므로 항상 정확히 같아야 한다.
  it("BPM이 바뀌어도 마디 머리의 노트 시각과 마디선 시각이 정확히 일치한다", () => {
    const chart = parsePattern(
      patternText("1:0 0 tap\n2:0 0 tap\n3:0 0 tap\n4:0 0 tap\n5:0 0 tap\n6:0 0 tap", "1:0=177\n3:0=100"),
    );
    const noteTimes = chart.notes.map((n) => n.time);
    const barLines = generateBarLineTimesMs(chart.bpmChangeTicks, 60000, chart.timeSignatures);
    expect(barLines.slice(0, noteTimes.length)).toEqual(noteTimes);
  });

  it("변박 채보를 넣으면 게임 마디선 간격도 바뀐 박자를 따라간다", () => {
    const chart = parsePattern(patternText("3:0 beat 3/4\n1:0 0 tap"));
    const times = generateBarLineTimesMs(chart.bpmChangeTicks, 7000, chart.timeSignatures);
    expect(times).toEqual([0, 2000, 4000, 5500, 7000]);
  });
});
