import { describe, expect, it } from "vitest";
import { addHitEffect, createHitEffect, pruneExpiredHitEffects } from "./hitEffect";

describe("createHitEffect", () => {
  it("MISS는 null을 반환한다(이펙트 없음)", () => {
    expect(createHitEffect(0, "MISS", 1000)).toBeNull();
  });

  it("MISS가 아니면 이펙트 객체를 만든다", () => {
    expect(createHitEffect("fx", "PERFECT_PLUS", 1000)).toEqual({
      lane: "fx",
      grade: "PERFECT_PLUS",
      startedAtMs: 1000,
    });
  });
});

describe("addHitEffect", () => {
  it("null이면 목록이 그대로다(길이만 유지, 새 배열)", () => {
    const effects = [{ lane: 0 as const, grade: "GOOD" as const, startedAtMs: 0 }];
    const result = addHitEffect(effects, null);
    expect(result).toEqual(effects);
    expect(result).not.toBe(effects);
  });

  it("유효한 이펙트는 목록 끝에 추가된다", () => {
    const effect = { lane: "scratch" as const, grade: "GREAT" as const, startedAtMs: 500 };
    const result = addHitEffect([], effect);
    expect(result).toEqual([effect]);
  });
});

describe("pruneExpiredHitEffects", () => {
  const duration = 200;

  it("지속 시간 안이면 유지한다", () => {
    const effects = [{ lane: 1 as const, grade: "PERFECT" as const, startedAtMs: 1000 }];
    expect(pruneExpiredHitEffects(effects, 1150, duration)).toEqual(effects);
  });

  it("지속 시간을 넘기면(경계 포함) 제거한다", () => {
    const effects = [{ lane: 1 as const, grade: "PERFECT" as const, startedAtMs: 1000 }];
    expect(pruneExpiredHitEffects(effects, 1200, duration)).toEqual([]);
    expect(pruneExpiredHitEffects(effects, 1300, duration)).toEqual([]);
  });

  it("미래 시각(음수 age)인 이펙트는 걸러낸다", () => {
    const effects = [{ lane: 2 as const, grade: "GOOD" as const, startedAtMs: 1000 }];
    expect(pruneExpiredHitEffects(effects, 900, duration)).toEqual([]);
  });
});
