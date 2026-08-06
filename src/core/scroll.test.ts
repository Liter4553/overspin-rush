import { describe, expect, it } from "vitest";
import { currentBpm, noteY } from "./scroll";

describe("noteY", () => {
  it("노트 시각과 현재 시각이 같으면 판정선 위치와 같다", () => {
    expect(noteY(1000, 1000, 800, 680)).toBeCloseTo(680);
  });

  it("그린넘버만큼 전이면 화면 y=0(상단)이다", () => {
    expect(noteY(1000, 200, 800, 680)).toBeCloseTo(0);
  });

  it("판정선을 지나면 y가 판정선보다 커진다", () => {
    expect(noteY(1000, 1400, 800, 680)).toBeGreaterThan(680);
  });
});

describe("currentBpm", () => {
  it("bpmChanges가 하나뿐이면 항상 그 값을 반환한다", () => {
    expect(currentBpm([{ time: 0, bpm: 150 }], 5000)).toBe(150);
  });

  it("가장 최근에 지나간 bpmChange 값을 반환한다", () => {
    const changes = [
      { time: 0, bpm: 120 },
      { time: 1000, bpm: 180 },
    ];
    expect(currentBpm(changes, 500)).toBe(120);
    expect(currentBpm(changes, 1000)).toBe(180);
    expect(currentBpm(changes, 5000)).toBe(180);
  });
});
