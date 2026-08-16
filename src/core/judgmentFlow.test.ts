// main.ts의 handleKeydown이 실제로 호출하는 것과 동일한 순서로
// judge/noteState/gameState를 조합했을 때 전체 흐름이 올바른지 검증한다.
// 실제 브라우저 자동화는 툴 호출 왕복 지연 때문에 ms 단위 타이밍을
// 신뢰할 수 없어(수 초 단위 지연), 이 결정론적 통합 테스트로 보강한다.
import { describe, expect, it } from "vitest";
import { computeErrorMs, displaySign, judge } from "./judge";
import { applyAutoMiss, createNoteTracker, findNearestPendingNote, markJudged } from "./noteState";
import { applyJudgement, createGameState } from "./gameState";
import {
  NOTE_JUDGMENT_TABLE,
  AUTO_MISS_WINDOW_MS,
  AUDIO_OFFSET_MS,
  INPUT_OFFSET_MS,
  JUDGEABLE_LANES,
} from "../config";
import type { Chart, NoteLane } from "../chart/types";

function makeChart(notes: Chart["notes"]): Chart {
  return {
    version: 1,
    title: "t",
    artist: "a",
    audio: "",
    offset: 0,
    bpmChanges: [{ time: 0, bpm: 150 }],
    bpmChangeTicks: [{ tick: 0, bpm: 150 }],
    level: 1,
    notes,
  };
}

// main.ts의 handleKeydown과 동일한 순서로 판정 1건을 처리한다.
function simulateKeyHit(
  tracker: ReturnType<typeof createNoteTracker>,
  gameState: ReturnType<typeof createGameState>,
  lane: NoteLane,
  inputTimeMs: number,
) {
  const found = findNearestPendingNote(tracker, lane, inputTimeMs, AUTO_MISS_WINDOW_MS);
  if (found === null) return { gameState, hit: false as const };

  const errorMs = computeErrorMs(inputTimeMs, found.note.time, AUDIO_OFFSET_MS, INPUT_OFFSET_MS);
  const result = judge(Math.abs(errorMs), NOTE_JUDGMENT_TABLE);
  const sign = displaySign(result.grade, errorMs);
  markJudged(found, result.grade, errorMs);
  const nextState = applyJudgement(gameState, result.grade, result.score, sign);
  return { gameState: nextState, hit: true as const, grade: result.grade, errorMs };
}

