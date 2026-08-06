// main.ts의 handleMouseMove가 실제로 호출하는 것과 동일한 순서로
// scratchInput/judge/noteState/gameState를 조합했을 때 스크래치 판정
// 흐름이 올바른지 검증한다. Pointer Lock은 이 자동화 환경에서 요청이
// 거부되어(브라우저 보안 제약) 실브라우저 e2e를 대신해 이 결정론적
// 통합 테스트로 스크래치 파이프라인을 검증한다.
import { describe, expect, it } from "vitest";
import { computeErrorMs, displaySign, judge } from "./judge";
import { createNoteTracker, findNearestPendingNote, markJudged } from "./noteState";
import { applyJudgement, createGameState } from "./gameState";
import {
  accumulateMovement,
  applyScratchDirection,
  createScratchAccumulator,
  createScratchDirectionState,
  type ScratchAccumulatorState,
  type ScratchDirectionState,
} from "./scratchInput";
import {
  AUDIO_OFFSET_MS,
  AUTO_MISS_WINDOW_MS,
  INPUT_OFFSET_MS,
  SCRATCH_DIR_RESET_MS,
  SCRATCH_JUDGMENT_TABLE,
  SCRATCH_THRESHOLD,
} from "../config";
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

// main.ts의 handleMouseMove와 동일한 순서: 누적 -> 방향 상태머신 -> 판정.
function simulateScratchMove(
  tracker: ReturnType<typeof createNoteTracker>,
  gameState: ReturnType<typeof createGameState>,
  accumulator: ScratchAccumulatorState,
  directionState: ScratchDirectionState,
  movementY: number,
  inputTimeMs: number,
) {
  const accResult = accumulateMovement(accumulator, movementY, SCRATCH_THRESHOLD);
  if (accResult.direction === null) {
    return { gameState, accumulator: accResult.state, directionState, hit: false as const };
  }

  const dirResult = applyScratchDirection(directionState, accResult.direction, inputTimeMs, SCRATCH_DIR_RESET_MS);
  if (!dirResult.valid) {
    return { gameState, accumulator: accResult.state, directionState: dirResult.state, hit: false as const };
  }

  const found = findNearestPendingNote(tracker, "scratch", inputTimeMs, AUTO_MISS_WINDOW_MS);
  if (found === null) {
    return { gameState, accumulator: accResult.state, directionState: dirResult.state, hit: false as const };
  }

  const errorMs = computeErrorMs(inputTimeMs, found.note.time, AUDIO_OFFSET_MS, INPUT_OFFSET_MS);
  const result = judge(Math.abs(errorMs), SCRATCH_JUDGMENT_TABLE);
  const sign = displaySign(result.grade, errorMs);
  markJudged(found, result.grade, errorMs);
  const nextState = applyJudgement(gameState, result.grade, result.score, sign);

  return {
    gameState: nextState,
    accumulator: accResult.state,
    directionState: dirResult.state,
    hit: true as const,
    grade: result.grade,
    errorMs,
  };
}

describe("스크래치 판정 흐름 통합 (scratchInput + judge + noteState + gameState)", () => {
  it("정타 스크래치는 SCRATCH_JUDGMENT_TABLE로 PERFECT+ 판정된다", () => {
    const chart = makeChart([{ time: 1000, lane: "scratch", type: "tap" }]);
    const tracker = createNoteTracker(chart);

    const result = simulateScratchMove(
      tracker,
      createGameState(),
      createScratchAccumulator(),
      createScratchDirectionState(),
      -25, // 임계값(20px) 넘는 위쪽 움직임
      1000,
    );

    expect(result.hit).toBe(true);
    expect(result.grade).toBe("PERFECT_PLUS");
    expect(result.gameState.score).toBe(4);
    expect(tracker[0].state).toBe("judged");
  });

  it("오차 30ms는 노트라면 PERFECT(3점)지만 스크래치는 PERFECT+(4점)다", () => {
    const chart = makeChart([{ time: 1000, lane: "scratch", type: "tap" }]);
    const tracker = createNoteTracker(chart);

    const result = simulateScratchMove(
      tracker,
      createGameState(),
      createScratchAccumulator(),
      createScratchDirectionState(),
      -25,
      1030,
    );

    expect(result.grade).toBe("PERFECT_PLUS");
    expect(result.gameState.score).toBe(4);
  });

  it("같은 방향 연속 스크래치는 무효라 노트를 소모하지 않는다", () => {
    const chart = makeChart([
      { time: 1000, lane: "scratch", type: "tap" },
      { time: 1100, lane: "scratch", type: "tap" },
    ]);
    const tracker = createNoteTracker(chart);
    let gameState = createGameState();
    let accumulator = createScratchAccumulator();
    let directionState = createScratchDirectionState();

    const first = simulateScratchMove(tracker, gameState, accumulator, directionState, -25, 1000);
    expect(first.hit).toBe(true);
    gameState = first.gameState;
    accumulator = first.accumulator;
    directionState = first.directionState;

    // 같은 방향(up) 연속 - 0.5초 뒤라 아직 방향 제한 안 풀림 -> 무효, 두 번째 노트도 안 먹힘
    const second = simulateScratchMove(tracker, gameState, accumulator, directionState, -25, 1100);
    expect(second.hit).toBe(false);
    expect(tracker[1].state).toBe("pending");
  });

  it("누적이 임계값 미만이면 방향이 안 나오고 아무 일도 안 일어난다", () => {
    const chart = makeChart([{ time: 1000, lane: "scratch", type: "tap" }]);
    const tracker = createNoteTracker(chart);

    const result = simulateScratchMove(
      tracker,
      createGameState(),
      createScratchAccumulator(),
      createScratchDirectionState(),
      -5, // SCRATCH_THRESHOLD(20) 미만
      1000,
    );

    expect(result.hit).toBe(false);
    expect(tracker[0].state).toBe("pending");
  });
});
