import { describe, expect, it } from "vitest";
import { parsePattern } from "./patternParser";
import { parseChart } from "./parseChart";
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
