import { describe, expect, it } from "vitest";
import type { JudgeGrade } from "./judge";
import {
  applyBackupGaugeRelayJudgement,
  applyGaugeHoldTick,
  applyGaugeJudgement,
  computeGaugeCoefficient,
  createBackupGaugeRelay,
  createGaugeState,
  isCleared,
} from "./gauge";

function applyMisses(type: "hard" | "challenge", count: number) {
  let state = createGaugeState(type);
  for (let i = 0; i < count; i++) {
    state = applyGaugeJudgement(state, "MISS", 0);
  }
  return state;
}

describe("applyGaugeJudgement — HARD", () => {
  it("연속 미스 8회에 28%까지 감소한다(저체력 보정 발동 전)", () => {
    const state = applyMisses("hard", 8);
    expect(state.dead).toBe(false);
    expect(state.value).toBeCloseTo(28, 5);
  });

  it("13회까지는 저체력 보정(-4.5%)이 적용되며 생존한다", () => {
    const state = applyMisses("hard", 13);
    expect(state.dead).toBe(false);
    expect(state.value).toBeCloseTo(5.5, 5);
  });

  it("연속 미스 14회에 폭사한다", () => {
    const state = applyMisses("hard", 14);
    expect(state.dead).toBe(true);
    expect(state.value).toBe(0);
  });
});

describe("applyGaugeJudgement — CHALLENGE", () => {
  it("연속 미스 5회까지는 생존한다", () => {
    const state = applyMisses("challenge", 5);
    expect(state.dead).toBe(false);
    expect(state.value).toBeCloseTo(10, 5);
  });

  it("연속 미스 6회에 폭사한다(저체력 보정 없음)", () => {
    const state = applyMisses("challenge", 6);
    expect(state.dead).toBe(true);
    expect(state.value).toBe(0);
  });
});

describe("applyGaugeJudgement — NORMAL", () => {
  it("1000노트 전부 퍼펙+면 100%로 클램프된다", () => {
    const a = computeGaugeCoefficient(1000);
    expect(a).toBeCloseTo(0.4706, 4);

    let state = createGaugeState("normal");
    for (let i = 0; i < 1000; i++) {
      state = applyGaugeJudgement(state, "PERFECT_PLUS", a);
    }
    expect(state.value).toBe(100);
  });

  // 미스를 균등 간격으로 흩뿌리되 맨 앞은 피한다 — 첫 노트부터 미스면 0% 하한 클램프가
  // 바로 걸려버려 이후 계산이 "손실 일부를 면제받은" 값이 되므로, 경계값 검증에는
  // 부적합하다(클램프가 전혀 개입하지 않아야 스펙의 순수 합산식과 정확히 일치한다).
  function buildEvenlySpreadSequence(totalNotes: number, missCount: number): JudgeGrade[] {
    const missIndices = new Set<number>();
    for (let i = 1; i <= missCount; i++) {
      missIndices.add(Math.floor((i * totalNotes) / (missCount + 1)));
    }
    const sequence: JudgeGrade[] = [];
    for (let n = 0; n < totalNotes; n++) {
      sequence.push(missIndices.has(n) ? "MISS" : "PERFECT_PLUS");
    }
    return sequence;
  }

  function playSequence(sequence: readonly JudgeGrade[], a: number) {
    let state = createGaugeState("normal");
    for (const grade of sequence) {
      state = applyGaugeJudgement(state, grade, a);
    }
    return state;
  }

  it("1000노트에서 미스 80개까지는 보더(70%) 이상으로 클리어가 성립한다", () => {
    const a = computeGaugeCoefficient(1000);
    const state = playSequence(buildEvenlySpreadSequence(1000, 80), a);
    expect(isCleared(state)).toBe(true);
    expect(state.value).toBeGreaterThanOrEqual(70);
  });

  it("1000노트에서 미스 81개부터는 보더 미달로 실패한다", () => {
    const a = computeGaugeCoefficient(1000);
    const state = playSequence(buildEvenlySpreadSequence(1000, 81), a);
    expect(isCleared(state)).toBe(false);
    expect(state.value).toBeLessThan(70);
  });
});

