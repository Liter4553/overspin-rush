import { describe, expect, it } from "vitest";
import { applyAutoMiss, createNoteTracker, findNearestPendingNote, markJudged } from "./noteState";
import type { Chart } from "../chart/types";

function makeChart(notes: Chart["notes"]): Chart {
  return {
    version: 1,
    title: "t",
    artist: "a",
    audio: "",
    offset: 0,
    bpmChanges: [{ time: 0, bpm: 150 }],
    level: 1,
    notes,
  };
}

describe("findNearestPendingNote", () => {
  it("윈도우 안의 가장 가까운 노트를 찾는다", () => {
    const tracked = createNoteTracker(
      makeChart([
        { time: 1000, lane: 0, type: "tap" },
        { time: 1050, lane: 0, type: "tap" },
      ]),
    );
    const found = findNearestPendingNote(tracked, 0, 1040, 80);
    expect(found?.note.time).toBe(1050);
  });

  it("윈도우 밖이면 null을 반환한다(무반응 무시)", () => {
    const tracked = createNoteTracker(makeChart([{ time: 1000, lane: 0, type: "tap" }]));
    expect(findNearestPendingNote(tracked, 0, 1200, 80)).toBeNull();
  });

  it("다른 레인의 노트는 찾지 않는다", () => {
    const tracked = createNoteTracker(makeChart([{ time: 1000, lane: 1, type: "tap" }]));
    expect(findNearestPendingNote(tracked, 0, 1000, 80)).toBeNull();
  });

  it("이미 판정된 노트는 다시 찾지 않는다", () => {
    const tracked = createNoteTracker(makeChart([{ time: 1000, lane: 0, type: "tap" }]));
    markJudged(tracked[0], "PERFECT_PLUS", 0);
    expect(findNearestPendingNote(tracked, 0, 1000, 80)).toBeNull();
  });
});

describe("applyAutoMiss", () => {
  it("슬로우 윈도우를 넘긴 pending 노트를 MISS로 전환한다", () => {
    const tracked = createNoteTracker(makeChart([{ time: 1000, lane: 0, type: "tap" }]));
    const missed = applyAutoMiss(tracked, 1081, 80);
    expect(missed).toHaveLength(1);
    expect(tracked[0].state).toBe("judged");
    expect(tracked[0].grade).toBe("MISS");
  });

  it("윈도우 안이면 아직 MISS 처리하지 않는다", () => {
    const tracked = createNoteTracker(makeChart([{ time: 1000, lane: 0, type: "tap" }]));
    const missed = applyAutoMiss(tracked, 1080, 80);
    expect(missed).toHaveLength(0);
    expect(tracked[0].state).toBe("pending");
  });

  it("이미 판정된 노트는 다시 MISS 처리하지 않는다", () => {
    const tracked = createNoteTracker(makeChart([{ time: 1000, lane: 0, type: "tap" }]));
    markJudged(tracked[0], "GOOD", 75);
    const missed = applyAutoMiss(tracked, 5000, 80);
    expect(missed).toHaveLength(0);
    expect(tracked[0].grade).toBe("GOOD");
  });
});

describe("markJudged", () => {
  it("상태/등급/오차를 기록한다", () => {
    const tracked = createNoteTracker(makeChart([{ time: 1000, lane: 0, type: "tap" }]));
    markJudged(tracked[0], "PERFECT", -30);
    expect(tracked[0]).toMatchObject({ state: "judged", grade: "PERFECT", errorMs: -30 });
  });
});