describe("판정 흐름 통합 (judge + noteState + gameState)", () => {
  it("노트 시각보다 15ms 빠르게 입력하면 PERFECT+로 콤보와 점수가 오른다 (정타 취급 - FAST 미집계)", () => {
    const chart = makeChart([{ time: 1000, lane: 0, type: "tap" }]);
    const tracker = createNoteTracker(chart);
    const { gameState, hit, grade, errorMs } = simulateKeyHit(tracker, createGameState(), 0, 985);

    expect(hit).toBe(true);
    expect(grade).toBe("PERFECT_PLUS");
    expect(errorMs).toBe(-15);
    expect(gameState.combo).toBe(1);
    expect(gameState.score).toBe(4);
    expect(gameState.fastCount).toBe(0);
    expect(gameState.slowCount).toBe(0);
    expect(tracker[0].state).toBe("judged");
  });

  it("PERFECT+ 범위를 벗어나면(41ms) SLOW로 정상 집계된다", () => {
    const chart = makeChart([{ time: 1000, lane: 0, type: "tap" }]);
    const tracker = createNoteTracker(chart);
    const { gameState, grade, errorMs } = simulateKeyHit(tracker, createGameState(), 0, 1041);

    expect(grade).toBe("GREAT");
    expect(errorMs).toBe(41);
    expect(gameState.slowCount).toBe(1);
    expect(gameState.fastCount).toBe(0);
  });

  it("윈도우 밖(200ms 이른 입력)이면 무반응이고 노트는 여전히 pending이다", () => {
    const chart = makeChart([{ time: 1000, lane: 0, type: "tap" }]);
    const tracker = createNoteTracker(chart);
    const { gameState, hit } = simulateKeyHit(tracker, createGameState(), 0, 800);

    expect(hit).toBe(false);
    expect(gameState.combo).toBe(0);
    expect(tracker[0].state).toBe("pending");
  });

  it("여러 노트를 연속으로 치면 콤보가 누적되고, 하나를 GOOD으로 늦게 쳐도 콤보는 유지된다", () => {
    const chart = makeChart([
      { time: 1000, lane: 0, type: "tap" },
      { time: 1500, lane: 1, type: "tap" },
      { time: 2000, lane: 2, type: "tap" },
    ]);
    const tracker = createNoteTracker(chart);
    let state = createGameState();

    state = simulateKeyHit(tracker, state, 0, 1000).gameState; // 정타 PERFECT+
    state = simulateKeyHit(tracker, state, 1, 1575).gameState; // +75ms GOOD/SLOW
    state = simulateKeyHit(tracker, state, 2, 2000).gameState; // 정타 PERFECT+

    expect(state.combo).toBe(3);
    expect(state.gradeCounts.GOOD).toBe(1);
    expect(state.slowCount).toBe(1);
  });

  it("입력 없이 자동 MISS되면 콤보가 끊긴다 (연속 판정 시나리오)", () => {
    const chart = makeChart([
      { time: 1000, lane: 0, type: "tap" },
      { time: 2000, lane: 0, type: "tap" },
    ]);
    const tracker = createNoteTracker(chart);
    let state = createGameState();

    state = simulateKeyHit(tracker, state, 0, 1000).gameState; // 콤보 1
    expect(state.combo).toBe(1);

    // 두 번째 노트를 치지 않고 슬로우 윈도우를 넘김 -> 자동 MISS
    const missed = applyAutoMiss(tracker, 2081, AUTO_MISS_WINDOW_MS);
    expect(missed).toHaveLength(1);
    for (const m of missed) {
      state = applyJudgement(state, m.grade!, 0, null);
    }
    expect(state.combo).toBe(0);
    expect(state.gradeCounts.MISS).toBe(1);
  });

  it("main.ts와 동일하게 JUDGEABLE_LANES로 필터링하면 이제 FX도 자동 MISS 대상에 포함된다 (마일스톤 7 회귀 테스트)", () => {
    const chart = makeChart([
      { time: 1000, lane: 0, type: "tap" },
      { time: 1000, lane: "fx", type: "tap" },
      { time: 1000, lane: "scratch", type: "tap" },
    ]);
    const tracker = createNoteTracker(chart);

    // main.ts renderLoop이 하는 것과 동일: 판정 대상 레인만 걸러서 auto-miss에 넘긴다.
    const judgeableTracked = tracker.filter((t) => JUDGEABLE_LANES.includes(t.note.lane));
    const missed = applyAutoMiss(judgeableTracked, 1081, AUTO_MISS_WINDOW_MS);

    expect(missed).toHaveLength(3); // 노트 레인 0 + FX + 스크래치 전부 판정 대상
    const fxEntry = tracker.find((t) => t.note.lane === "fx")!;
    expect(fxEntry.state).toBe("judged");
    expect(fxEntry.grade).toBe("MISS");
  });

  it("FX와 일반 노트가 같은 시각에 있어도 서로 독립적으로 판정된다 (SPEC.md 2절, 9절)", () => {
    const chart = makeChart([
      { time: 1000, lane: 0, type: "tap" },
      { time: 1000, lane: "fx", type: "tap" },
    ]);
    const tracker = createNoteTracker(chart);
    let state = createGameState();

    // 일반 노트는 정타로, FX는 40ms 느리게(PERFECT) 입력해도 서로 간섭하지 않는다.
    const laneResult = simulateKeyHit(tracker, state, 0, 1000);
    state = laneResult.gameState;
    const fxResult = simulateKeyHit(tracker, state, "fx", 1040);
    state = fxResult.gameState;

    expect(laneResult.grade).toBe("PERFECT_PLUS");
    expect(fxResult.grade).toBe("PERFECT");
    expect(state.combo).toBe(2); // 둘 다 채점되어 콤보가 2까지 오른다
    expect(state.score).toBe(4 + 3);
  });
});