describe("FX 롱노트 틱 반영 (applyGaugeHoldTick)", () => {
  it("서바이벌형은 끊긴 틱마다 미스 감소량의 1/4을 깎는다", () => {
    let state = createGaugeState("hard"); // missPercent 9.0 → 끊긴 틱은 -2.25
    state = applyGaugeHoldTick(state, false, 0);
    expect(state.value).toBeCloseTo(97.75, 5);
  });

  it("NORMAL은 유지 중일 때 a×0.5, 끊기면 미스 감소량의 1/4을 반영한다", () => {
    const a = computeGaugeCoefficient(1000);
    let state = createGaugeState("normal");
    for (let i = 0; i < 20; i++) {
      state = applyGaugeJudgement(state, "PERFECT_PLUS", a); // 클램프에 걸리지 않도록 여유 확보
    }

    const beforeMaintain = state.value;
    state = applyGaugeHoldTick(state, true, a);
    expect(state.value).toBeCloseTo(beforeMaintain + a * 0.5, 5);

    const beforeBreak = state.value;
    state = applyGaugeHoldTick(state, false, a);
    expect(state.value).toBeCloseTo(beforeBreak - 4.5 / 4, 5);
  });
});

describe("BackupGaugeRelay (GAS)", () => {
  it("GAS 전환 시 표면 게이지가 백그라운드 잔량을 그대로 승계한다", () => {
    const a = computeGaugeCoefficient(20);
    let relay = createBackupGaugeRelay("hard");
    let manualBackup = createGaugeState("normal");

    const applyOne = (grade: JudgeGrade) => {
      relay = applyBackupGaugeRelayJudgement(relay, grade, a);
      manualBackup = applyGaugeJudgement(manualBackup, grade, a);
    };

    for (const grade of ["PERFECT_PLUS", "PERFECT_PLUS", "MISS", "PERFECT_PLUS"] as const) {
      applyOne(grade);
    }
    for (let i = 0; i < 30 && !relay.relayed; i++) {
      applyOne("MISS");
    }

    expect(relay.relayed).toBe(true);
    expect(relay.backup).toBeNull();
    expect(relay.primary.type).toBe("normal");
    expect(relay.primary.value).toBeCloseTo(manualBackup.value, 5);
  });

  it("곡 후반에 표면 게이지가 폭사해도 전환 후 클리어가 성립할 수 있다", () => {
    const a = computeGaugeCoefficient(100);
    let relay = createBackupGaugeRelay("hard");
    const applyOne = (grade: JudgeGrade) => {
      relay = applyBackupGaugeRelayJudgement(relay, grade, a);
    };

    for (let i = 0; i < 80; i++) applyOne("PERFECT_PLUS"); // 백그라운드를 보더 위(100%)로 확보
    for (let i = 0; i < 30 && !relay.relayed; i++) applyOne("MISS"); // 표면(HARD) 폭사 유도
    expect(relay.relayed).toBe(true);

    for (let i = 0; i < 20; i++) applyOne("PERFECT_PLUS"); // 전환 후 NORMAL 규칙으로 회복

    expect(relay.primary.type).toBe("normal");
    expect(isCleared(relay.primary)).toBe(true);
    expect(relay.primary.value).toBeGreaterThanOrEqual(70);
  });

  it("전환 후에는 서바이벌 계산 없이 NORMAL 규칙만 적용된다(재전환 없음)", () => {
    const a = computeGaugeCoefficient(20);
    let relay = createBackupGaugeRelay("challenge");
    const applyOne = (grade: JudgeGrade) => {
      relay = applyBackupGaugeRelayJudgement(relay, grade, a);
    };
    for (let i = 0; i < 30 && !relay.relayed; i++) applyOne("MISS");
    expect(relay.relayed).toBe(true);

    // 전환 후 다시 미스를 연타해도 서바이벌처럼 폭사하지 않고 NORMAL처럼 0%에서 멈춘다.
    for (let i = 0; i < 50; i++) applyOne("MISS");
    expect(relay.primary.dead).toBe(false);
    expect(relay.primary.value).toBe(0);
  });
});
