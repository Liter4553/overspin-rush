// 마디:틱 표기(.pattern 채보 포맷, SPEC.md 7-1절) <-> ms 변환.
// BPM에 비례해 박자 단위로 노트를 배치하기 위한 순수 함수만 모아둔다.
import { PATTERN_TICKS_PER_BEAT } from "./formatConstants";
import { barStartAbsoluteTick, type TimeSignature } from "./timeSignature";

export interface BarTick {
  bar: number; // 1부터 시작
  tick: number; // 0부터 시작, 마디 내 틱 오프셋
}

export interface TickBpmChange {
  tick: number; // barTickToAbsoluteTick 결과 (절대 틱)
  bpm: number;
}

// 변박이 있으면 마디마다 길이가 다르므로, 해당 마디의 시작 절대틱을 박자표 목록으로
// 계산한 뒤 마디 내 틱을 더한다. signatures가 비어 있으면 전 구간 4/4로 동작한다.
export function barTickToAbsoluteTick(barTick: BarTick, signatures: readonly TimeSignature[] = []): number {
  return barStartAbsoluteTick(signatures, barTick.bar) + barTick.tick;
}

// 1틱 = 16분음표는 박자표와 무관하게 고정이므로, 여기엔 박자표가 관여하지 않는다.
function msPerTick(bpm: number): number {
  const beatMs = 60000 / bpm;
  return beatMs / PATTERN_TICKS_PER_BEAT;
}

// tickBpmChanges는 tick 오름차순 정렬되어 있다고 가정한다.
// 첫 항목의 bpm이 절대틱 0부터 적용된 것으로 취급한다(첫 항목 자체의 tick 값과 무관, scroll.ts의 currentBpm과 동일한 관례).
export function absoluteTickToMs(absoluteTick: number, tickBpmChanges: readonly TickBpmChange[]): number {
  if (tickBpmChanges.length === 0) throw new Error("tickBpmChanges는 최소 1개 필요합니다.");

  let ms = 0;
  let prevTick = 0;
  let prevBpm = tickBpmChanges[0].bpm;

  for (const change of tickBpmChanges) {
    if (change.tick > absoluteTick) break;
    ms += (change.tick - prevTick) * msPerTick(prevBpm);
    prevTick = change.tick;
    prevBpm = change.bpm;
  }

  ms += (absoluteTick - prevTick) * msPerTick(prevBpm);
  return ms;
}

// absoluteTickToMs의 역변환. ms만 있는 JSON 채보에서 노트의 절대틱을 복원할 때 쓴다.
// .pattern 채보는 애초에 틱이 원본이므로 이 함수를 거치지 않는다.
export function msToAbsoluteTick(ms: number, tickBpmChanges: readonly TickBpmChange[]): number {
  if (tickBpmChanges.length === 0) throw new Error("tickBpmChanges는 최소 1개 필요합니다.");

  let accMs = 0;
  let prevTick = 0;
  let prevBpm = tickBpmChanges[0].bpm;

  for (const change of tickBpmChanges) {
    const segmentMs = (change.tick - prevTick) * msPerTick(prevBpm);
    if (accMs + segmentMs > ms) break; // 목표 시각이 이 구간 안에 있다.
    accMs += segmentMs;
    prevTick = change.tick;
    prevBpm = change.bpm;
  }

  return prevTick + (ms - accMs) / msPerTick(prevBpm);
}

export function barTickToMs(
  barTick: BarTick,
  tickBpmChanges: readonly TickBpmChange[],
  signatures: readonly TimeSignature[] = [],
): number {
  return absoluteTickToMs(barTickToAbsoluteTick(barTick, signatures), tickBpmChanges);
}
