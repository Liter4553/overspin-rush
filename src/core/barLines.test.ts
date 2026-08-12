import { describe, expect, it } from "vitest";
import { generateBarLineTimesMs } from "./barLines";

describe("generateBarLineTimesMs", () => {
  it("BPM 120 · 4/4에서는 2초(4박)마다 마디선이 생긴다", () => {
    const times = generateBarLineTimesMs([{ time: 0, bpm: 120 }], 6000, 4);
    expect(times).toEqual([0, 2000, 4000, 6000]);
  });

  it("박자표 분자가 3(3/4)이면 3박마다 마디선이 생긴다", () => {
    const times = generateBarLineTimesMs([{ time: 0, bpm: 120 }], 4500, 3);
    expect(times).toEqual([0, 1500, 3000, 4500]);
  });

  it("박자표 분자가 7이어도 그대로 적용된다", () => {
    const times = generateBarLineTimesMs([{ time: 0, bpm: 120 }], 7000, 7);
    expect(times).toEqual([0, 3500, 7000]);
  });

  it("생략하면 기본값 4/4가 쓰인다", () => {
    expect(generateBarLineTimesMs([{ time: 0, bpm: 120 }], 4000)).toEqual([0, 2000, 4000]);
  });

  it("곡 도중 BPM이 바뀌면 그 시점부터 마디 길이가 달라진다", () => {
    // 120bpm(500ms/박)으로 1마디(2000ms) 진행 후, 2000ms부터 240bpm(250ms/박)이면
    // 두 번째 마디는 1000ms만에 끝난다.
    const times = generateBarLineTimesMs(
      [
        { time: 0, bpm: 120 },
        { time: 2000, bpm: 240 },
      ],
      4000,
      4,
    );
    expect(times).toEqual([0, 2000, 3000, 4000]);
  });

  it("durationMs를 넘는 마디선은 만들지 않는다", () => {
    const times = generateBarLineTimesMs([{ time: 0, bpm: 120 }], 3000, 4);
    expect(times).toEqual([0, 2000]);
  });

  it("BPM이 0이면 무한 루프에 빠지지 않고 중단한다", () => {
    const times = generateBarLineTimesMs([{ time: 0, bpm: 0 }], 5000, 4);
    expect(times).toEqual([0]);
  });

  it("beatsPerMeasure가 1 미만이면 예외를 던진다", () => {
    expect(() => generateBarLineTimesMs([{ time: 0, bpm: 120 }], 1000, 0)).toThrow();
  });
});
