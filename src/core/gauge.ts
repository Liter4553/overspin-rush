// 게이지 로직. 렌더링/DOM과 완전히 분리된 순수 함수로만 구성한다 (SPEC.md 10절).
import type { JudgeGrade } from "./judge";
import {
  GAUGE_COEFFICIENT_LARGE_CHART_NUMERATOR,
  GAUGE_COEFFICIENT_LARGE_CHART_OFFSET,
  GAUGE_COEFFICIENT_SMALL_CHART_NUMERATOR,
  GAUGE_COEFFICIENT_SMALL_CHART_THRESHOLD,
  GAUGE_DEATH_THRESHOLD,
  GAUGE_LOW_HEALTH_THRESHOLD,
  GAUGE_SURVIVAL_GREAT_PERCENT,
  GAUGE_SURVIVAL_PERFECT_PERCENT,
  GAUGE_TYPE_CONFIG,
  type GaugeType,
} from "../config";

export interface GaugeState {
  readonly type: GaugeType;
  readonly value: number; // 0~100 실수. UI 표시는 1% 단위로 버림한다(렌더 쪽 책임).
  readonly dead: boolean; // 서바이벌형이 폭사했는지. NORMAL은 항상 false.
}

export function createGaugeState(type: GaugeType): GaugeState {
  return { type, value: GAUGE_TYPE_CONFIG[type].start, dead: false };
}

// 채보의 총 판정 대상 노트 수(n)로 NORMAL 게이지의 계수 a(%)를 산출한다. 곡 로드 시 1회만 호출.
export function computeGaugeCoefficient(totalJudgeableNoteCount: number): number {
  if (totalJudgeableNoteCount <= 0) return 0;
  if (totalJudgeableNoteCount < GAUGE_COEFFICIENT_SMALL_CHART_THRESHOLD) {
    return GAUGE_COEFFICIENT_SMALL_CHART_NUMERATOR / totalJudgeableNoteCount;
  }
  return GAUGE_COEFFICIENT_LARGE_CHART_NUMERATOR / (totalJudgeableNoteCount + GAUGE_COEFFICIENT_LARGE_CHART_OFFSET);
}

// 저체력 보정 이전의 판정별 기본 증감량(%). NORMAL은 a를 곱해 채보 길이에 맞춘다.
function baseGradeDeltaPercent(type: GaugeType, grade: JudgeGrade, coefficientA: number): number {
  const config = GAUGE_TYPE_CONFIG[type];
  if (type === "normal") {
    switch (grade) {
      case "PERFECT_PLUS":
      case "PERFECT":
        return coefficientA;
      case "GREAT":
        return coefficientA * 0.75;
      case "GOOD":
        return coefficientA * 0.5;
      case "MISS":
        return -config.missPercent;
    }
  }
  // 서바이벌형(HARD/CHALLENGE): 퍼펙+와 퍼펙의 증가량이 같다(의도된 사양, 차등은 점수에서만 둔다).
  switch (grade) {
    case "PERFECT_PLUS":
    case "PERFECT":
      return GAUGE_SURVIVAL_PERFECT_PERCENT;
    case "GREAT":
      return GAUGE_SURVIVAL_GREAT_PERCENT;
    case "GOOD":
      return 0;
    case "MISS":
      return -config.missPercent;
  }
}

// 클램프(0~100)와 서바이벌 폭사 판정을 공통 처리한다. delta<0로 인해 잔량이
// GAUGE_DEATH_THRESHOLD 미만이 되면 서바이벌형은 0%로 확정하고 폭사 플래그를 세운다.
function applyDelta(state: GaugeState, delta: number): GaugeState {
  if (state.dead) return state;
  const config = GAUGE_TYPE_CONFIG[state.type];
  const raw = state.value + delta;
  const clampedUpper = Math.min(100, raw);

  if (config.survival && delta < 0 && clampedUpper < GAUGE_DEATH_THRESHOLD) {
    return { type: state.type, value: 0, dead: true };
  }

  return { type: state.type, value: Math.max(0, clampedUpper), dead: false };
}

// 탭/롱노트 시작 판정 1회에 대한 게이지 반영. coefficientA는 NORMAL이 아니면 무시된다.
export function applyGaugeJudgement(state: GaugeState, grade: JudgeGrade, coefficientA: number): GaugeState {
  if (state.dead) return state;
  const config = GAUGE_TYPE_CONFIG[state.type];
  let delta = baseGradeDeltaPercent(state.type, grade, coefficientA);

  if (grade === "MISS" && config.lowHealthCorrection && state.value <= GAUGE_LOW_HEALTH_THRESHOLD) {
    delta /= 2;
  }

  return applyDelta(state, delta);
}

