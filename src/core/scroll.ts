import type { BpmChange } from "../chart/types";

// 그린넘버 기반 시간→y좌표 변환. BPM이 바뀌어도 ms 기준이라 체감 속도가 유지된다.
// noteTimeMs > currentTimeMs (아직 도달 전)면 judgeLineY보다 위(작은 y), 지나갔으면 아래(큰 y).
export function noteY(
  noteTimeMs: number,
  currentTimeMs: number,
  greenNumberMs: number,
  judgeLineY: number,
): number {
  return judgeLineY - ((noteTimeMs - currentTimeMs) / greenNumberMs) * judgeLineY;
}

// bpmChanges는 시간 오름차순 정렬되어 있다고 가정 (parseChart가 정렬해서 반환).
export function currentBpm(bpmChanges: BpmChange[], currentTimeMs: number): number {
  let bpm = bpmChanges[0]?.bpm ?? 0;
  for (const change of bpmChanges) {
    if (change.time > currentTimeMs) break;
    bpm = change.bpm;
  }
  return bpm;
}
