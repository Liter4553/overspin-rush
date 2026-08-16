// 마디선(박자 구분선) 시각 계산. 렌더링/DOM과 분리된 순수 함수 (SPEC.md 10절).
//
// 계산은 오직 "박자표(마디당 틱)"와 "틱 기준 BPM 목록"만으로 한다. ms를 조금씩 누적하며
// 걷는 방식은 절대 쓰지 않는다 — 누적값이 BPM 변경 시각보다 미세하게 모자라면 그 틱에
// 옛 BPM이 적용되어, 마디선이 노트와 수십 ms씩 어긋난 채 곡 끝까지 남는 버그가 있었다
// (BPM 177 -> 100 변경에서 65ms 어긋남). 노트와 완전히 같은 absoluteTickToMs를 쓰므로,
// 같은 틱에 있는 노트와 마디선은 정의상 항상 같은 시각이 된다.
import { absoluteTickToMs, type TickBpmChange } from "../chart/barTick";
import type { TimeSignature } from "../chart/types";
import { signatureAtBar, ticksPerMeasure } from "../chart/timeSignature";

// 마디 머리의 절대틱만 만든다(시간 개념이 전혀 없는 순수 박자 계산).
export function generateBarLineAbsoluteTicks(
  timeSignatures: readonly TimeSignature[],
  throughTick: number,
): number[] {
  const ticks: number[] = [];
  let absoluteTick = 0;
  let bar = 1;

  while (absoluteTick <= throughTick) {
    ticks.push(absoluteTick);
    absoluteTick += ticksPerMeasure(signatureAtBar(timeSignatures, bar));
    bar++;
  }
  return ticks;
}

export function generateBarLineTimesMs(
  bpmChangeTicks: readonly TickBpmChange[],
  durationMs: number,
  timeSignatures: readonly TimeSignature[] = [],
): number[] {
  // BPM이 0 이하면 시간이 전진하지 않아 마디선을 만들 수 없다(무한 루프 방지).
  // .pattern 파서가 이미 거부하는 값이라 정상 채보에서는 걸리지 않는 방어 조건이다.
  if (bpmChangeTicks.length === 0 || bpmChangeTicks.some((change) => change.bpm <= 0)) return [];

  const times: number[] = [];
  let absoluteTick = 0;
  let bar = 1;

  for (;;) {
    const timeMs = absoluteTickToMs(absoluteTick, bpmChangeTicks);
    // BPM이 0 이하면 시각이 무한대가 되어 더 진행할 수 없다(무한 루프 방지).
    if (!Number.isFinite(timeMs) || timeMs > durationMs) break;
    times.push(timeMs);
    absoluteTick += ticksPerMeasure(signatureAtBar(timeSignatures, bar));
    bar++;
  }

  return times;
}
