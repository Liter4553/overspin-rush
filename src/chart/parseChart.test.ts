import { describe, expect, it } from "vitest";
import { parseChart } from "./parseChart";

const validChart = {
  title: "테스트",
  artist: "테스터",
  audio: "song.ogg",
  offset: 0,
  bpmChanges: [{ time: 0, bpm: 150 }],
  level: 1,
  notes: [
    { time: 1000, lane: 0, type: "tap" },
    { time: 500, lane: "fx", type: "hold", duration: 300 },
  ],
};

describe("parseChart", () => {
  it("유효한 채보를 파싱하고 notes/bpmChanges를 시간순 정렬한다", () => {
    const chart = parseChart(validChart);
    expect(chart.notes.map((n) => n.time)).toEqual([500, 1000]);
    expect(chart.version).toBe(1);
  });

  it("hold 노트에 duration이 없으면 에러를 던진다", () => {
    expect(() =>
      parseChart({ ...validChart, notes: [{ time: 0, lane: 0, type: "hold" }] }),
    ).toThrow();
  });

  it("잘못된 lane 값이면 에러를 던진다", () => {
    expect(() =>
      parseChart({ ...validChart, notes: [{ time: 0, lane: 3, type: "tap" }] }),
    ).toThrow();
  });

  it("notes가 배열이 아니면 에러를 던진다", () => {
    expect(() => parseChart({ ...validChart, notes: "nope" })).toThrow();
  });

  it("스크래치 노트가 hold이면 에러를 던진다", () => {
    expect(() =>
      parseChart({ ...validChart, notes: [{ time: 0, lane: "scratch", type: "hold", duration: 300 }] }),
    ).toThrow();
  });

  it("스크래치 tap 노트는 정상적으로 파싱된다", () => {
    const chart = parseChart({ ...validChart, notes: [{ time: 0, lane: "scratch", type: "tap" }] });
    expect(chart.notes[0].lane).toBe("scratch");
  });
});
