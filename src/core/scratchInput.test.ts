import { describe, expect, it } from "vitest";
import {
  accumulateMovement,
  applyScratchDirection,
  createScratchAccumulator,
  createScratchDirectionState,
} from "./scratchInput";
import { SCRATCH_DIR_RESET_MS, SCRATCH_THRESHOLD } from "../config";

describe("accumulateMovement", () => {
  it("임계값 미만이면 방향 없이 누적만 된다", () => {
    const result = accumulateMovement(createScratchAccumulator(), 10, SCRATCH_THRESHOLD);
    expect(result.direction).toBeNull();
    expect(result.state.accumulated).toBe(10);
  });

  it("위로(음수) 임계값을 넘으면 up, 누적값이 리셋된다", () => {
    const result = accumulateMovement(createScratchAccumulator(), -25, 20);
    expect(result.direction).toBe("up");
    expect(result.state.accumulated).toBe(0);
  });

  it("아래로(양수) 임계값을 넘으면 down", () => {
    const result = accumulateMovement(createScratchAccumulator(), 25, 20);
    expect(result.direction).toBe("down");
  });

  it("여러 번에 걸쳐 누적되다가 임계값을 넘긴다", () => {
    let acc = createScratchAccumulator();
    let result = accumulateMovement(acc, 8, 20);
    expect(result.direction).toBeNull();
    acc = result.state;
    result = accumulateMovement(acc, 8, 20);
    expect(result.direction).toBeNull();
    acc = result.state;
    result = accumulateMovement(acc, 8, 20); // 8+8+8=24 >= 20
    expect(result.direction).toBe("down");
  });
});

describe("applyScratchDirection - SPEC.md 9절 시나리오", () => {
  it("UP -> UP (0.5초 간격) = 두 번째 무효", () => {
    let state = createScratchDirectionState();
    const first = applyScratchDirection(state, "up", 0, SCRATCH_DIR_RESET_MS);
    expect(first.valid).toBe(true);
    state = first.state;

    const second = applyScratchDirection(state, "up", 500, SCRATCH_DIR_RESET_MS);
    expect(second.valid).toBe(false);
    expect(second.state).toBe(state); // 상태 변화 없음
  });

  it("UP -> DOWN = 둘 다 유효", () => {
    let state = createScratchDirectionState();
    const first = applyScratchDirection(state, "up", 0, SCRATCH_DIR_RESET_MS);
    expect(first.valid).toBe(true);
    state = first.state;

    const second = applyScratchDirection(state, "down", 300, SCRATCH_DIR_RESET_MS);
    expect(second.valid).toBe(true);
  });

  it("UP -> (2.5초 대기) -> UP = 둘 다 유효", () => {
    let state = createScratchDirectionState();
    const first = applyScratchDirection(state, "up", 0, SCRATCH_DIR_RESET_MS);
    expect(first.valid).toBe(true);
    state = first.state;

    const second = applyScratchDirection(state, "up", 2500, SCRATCH_DIR_RESET_MS);
    expect(second.valid).toBe(true);
  });

  it("UP -> DOWN -> (2.5초 대기) -> DOWN = 세 번 모두 유효", () => {
    let state = createScratchDirectionState();

    const first = applyScratchDirection(state, "up", 0, SCRATCH_DIR_RESET_MS);
    expect(first.valid).toBe(true);
    state = first.state;

    const second = applyScratchDirection(state, "down", 300, SCRATCH_DIR_RESET_MS);
    expect(second.valid).toBe(true);
    state = second.state;

    const third = applyScratchDirection(state, "down", 300 + 2500, SCRATCH_DIR_RESET_MS);
    expect(third.valid).toBe(true);
  });

  it("정확히 2초 경과(리셋 기준 이하)면 아직 같은 방향은 무효다", () => {
    let state = createScratchDirectionState();
    const first = applyScratchDirection(state, "up", 0, SCRATCH_DIR_RESET_MS);
    state = first.state;

    const atExactly2000 = applyScratchDirection(state, "up", 2000, SCRATCH_DIR_RESET_MS);
    expect(atExactly2000.valid).toBe(false);

    const justOver2000 = applyScratchDirection(state, "up", 2001, SCRATCH_DIR_RESET_MS);
    expect(justOver2000.valid).toBe(true);
  });
});
