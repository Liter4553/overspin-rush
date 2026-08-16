// 마디:틱 표기(.pattern 채보 포맷, SPEC.md 7-1절) <-> ms 변환.
// BPM에 비례해 박자 단위로 노트를 배치하기 위한 순수 함수만 모아둔다.
import { DEFAULT_BEATS_PER_MEASURE, PATTERN_TICKS_PER_BEAT } from "../config";

export interface BarTick {
  bar: number; // 1부터 시작
  tick: number; // 0부터 시작, 마디 내 틱 오프셋
}

export interface TickBpmChange {
  tick: number; // barTickToAbsoluteTick 결과 (절대 틱)
  bpm: number;
}

// 마디 하나에 들어가는 틱 수. 1틱은 항상 16분음표이고, 한 마디에 몇 박이 들어가는지
// (박자표의 분자)만 채보마다 달라진다 — 4/4면 16틱, 3/4면 12틱.
export function ticksPerMeasure(beatsPerMeasure: number = DEFAULT_BEATS_PER_MEASURE): number {
  return beatsPerMeasure * PATTERN_TICKS_PER_BEAT;
}

export function barTickToAbsoluteTick(
  barTick: BarTick,
  beatsPerMeasure: number = DEFAULT_BEATS_PER_MEASURE,
): number {
  return (barTick.bar - 1) * ticksPerMeasure(beatsPerMeasure) + barTick.tick;
}

// 1틱 = 16분음표는 박자표와 무관하게 고정이므로, 여기엔 beatsPerMeasure가 관여하지 않는다.
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

export function barTickToMs(
  barTick: BarTick,
  tickBpmChanges: readonly TickBpmChange[],
  beatsPerMeasure: number = DEFAULT_BEATS_PER_MEASURE,
): number {
  return absoluteTickToMs(barTickToAbsoluteTick(barTick, beatsPerMeasure), tickBpmChanges);
}
