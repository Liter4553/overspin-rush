// 스크래치 입력 상태 머신. 렌더링/DOM과 완전히 분리된 순수 함수로만 구성한다
// (SPEC.md 10절 — 스크래치 상태 머신은 유닛테스트가 명시적으로 요구됨).

export type ScratchDirection = "up" | "down";

export interface ScratchAccumulatorState {
  accumulated: number;
}

export function createScratchAccumulator(): ScratchAccumulatorState {
  return { accumulated: 0 };
}

// movementY를 누적한다. 화면 좌표계상 위로 움직이면 음수(up), 아래로 움직이면
// 양수(down). 누적 절대값이 threshold 이상이면 방향을 산출하고 누적값을 0으로
// 리셋한다(SPEC.md 2절 "인정 즉시 누적값 리셋").
export function accumulateMovement(
  state: ScratchAccumulatorState,
  movementY: number,
  threshold: number,
): { state: ScratchAccumulatorState; direction: ScratchDirection | null } {
  const accumulated = state.accumulated + movementY;
  if (Math.abs(accumulated) >= threshold) {
    const direction: ScratchDirection = accumulated < 0 ? "up" : "down";
    return { state: { accumulated: 0 }, direction };
  }
  return { state: { accumulated }, direction: null };
}

export interface ScratchDirectionState {
  lastDirection: ScratchDirection | null;
  lastScratchTimeMs: number | null;
}

export function createScratchDirectionState(): ScratchDirectionState {
  return { lastDirection: null, lastScratchTimeMs: null };
}

// 방향 교대 규칙 + 2초 리셋 (SPEC.md 2절).
// - 직전 유효 입력과 같은 방향이면 무효(상태 변화 없음, 판정도 노트 소모도 없음).
// - 마지막 유효 입력으로부터 resetMs가 지났으면 방향 제한 없이 항상 유효.
export function applyScratchDirection(
  state: ScratchDirectionState,
  direction: ScratchDirection,
  nowMs: number,
  resetMs: number,
): { state: ScratchDirectionState; valid: boolean } {
  const expired = state.lastScratchTimeMs !== null && nowMs - state.lastScratchTimeMs > resetMs;
  const effectiveLastDirection = expired ? null : state.lastDirection;

  if (direction === effectiveLastDirection) {
    return { state, valid: false };
  }

  return {
    state: { lastDirection: direction, lastScratchTimeMs: nowMs },
    valid: true,
  };
}
