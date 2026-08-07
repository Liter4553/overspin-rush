// 홀드 노트 진행(틱) 로직. 렌더링/DOM과 분리된 순수 함수로만 구성한다 (SPEC.md 10절).
// 시작 판정은 noteState/judge가 이미 처리하므로, 여기서는 "판정 이후 누르고 있는 동안"만 다룬다.
import type { BpmChange, ChartNote } from "../chart/types";
import { currentBpm } from "./scroll";
import { DEFAULT_HOLD_TICK_INTERVAL_BEATS } from "../config";

export interface ActiveHold {
  endTimeMs: number;
  tickIntervalMs: number;
  nextTickTimeMs: number;
}

// 틱 간격(ms)을 우선순위(노트별 > 채보 전체 > 기본값)에 따라 BPM 연동으로 계산한다.
export function computeTickIntervalMs(
  bpmChanges: BpmChange[],
  noteTimeMs: number,
  noteTickIntervalBeats: number | undefined,
  chartTickIntervalBeats: number | undefined,
): number {
  const beats = noteTickIntervalBeats ?? chartTickIntervalBeats ?? DEFAULT_HOLD_TICK_INTERVAL_BEATS;
  const bpm = currentBpm(bpmChanges, noteTimeMs);
  const beatMs = 60000 / bpm;
  return beatMs * beats;
}

// 홀드 시작 판정 직후 활성 홀드로 등록한다.
export function startActiveHold(note: ChartNote, tickIntervalMs: number): ActiveHold {
  const endTimeMs = note.time + (note.duration ?? 0);
  return { endTimeMs, tickIntervalMs, nextTickTimeMs: note.time + tickIntervalMs };
}

export interface TickAdvanceResult {
  hold: ActiveHold;
  tickCount: number; // 이번 호출에서 발생한 틱 수(프레임 드랍 시 여러 개 캐치업 가능)
  expired: boolean; // endTimeMs를 지나 정리(맵에서 제거) 대상인지
}

// currentTimeMs까지 놓친 틱들을 한 번에 처리한다. keyup으로 해제된 홀드는 호출자가
// 맵에서 즉시 제거하므로(재개되지 않음, SPEC.md 3절) 이 함수는 그 케이스를 모른다.
export function advanceHoldTicks(hold: ActiveHold, currentTimeMs: number): TickAdvanceResult {
  if (currentTimeMs > hold.endTimeMs) {
    return { hold, tickCount: 0, expired: true };
  }
  let tickCount = 0;
  let nextTickTimeMs = hold.nextTickTimeMs;
  while (nextTickTimeMs <= currentTimeMs) {
    tickCount += 1;
    nextTickTimeMs += hold.tickIntervalMs;
  }
  return { hold: { ...hold, nextTickTimeMs }, tickCount, expired: false };
}
