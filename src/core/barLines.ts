// 마디선(박자 구분선) 시각 계산. 렌더링/DOM과 분리된 순수 함수 (SPEC.md 10절).
import type { BpmChange, TimeSignature } from "../chart/types";
import { currentBpm } from "./scroll";
import { signatureAtBar, ticksPerMeasure } from "../chart/timeSignature";
import { PATTERN_TICKS_PER_BEAT } from "../config";

// 0ms부터 durationMs까지 16분음표(1틱)씩 전진하며 마디 머리마다 시각(ms)을 만든다.
// 틱 단위로 걸으므로 (1) 곡 도중 BPM이 바뀌어도 그 시점의 BPM이 자연스럽게 반영되고,
// (2) 마디마다 길이가 다른 변박도 그대로 따라간다 — 마디 길이를 한 번에 계산하면
// 마디 중간의 BPM 변경을 놓친다.
export function generateBarLineTimesMs(
  bpmChanges: BpmChange[],
  durationMs: number,
  timeSignatures: readonly TimeSignature[] = [],
): number[] {
  const times: number[] = [];
  let timeMs = 0;
  let bar = 1;
  let tickInBar = 0;
  let measureTicks = ticksPerMeasure(signatureAtBar(timeSignatures, bar));

  while (timeMs <= durationMs) {
    if (tickInBar === 0) times.push(timeMs);

    const bpm = currentBpm(bpmChanges, timeMs);
    if (bpm <= 0) break; // BPM이 0이면 시간이 전진하지 않아 무한 루프가 된다.
    timeMs += 60000 / bpm / PATTERN_TICKS_PER_BEAT;

    tickInBar++;
    if (tickInBar >= measureTicks) {
      tickInBar = 0;
      bar++;
      measureTicks = ticksPerMeasure(signatureAtBar(timeSignatures, bar));
    }
  }

  return times;
}
