import { describe, expect, it } from "vitest";
import { advanceHoldTicks, computeTickIntervalTicks, startActiveHold } from "./holdState";
import type { ChartNote } from "../chart/types";

// BPM 150 -> 1박 400ms, 1틱(16분음표) 100ms
const BPM_150 = [{ tick: 0, bpm: 150 }];

describe("computeTickIntervalTicks", () => {
  it("오버라이드가 없으면 기본값(0.25비트=16분음표)이라 1틱이다", () => {
    expect(computeTickIntervalTicks(undefined, undefined)).toBe(1);
  });

  it("채보 전체 기본값이 있으면 그것을 쓴다(0.5비트=2틱)", () => {
    expect(computeTickIntervalTicks(undefined, 0.5)).toBe(2);
  });

  it("노트별 오버라이드가 채보 전체 기본값보다 우선한다(2비트=8틱)", () => {
    expect(computeTickIntervalTicks(2, 0.5)).toBe(8);
  });

  it("BPM에 의존하지 않는다 — 박자 단위이므로 BPM이 바뀌어도 같은 값이다", () => {
    expect(computeTickIntervalTicks(1, undefined)).toBe(4);
  });
});

describe("startActiveHold / advanceHoldTicks", () => {
  function makeHoldNote(overrides: Partial<ChartNote> = {}): ChartNote {
    // 절대틱 10(=1000ms), 길이 1000ms
    return { time: 1000, tick: 10, lane: 0, type: "hold", duration: 1000, ...overrides };
  }

  it("시작 시점 + 틱 간격을 첫 틱 예정 시각으로 설정한다", () => {
    const hold = startActiveHold(makeHoldNote(), 4, BPM_150); // 4틱 = 400ms
    expect(hold.nextTickTimeMs).toBe(1400);
    expect(hold.endTimeMs).toBe(2000);
  });

  it("틱 예정 시각 전이면 틱이 발생하지 않는다", () => {
    const hold = startActiveHold(makeHoldNote(), 4, BPM_150);
    const result = advanceHoldTicks(hold, 1399, BPM_150);
    expect(result.tickCount).toBe(0);
    expect(result.expired).toBe(false);
  });

  it("틱 예정 시각을 지나면 1틱 발생하고 다음 예정 시각으로 넘어간다", () => {
    const hold = startActiveHold(makeHoldNote(), 4, BPM_150);
    const result = advanceHoldTicks(hold, 1400, BPM_150);
    expect(result.tickCount).toBe(1);
    expect(result.hold.nextTickTimeMs).toBe(1800);
  });

  it("여러 틱을 한꺼번에 놓쳤으면(프레임 드랍) 캐치업해서 한 번에 반영한다", () => {
    const hold = startActiveHold(makeHoldNote(), 4, BPM_150);
    const result = advanceHoldTicks(hold, 1999, BPM_150); // 1400, 1800 두 번 지남
    expect(result.tickCount).toBe(2);
    expect(result.hold.nextTickTimeMs).toBe(2200);
  });

  it("endTimeMs를 지나면 만료로 표시하고 틱을 발생시키지 않는다", () => {
    const hold = startActiveHold(makeHoldNote(), 4, BPM_150);
    const result = advanceHoldTicks(hold, 2001, BPM_150);
    expect(result.expired).toBe(true);
    expect(result.tickCount).toBe(0);
  });

  it("간격이 0 이하면 무한 루프에 빠지지 않는다", () => {
    const hold = startActiveHold(makeHoldNote(), 0, BPM_150);
    const result = advanceHoldTicks(hold, 5000, BPM_150);
    expect(result.tickCount).toBe(0);
  });

  // 회귀 방지: 예전에는 시작 시점 BPM으로 계산한 ms 간격을 그대로 더해 갔기 때문에,
  // 홀드가 BPM 변경을 걸치면 이후 틱이 음악 격자에서 벗어났다.
  it("홀드 도중 BPM이 바뀌면 그 이후 틱 간격도 새 BPM을 따른다", () => {
    // 절대틱 0에서 시작, 틱 간격 4틱(1박). BPM 150(1틱 100ms) -> 절대틱 8부터 BPM 300(1틱 50ms)
    const bpm = [
      { tick: 0, bpm: 150 },
      { tick: 8, bpm: 300 },
    ];
    const note: ChartNote = { time: 0, tick: 0, lane: 0, type: "hold", duration: 2000 };
    const hold = startActiveHold(note, 4, bpm);

    // 첫 틱: 절대틱 4 -> 400ms (BPM 150 구간)
    expect(hold.nextTickTimeMs).toBe(400);

    // 둘째 틱: 절대틱 8 -> 800ms (아직 경계)
    const first = advanceHoldTicks(hold, 400, bpm);
    expect(first.tickCount).toBe(1);
    expect(first.hold.nextTickTimeMs).toBe(800);

    // 셋째 틱: 절대틱 12 -> 800 + 4틱*50ms = 1000ms.
    // 옛 방식이었다면 800 + 400 = 1200ms로 200ms 어긋났다.
    const second = advanceHoldTicks(first.hold, 800, bpm);
    expect(second.tickCount).toBe(1);
    expect(second.hold.nextTickTimeMs).toBe(1000);
  });
});
