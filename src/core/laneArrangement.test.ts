import { describe, expect, it } from "vitest";
import { applyArrangement } from "./laneArrangement";
import type { ChartNote } from "../chart/types";

function lanesOf(notes: ChartNote[]): (ChartNote["lane"])[] {
  return notes.map((n) => n.lane);
}

describe("applyArrangement", () => {
  const notes: ChartNote[] = [
    { time: 0, lane: 0, type: "tap" },
    { time: 100, lane: 1, type: "tap" },
    { time: 200, lane: 2, type: "tap" },
    { time: 300, lane: "fx", type: "tap" },
    { time: 400, lane: "scratch", type: "tap" },
  ];

  it("NORMAL은 레인을 그대로 둔다", () => {
    const result = applyArrangement(notes, "normal");
    expect(lanesOf(result)).toEqual([0, 1, 2, "fx", "scratch"]);
  });

  it("MIRROR는 0<->2를 스왑하고 1은 그대로 둔다", () => {
    const result = applyArrangement(notes, "mirror");
    expect(lanesOf(result)).toEqual([2, 1, 0, "fx", "scratch"]);
  });

  it("MIRROR에서도 FX/스크래치 노트는 변환 대상에서 제외된다", () => {
    const result = applyArrangement(notes, "mirror");
    expect(result[3].lane).toBe("fx");
    expect(result[4].lane).toBe("scratch");
  });

  it("노트 개수는 유실/중복 없이 그대로 유지된다", () => {
    expect(applyArrangement(notes, "normal")).toHaveLength(notes.length);
    expect(applyArrangement(notes, "mirror")).toHaveLength(notes.length);
  });

  it("원본 채보 노트 배열/객체를 변형하지 않는다", () => {
    const original = notes.map((n) => ({ ...n }));
    applyArrangement(notes, "mirror");
    expect(notes).toEqual(original);
  });
});
