// 홀드 노트 진행(틱) 로직. 렌더링/DOM과 분리된 순수 함수로만 구성한다 (SPEC.md 10절).
// 시작 판정은 noteState/judge가 이미 처리하므로, 여기서는 "판정 이후 누르고 있는 동안"만 다룬다.
//
// 틱 시각은 ms를 더해 가며 구하지 않는다(SPEC.md 10절) — 홀드가 BPM 변경을 걸치면 시작
// 시점에 고정한 간격이 계속 쓰여 이후 틱이 음악 격자에서 벗어나기 때문. 대신 "시작 절대틱 +
// n번째 * 간격틱"을 절대틱으로 구한 뒤 absoluteTickToMs로 매번 변환한다.
import type { ChartNote } from "../chart/types";
import { absoluteTickToMs, type TickBpmChange } from "../chart/barTick";
import { DEFAULT_HOLD_TICK_INTERVAL_BEATS, PATTERN_TICKS_PER_BEAT } from "../config";

export interface ActiveHold {
  endTimeMs: number;
  startTick: number; // 홀드 시작 노트의 절대틱
  intervalTicks: number; // 틱 사이 간격(절대틱 단위, 소수 가능)
  elapsedTicks: number; // 지금까지 발생한 틱 수
  nextTickTimeMs: number; // 다음 틱 시각(절대틱에서 변환한 값)
}

// 틱 간격을 절대틱 단위로 계산한다. 우선순위는 노트별 > 채보 전체 > 기본값.
// 1박(4분음표) = PATTERN_TICKS_PER_BEAT틱이므로 비트 단위 설정을 그대로 환산하면 된다.
// BPM에 의존하지 않는다 — 박자 단위이기 때문에 BPM이 바뀌어도 그대로 유효하다.
export function computeTickIntervalTicks(
  noteTickIntervalBeats: number | undefined,
  chartTickIntervalBeats: number | undefined,
): number {
  const beats = noteTickIntervalBeats ?? chartTickIntervalBeats ?? DEFAULT_HOLD_TICK_INTERVAL_BEATS;
  return beats * PATTERN_TICKS_PER_BEAT;
}

// 홀드 시작 판정 직후 활성 홀드로 등록한다.
export function startActiveHold(
  note: ChartNote,
  intervalTicks: number,
  tickBpmChanges: readonly TickBpmChange[],
): ActiveHold {
  const endTimeMs = note.time + (note.duration ?? 0);
  const startTick = note.tick ?? 0;
  return {
    endTimeMs,
    startTick,
    intervalTicks,
    elapsedTicks: 0,
    nextTickTimeMs: absoluteTickToMs(startTick + intervalTicks, tickBpmChanges),
  };
}

export interface TickAdvanceResult {
  hold: ActiveHold;
  tickCount: number; // 이번 호출에서 발생한 틱 수(프레임 드랍 시 여러 개 캐치업 가능)
  expired: boolean; // endTimeMs를 지나 정리(맵에서 제거) 대상인지
}

// currentTimeMs까지 놓친 틱들을 한 번에 처리한다. keyup으로 해제된 홀드는 호출자가
// 맵에서 즉시 제거하므로(재개되지 않음, SPEC.md 3절) 이 함수는 그 케이스를 모른다.
export function advanceHoldTicks(
  hold: ActiveHold,
  currentTimeMs: number,
  tickBpmChanges: readonly TickBpmChange[],
): TickAdvanceResult {
  if (currentTimeMs > hold.endTimeMs) {
    return { hold, tickCount: 0, expired: true };
  }
  if (hold.intervalTicks <= 0) {
    return { hold, tickCount: 0, expired: false }; // 간격이 0 이하면 무한 루프가 된다.
  }

  let tickCount = 0;
  let elapsedTicks = hold.elapsedTicks;
  let nextTickTimeMs = hold.nextTickTimeMs;

  while (nextTickTimeMs <= currentTimeMs) {
    tickCount += 1;
    elapsedTicks += 1;
    nextTickTimeMs = absoluteTickToMs(
      hold.startTick + (elapsedTicks + 1) * hold.intervalTicks,
      tickBpmChanges,
    );
  }

  return { hold: { ...hold, elapsedTicks, nextTickTimeMs }, tickCount, expired: false };
}
