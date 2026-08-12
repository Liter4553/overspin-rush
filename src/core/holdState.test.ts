import { describe, expect, it } from "vitest";
import { advanceHoldTicks, computeTickIntervalMs, startActiveHold } from "./holdState";
import type { ChartNote } from "../chart/types";

describe("computeTickIntervalMs", () => {
  const bpmChanges = [{ time: 0, bpm: 150 }];

  it("오버라이드가 없으면 기본값(0.25비트=16분음표)으로 BPM에 연동한다 (150bpm -> 100ms)", () => {
    expect(computeTickIntervalMs(bpmChanges, 1000, undefined, undefined)).toBe(100);
  });

  it("채보 전체 기본값이 있으면 그것을 쓴다", () => {
    expect(computeTickIntervalMs(bpmChanges, 1000, undefined, 0.5)).toBe(200);
  });

  it("노트별 오버라이드가 채보 전체 기본값보다 우선한다", () => {
    expect(computeTickIntervalMs(bpmChanges, 1000, 2, 0.5)).toBe(800);
  });

  it("노트 시각 시점의 BPM을 사용한다(BPM 변경 반영)", () => {
    const changes = [
      { time: 0, bpm: 150 },
      { time: 1000, bpm: 300 },
    ];
    expect(computeTickIntervalMs(changes, 1500, undefined, undefined)).toBe(50);
  });
});

describe("startActiveHold / advanceHoldTicks", () => {
  function makeHoldNote(overrides: Partial<ChartNote> = {}): ChartNote {
    return { time: 1000, lane: 0, type: "hold", duration: 1000, ...overrides };
  }

  it("시작 시점 + 틱 간격을 첫 틱 예정 시각으로 설정한다", () => {
    const hold = startActiveHold(makeHoldNote(), 400);
    expect(hold.nextTickTimeMs).toBe(1400);
    expect(hold.endTimeMs).toBe(2000);
  });

  it("틱 예정 시각 전이면 틱이 발생하지 않는다", () => {
    const hold = startActiveHold(makeHoldNote(), 400);
    const result = advanceHoldTicks(hold, 1399);
    expect(result.tickCount).toBe(0);
    expect(result.expired).toBe(false);
  });

  it("틱 예정 시각을 지나면 1틱 발생하고 다음 예정 시각으로 넘어간다", () => {
    const hold = startActiveHold(makeHoldNote(), 400);
    const result = advanceHoldTicks(hold, 1400);
    expect(result.tickCount).toBe(1);
    expect(result.hold.nextTickTimeMs).toBe(1800);
  });

  it("여러 틱을 한꺼번에 놓쳤으면(프레임 드랍) 캐치업해서 한 번에 반영한다", () => {
    const hold = startActiveHold(makeHoldNote(), 400);
    const result = advanceHoldTicks(hold, 1999); // 1400, 1800 두 번 지남
    expect(result.tickCount).toBe(2);
    expect(result.hold.nextTickTimeMs).toBe(2200);
  });

  it("endTimeMs를 지나면 만료로 표시하고 틱을 발생시키지 않는다", () => {
    const hold = startActiveHold(makeHoldNote(), 400);
    const result = advanceHoldTicks(hold, 2001);
    expect(result.expired).toBe(true);
    expect(result.tickCount).toBe(0);
  });
});
