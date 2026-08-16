import { describe, expect, it } from "vitest";
import { parsePattern } from "./patternParser";
import { parseChart } from "./parseChart";
import { generateBarLineTimesMs } from "../core/barLines";
import { dummyChartRaw } from "./dummyChart";

// dummyChartRaw(ms 기준)를 그대로 .pattern(마디:틱 기준) 문법으로 옮겨 쓴 버전.
// BPM 150에서는 4틱=400ms이므로 dummyChartRaw의 모든 타이밍이 100ms 단위(=1틱)로 딱 떨어진다.
const dummyPatternText = `
[meta]
title=더미 채보
artist=Overspin RUSH
audio=song.ogg
offset=0
level=1

[bpm]
1:0=150

[notes]
1:8 0 tap
1:12 1 tap
2:0 2 tap
2:4 fx tap
2:8 0 tap
2:12 1 hold 8
3:0 2 tap
3:8 fx hold 8
3:12 scratch tap
4:0 0 tap
4:4 1 tap
4:8 2 tap
4:12 scratch tap
5:0 fx tap
5:4 1 tap
5:4 fx tap
`;

describe("parsePattern", () => {
  it("더미 채보(JSON)와 동일한 결과를 만든다", () => {
    const expected = parseChart(dummyChartRaw);
    const actual = parsePattern(dummyPatternText);
    expect(actual.notes).toEqual(expected.notes);
    expect(actual.bpmChanges).toEqual(expected.bpmChanges);
    expect(actual.title).toBe(expected.title);
    expect(actual.artist).toBe(expected.artist);
    expect(actual.audio).toBe("song.ogg"); // dummyChartRaw.audio는 ""(음원 없음)라서 별도로 확인
    expect(actual.offset).toBe(expected.offset);
    expect(actual.level).toBe(expected.level);
  });

  it("주석(#)과 빈 줄을 무시한다", () => {
    const text = `
[meta]
title=t # 주석
artist=a
audio=song.ogg
offset=0
level=1

[bpm]
1:0=150

# 노트 주석
[notes]
1:0 0 tap
`;
    const chart = parsePattern(text);
    expect(chart.title).toBe("t");
    expect(chart.notes).toEqual([{ time: 0, lane: 0, type: "tap" }]);
  });

  it("BPM이 도중에 바뀌면 이후 노트 타이밍에 반영된다", () => {
    const text = `
[meta]
title=t
artist=a
audio=song.ogg
offset=0
level=1

[bpm]
1:0=150
2:0=300

[notes]
1:0 0 tap
2:0 1 tap
2:4 2 tap
`;
    const chart = parsePattern(text);
    // 1마디(150bpm)=1600ms, 2마디부터 300bpm이므로 4틱(1박)=200ms
    expect(chart.notes.map((n) => n.time)).toEqual([0, 1600, 1800]);
  });

  it("[meta] 섹션이 없으면 에러를 던진다", () => {
    expect(() => parsePattern(`[bpm]\n1:0=150\n[notes]\n1:0 0 tap`)).toThrow();
  });

  it("[bpm] 섹션이 비어있으면 에러를 던진다", () => {
    const text = `
[meta]
title=t
artist=a
audio=song.ogg
offset=0
level=1

[bpm]

[notes]
1:0 0 tap
`;
    expect(() => parsePattern(text)).toThrow();
  });

  it("스크래치 홀드 노트는 에러를 던진다", () => {
    const text = `
[meta]
title=t
artist=a
audio=song.ogg
offset=0
level=1

[bpm]
1:0=150

[notes]
1:0 scratch hold 4
`;
    expect(() => parsePattern(text)).toThrow();
  });

  it("잘못된 마디:틱 형식이면 에러를 던진다", () => {
    const text = `
[meta]
title=t
artist=a
audio=song.ogg
offset=0
level=1

[bpm]
1:0=150

[notes]
abc 0 tap
`;
    expect(() => parsePattern(text)).toThrow();
  });

  it("hold 노트에 duration이 없으면 에러를 던진다", () => {
    const text = `
[meta]
title=t
artist=a
audio=song.ogg
offset=0
level=1

[bpm]
1:0=150

[notes]
1:0 0 hold
`;
    expect(() => parsePattern(text)).toThrow();
  });

  it("필수 meta 필드가 빠지면 에러를 던진다", () => {
    const text = `
[meta]
title=t
artist=a

[bpm]
1:0=150

[notes]
1:0 0 tap
`;
    expect(() => parsePattern(text)).toThrow();
  });
});