// FX 롱노트 유지 구간의 틱 1회 반영. held=true면 유지 중, false면 유지가 끊긴 상태.
// 끊긴 상태의 감소량은 저체력 보정과 무관하게 항상 해당 타입 미스 감소량의 1/4 고정이다.
export function applyGaugeHoldTick(state: GaugeState, held: boolean, coefficientA: number): GaugeState {
  if (state.dead) return state;
  const config = GAUGE_TYPE_CONFIG[state.type];
  const delta = held
    ? state.type === "normal"
      ? coefficientA * 0.5
      : GAUGE_SURVIVAL_GREAT_PERCENT
    : -(config.missPercent / 4);

  return applyDelta(state, delta);
}

// 게이지가 보더(NORMAL 70%) 이상인지 여부. 서바이벌형은 보더가 없으므로 항상 null.
export function isAtOrAboveBorder(state: GaugeState): boolean | null {
  const border = GAUGE_TYPE_CONFIG[state.type].border;
  if (border === null) return null;
  return state.value >= border;
}

// 곡 종료 시점 클리어 여부. 서바이벌형은 폭사하지 않고 완주했으면 클리어.
export function isCleared(state: GaugeState): boolean {
  const config = GAUGE_TYPE_CONFIG[state.type];
  if (config.survival) return !state.dead;
  if (config.border === null) return true;
  return state.value >= config.border;
}

// --- GAS(Gauge Assist System) ---
// 폭사 방지 옵션. 코드상 식별자는 동작을 서술하는 이름을 쓴다("GAS"는 플레이어 노출용 표기).
// HARD/CHALLENGE(표면)와 NORMAL(백그라운드)을 병행 계산하다가, 표면이 폭사하는 순간
// 백그라운드 NORMAL 잔량을 그대로 승계한 NORMAL 게이지로 표면을 교체한다.
export interface BackupGaugeRelayState {
  readonly primary: GaugeState; // 화면에 표시되는 게이지. 전환 전엔 hard/challenge, 전환 후 normal.
  readonly backup: GaugeState | null; // 병행 계산 중인 NORMAL 게이지. 전환 후에는 더 이상 계산하지 않는다(null).
  readonly relayed: boolean; // 전환이 일어났는지.
}

export function createBackupGaugeRelay(primaryType: "hard" | "challenge"): BackupGaugeRelayState {
  return {
    primary: createGaugeState(primaryType),
    backup: createGaugeState("normal"),
    relayed: false,
  };
}

function relayAfterPrimaryUpdate(
  nextPrimary: GaugeState,
  nextBackup: GaugeState | null,
): BackupGaugeRelayState {
  if (nextPrimary.dead && nextBackup !== null) {
    return {
      primary: { type: "normal", value: nextBackup.value, dead: false },
      backup: null,
      relayed: true,
    };
  }
  return { primary: nextPrimary, backup: nextBackup, relayed: false };
}

// coefficientA는 NORMAL 게이지 계수 하나뿐이다. 백그라운드는 항상 NORMAL이고, 전환 후의
// 표면도 NORMAL로 바뀌므로 둘 다 같은 계수를 쓴다(전환 전 표면은 서바이벌형이라 계수를 쓰지 않는다).
export function applyBackupGaugeRelayJudgement(
  state: BackupGaugeRelayState,
  grade: JudgeGrade,
  coefficientA: number,
): BackupGaugeRelayState {
  if (state.relayed) {
    return { ...state, primary: applyGaugeJudgement(state.primary, grade, coefficientA) };
  }
  const nextPrimary = applyGaugeJudgement(state.primary, grade, coefficientA);
  const nextBackup = state.backup === null ? null : applyGaugeJudgement(state.backup, grade, coefficientA);
  return relayAfterPrimaryUpdate(nextPrimary, nextBackup);
}

export function applyBackupGaugeRelayHoldTick(
  state: BackupGaugeRelayState,
  held: boolean,
  coefficientA: number,
): BackupGaugeRelayState {
  if (state.relayed) {
    return { ...state, primary: applyGaugeHoldTick(state.primary, held, coefficientA) };
  }
  const nextPrimary = applyGaugeHoldTick(state.primary, held, coefficientA);
  const nextBackup = state.backup === null ? null : applyGaugeHoldTick(state.backup, held, coefficientA);
  return relayAfterPrimaryUpdate(nextPrimary, nextBackup);
}
