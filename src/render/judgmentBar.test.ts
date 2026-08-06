import { describe, expect, it } from "vitest";
import { addJudgmentTick, averageError, type JudgmentTick } from "./judgmentBar";

function tick(errorMs: number, source: JudgmentTick["source"] = "key"): JudgmentTick {
  return { errorMs, grade: "GREAT", source, createdAtMs: 0 };
}

describe("addJudgmentTick", () => {
  it("최대 개수를 넘으면 가장 오래된 것부터 버린다", () => {
    let ticks: JudgmentTick[] = [];
    for (let i = 0; i < 5; i++) {
      ticks = addJudgmentTick(ticks, tick(i), 3);
    }
    expect(ticks.map((t) => t.errorMs)).toEqual([2, 3, 4]);
  });
});

describe("averageError", () => {
  it("source가 일치하는 틱들의 평균을 낸다", () => {
    const ticks = [tick(10, "key"), tick(30, "key"), tick(-100, "scratch")];
    expect(averageError(ticks, "key")).toBeCloseTo(20);
  });

  it("해당 source의 틱이 없으면 null", () => {
    expect(averageError([tick(10, "scratch")], "key")).toBeNull();
  });
});