describe("parsePattern - 박자표/변박", () => {
  function patternText(notes: string): string {
    return `
[meta]
title=t
artist=a
audio=song.ogg
offset=0
level=1

[bpm]
1:0=120

[notes]
${notes}
`;
  }

  it("박자표 지정이 없으면 4/4로 동작한다(마디당 16틱)", () => {
    // BPM 120 -> 1박 500ms, 1틱 125ms. 2마디 0틱 = 절대틱 16 = 2000ms.
    const chart = parsePattern(patternText("2:0 0 tap"));
    expect(chart.timeSignatures).toEqual([]);
    expect(chart.notes[0].time).toBeCloseTo(2000);
  });

  it("1마디에 3/4를 지정하면 마디당 12틱이라 2마디 0틱이 1500ms가 된다", () => {
    const chart = parsePattern(patternText("1:0 beat 3/4\n2:0 0 tap"));
    expect(chart.timeSignatures).toEqual([{ bar: 1, numerator: 3, denominator: 4 }]);
    expect(chart.notes[0].time).toBeCloseTo(1500);
  });

  it("곡 중간에 박자를 바꾸면 그 마디부터 적용된다", () => {
    // 1~2마디 4/4(16틱=2000ms), 3마디부터 3/4(12틱=1500ms)
    const chart = parsePattern(patternText("3:0 beat 3/4\n3:0 0 tap\n4:0 1 tap"));
    expect(chart.timeSignatures).toEqual([{ bar: 3, numerator: 3, denominator: 4 }]);
    expect(chart.notes[0].time).toBeCloseTo(4000); // 2000 + 2000
    expect(chart.notes[1].time).toBeCloseTo(5500); // + 1500
  });

  it("8분음표 분모(7/8)도 처리한다", () => {
    // 7/8 = 8분음표 7개 = 14틱 = 1750ms
    const chart = parsePattern(patternText("1:0 beat 7/8\n2:0 0 tap"));
    expect(chart.notes[0].time).toBeCloseTo(1750);
  });

  it("[bpm] 섹션의 마디:틱에도 박자표가 적용된다", () => {
    const text = `
[meta]
title=t
artist=a
audio=song.ogg
offset=0
level=1

[bpm]
1:0=120
2:0=240

[notes]
1:0 beat 3/4
1:0 0 tap
`;
    // 3/4에서 2마디 0틱 = 절대틱 12 = 1500ms
    const chart = parsePattern(text);
    expect(chart.bpmChanges[1].time).toBeCloseTo(1500);
  });

  it("홀드 duration은 박자표와 무관하게 틱 단위 그대로다", () => {
    // BPM 120에서 1틱 = 125ms. duration 4틱 = 500ms.
    const chart = parsePattern(patternText("1:0 beat 3/4\n1:0 0 hold 4"));
    expect(chart.notes[0].duration).toBeCloseTo(500);
  });

  it("박자표 줄은 노트로 해석되지 않는다", () => {
    const chart = parsePattern(patternText("1:0 beat 3/4\n1:0 0 tap"));
    expect(chart.notes).toHaveLength(1);
  });

  it("마디 첫 틱이 아닌 곳에서 박자를 바꾸면 에러를 던진다", () => {
    expect(() => parsePattern(patternText("1:4 beat 3/4"))).toThrow();
  });

  it("분모가 1/2/4/8/16이 아니면 에러를 던진다", () => {
    expect(() => parsePattern(patternText("1:0 beat 3/3"))).toThrow();
    expect(() => parsePattern(patternText("1:0 beat 3/32"))).toThrow();
  });

  it("분자가 0 이하이거나 형식이 틀리면 에러를 던진다", () => {
    expect(() => parsePattern(patternText("1:0 beat 0/4"))).toThrow();
    expect(() => parsePattern(patternText("1:0 beat 4"))).toThrow();
    expect(() => parsePattern(patternText("1:0 beat 4/4 extra"))).toThrow();
  });

  it("같은 마디에 박자표를 두 번 지정하면 에러를 던진다", () => {
    expect(() => parsePattern(patternText("1:0 beat 3/4\n1:0 beat 4/4"))).toThrow();
  });

  // 회귀 방지: 마디선을 ms 누적으로 걷던 시절, BPM 변경 지점에서 한 틱이 옛 BPM으로
  // 계산되어 마디선이 노트와 65ms나 어긋난 채 곡 끝까지 남는 버그가 있었다.
  // 마디 머리에 찍은 노트와 그 마디의 마디선은 같은 틱이므로 항상 정확히 같아야 한다.
  it("BPM이 바뀌어도 마디 머리의 노트 시각과 마디선 시각이 정확히 일치한다", () => {
    const text = `
[meta]
title=t
artist=a
audio=song.ogg
offset=0
level=1

[bpm]
1:0=177
3:0=100

[notes]
1:0 0 tap
2:0 0 tap
3:0 0 tap
4:0 0 tap
5:0 0 tap
6:0 0 tap
`;
    const chart = parsePattern(text);
    const noteTimes = chart.notes.map((n) => n.time);
    const barLines = generateBarLineTimesMs(chart.bpmChangeTicks, 60000, chart.timeSignatures);
    expect(barLines.slice(0, noteTimes.length)).toEqual(noteTimes);
  });

  // .pattern -> 파싱 -> 마디선 생성까지 이어지는, 실제 화면에 보이는 동작.
  it("변박 채보를 넣으면 게임 마디선 간격도 바뀐 박자를 따라간다", () => {
    const chart = parsePattern(patternText("3:0 beat 3/4\n1:0 0 tap"));
    const times = generateBarLineTimesMs(chart.bpmChangeTicks, 7000, chart.timeSignatures);
    expect(times).toEqual([0, 2000, 4000, 5500, 7000]);
  });
});
