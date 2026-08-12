// 마디선(박자 구분선) 시각 계산. 렌더링/DOM과 분리된 순수 함수 (SPEC.md 10절).
import type { BpmChange } from "../chart/types";
import { currentBpm } from "./scroll";
import { DEFAULT_BEATS_PER_MEASURE } from "../config";

// 0ms부터 durationMs까지, 한 박씩 전진하며 beatsPerMeasure마다 마디선 시각(ms)을 만든다.
// 박 단위로 걸으므로 곡 도중 BPM이 바뀌어도 그 시점의 BPM이 자연스럽게 반영된다
// (마디 길이를 한 번에 계산하면 마디 중간의 BPM 변경을 놓친다).
export function generateBarLineTimesMs(
  bpmChanges: BpmChange[],
  durationMs: number,
  beatsPerMeasure: number = DEFAULT_BEATS_PER_MEASURE,
): number[] {
  if (beatsPerMeasure < 1) throw new Error("beatsPerMeasure는 1 이상이어야 합니다.");

  const times: number[] = [];
  let timeMs = 0;
  let beatIndex = 0;

  while (timeMs <= durationMs) {
    if (beatIndex % beatsPerMeasure === 0) times.push(timeMs);
    const bpm = currentBpm(bpmChanges, timeMs);
    if (bpm <= 0) break; // BPM이 0이면 시간이 전진하지 않아 무한 루프가 된다.
    timeMs += 60000 / bpm;
    beatIndex++;
  }

  return times;
}
